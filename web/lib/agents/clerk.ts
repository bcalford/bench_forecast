// The clerk step (spec.md §3.4). Code decides the tally, outcome, tie rule and assigner; one model call then
// groups the majority into joiners and concurrences and predicts the author, constrained to the code's result.
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall } from "../claude";
import { MODELS } from "../models";
import { tallyVotes, type ClerkTally, type JusticeVote, type Seniority } from "../clerk-rules";
import { ClerkResultSchema, type ClerkResult, type JusticeOpinion } from "../schemas";

const SYSTEM = `You are the clerk who drafts the Court's line-up once every justice's forecast vote is in.
The tally, the outcome and who assigns the opinion are already decided by rule and are not yours to change.
Your job: (1) sort the majority into those who join the majority opinion in full, those who join and also write
separately, and those who agree only with the result; (2) predict who writes the majority opinion, weighing who
assigns it, how opinion assignments are being balanced across the term, and each candidate's expertise in this
area of law. Choose the author only from the candidates given. Explain the author choice in one sentence.`;

export type ClerkRun = { tally: ClerkTally; result: ClerkResult; costUsd: number; adjustments: string[]; calls: { model: string; usage: Anthropic.Beta.BetaUsage; costUsd: number }[] };

export async function runClerk(
  title: string,
  opinions: Map<string, JusticeOpinion>,
  names: Record<string, string>,
  seniority: Seniority,
  termContext: string | null, // e.g. who has written how many majority opinions this term, when known
): Promise<ClerkRun> {
  const votes: JusticeVote[] = [...opinions].map(([justice, o]) => ({ justice, vote: o.vote, role: o.role, confidence: o.confidence }));
  const tally = tallyVotes(votes, seniority);

  // An equally divided Court has no majority opinion: nothing for the model to decide.
  if (tally.tie || !tally.winningSide) {
    return {
      tally,
      result: { joins_majority: [], concurrences: [], concurrences_in_judgment: [], predicted_author: null, author_explanation: "An equally divided Court affirms without an opinion." },
      costUsd: 0,
      adjustments: [],
      calls: [],
    };
  }

  const lines = [...opinions].map(([j, o]) => `- ${names[j]} (${j}): ${o.vote}, role ${o.role}, confidence ${o.confidence.toFixed(2)}. ${o.brief_reason}`);
  const r = await structuredCall({
    model: MODELS.agent,
    schema: ClerkResultSchema,
    system: SYSTEM,
    effort: "high",
    maxTokens: 8_000,
    content: [
      {
        type: "text",
        text: [
          `<case>${title}</case>`,
          `<decided_by_rule>\noutcome: ${tally.outcome} ${tally.tally.join("–")}\nmajority: ${tally.majority.join(", ")}\ndissent: ${tally.dissent.join(", ") || "none"}\nassigns the opinion: ${tally.assigner}\nauthor candidates: ${tally.authorCandidates.join(", ")}\n</decided_by_rule>`,
          `<forecasts>\n${lines.join("\n")}\n</forecasts>`,
          termContext ? `<term_context>\n${termContext}\n</term_context>` : "",
          "Use the justices' slugs in your answer.",
        ].filter(Boolean).join("\n\n"),
      },
    ],
  });

  // Hold the model to the rule-decided line-up rather than trusting it.
  const adjustments: string[] = [];
  const majority = new Set(tally.majority);
  const keep = (list: string[], label: string) =>
    list.filter((j) => {
      if (majority.has(j)) return true;
      adjustments.push(`${j} is not in the majority; dropped from ${label}`);
      return false;
    });
  const result: ClerkResult = {
    ...r.data,
    joins_majority: keep(r.data.joins_majority, "joiners"),
    concurrences: keep(r.data.concurrences, "concurrences"),
    concurrences_in_judgment: keep(r.data.concurrences_in_judgment, "concurrences in the judgment"),
  };
  const grouped = new Set([...result.joins_majority, ...result.concurrences, ...result.concurrences_in_judgment]);
  for (const j of tally.majority) if (!grouped.has(j)) { result.joins_majority.push(j); adjustments.push(`${j} was not grouped; listed as joining`); }
  if (!result.predicted_author || !tally.authorCandidates.includes(result.predicted_author)) {
    adjustments.push(`predicted author ${result.predicted_author ?? "none"} is not a candidate; using the assigner`);
    result.predicted_author = tally.authorCandidates.includes(tally.assigner!) ? tally.assigner : tally.authorCandidates[0] ?? null;
  }
  return { tally, result, costUsd: r.costUsd, adjustments, calls: [{ model: r.model, usage: r.usage, costUsd: r.costUsd }] };
}
