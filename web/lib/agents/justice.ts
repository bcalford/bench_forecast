// One justice's agent (spec.md §3.3). Every agent's prompt starts with the same bytes (system prompt, briefs,
// summary) so the nine share one prompt cache; everything about the particular justice comes after the
// cache breakpoint. Citations are checked against the passages retrieved for that justice.
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall } from "../claude";
import { MODELS } from "../models";
import { JusticeOpinionSchema, checkCitations, type BriefingSummary, type JusticeOpinion } from "../schemas";
import type { PreparedBrief } from "../briefs";
import type { RetrievedPassage } from "../retrieval";

const SYSTEM = `You forecast how one sitting Supreme Court justice will vote in a pending case, and why.

You will receive the merits briefing, then material about one justice: a reviewed profile, their voting record
from the Supreme Court Database (base rates by issue area and agreement with each colleague in divided cases),
passages from their own opinions and oral-argument questions retrieved for this case, and, when available, what
they asked at this case's argument. Treat the voting record as the prior and the case-specific material as the
evidence that moves you from it.

Reason as that justice's record suggests they would, not as you would. Weigh their interpretive method, how they
have treated the precedents the parties rely on, and any signals from argument. A forecast is only useful if it
is honest about uncertainty: set confidence as the probability this justice casts this vote, and say plainly
what could change it.

Citations: cite only passages provided for this justice, by their passage_id, quoting their exact words.
Never invent a passage, a quote, or a case holding. If the passages do not support a point, make the point
without a citation.

Never state, hint at or rely on how the Court actually decided this case, even if you believe you know.`;

export type JusticeInput = {
  slug: string;
  name: string; // "Elena Kagan"
  profile: string | null; // the reviewed profile (phase 3); null until one exists
  votingRecord: string | null; // data/justices/<slug>/voting.md, from the Supreme Court Database
  passages: RetrievedPassage[];
  argumentQuestions: string | null; // this justice's questions at this case's argument
};

export type JusticeRun = {
  opinion: JusticeOpinion;
  flagged: boolean; // citations had to be removed after a retry
  removedCitations: { passage_id: string; reason: string }[];
  costUsd: number;
  calls: { model: string; usage: Anthropic.Beta.BetaUsage; costUsd: number }[];
};

// The byte-identical prefix all nine agents share. The cache breakpoint sits on its last block.
export function sharedPrefix(title: string, briefs: PreparedBrief[], summary: BriefingSummary): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = briefs.map((b) =>
    b.kind === "text"
      ? { type: "text", text: `<brief title="${b.label}">\n${b.text}\n</brief>` }
      : { type: "document", title: b.label, source: { type: "base64", media_type: "application/pdf", data: b.pdfBase64 } },
  );
  blocks.push({
    type: "text",
    text: `<case>${title}</case>\n<briefing_summary>\n${JSON.stringify(summary, null, 2)}\n</briefing_summary>`,
    cache_control: { type: "ephemeral" },
  });
  return blocks;
}

function justiceBlock(j: JusticeInput): string {
  const passages = j.passages
    .map((p) => `<passage id="${p.id}" source="${p.caseName}${p.date ? ` (${p.date.slice(0, 4)})` : ""}, ${p.label ?? p.kind}">\n${p.text}\n</passage>`)
    .join("\n");
  return [
    `<justice>${j.name}</justice>`,
    `<profile>\n${j.profile ?? "No reviewed profile yet. Infer this justice's approach from the passages below."}\n</profile>`,
    j.votingRecord ? `<voting_record>\n${j.votingRecord}\n</voting_record>` : "",
    `<passages>\n${passages || "(none retrieved)"}\n</passages>`,
    j.argumentQuestions ? `<argument_questions>\n${j.argumentQuestions}\n</argument_questions>` : "<argument_questions>This case has not been argued, or no transcript was provided.</argument_questions>",
    `Forecast ${j.name}'s vote in this case.`,
  ].filter(Boolean).join("\n\n");
}

export async function runJustice(prefix: Anthropic.Beta.BetaContentBlockParam[], j: JusticeInput, onStarted?: () => void): Promise<JusticeRun> {
  const retrieved = new Map(j.passages.map((p) => [p.id, p.text]));
  const calls: JusticeRun["calls"] = [];
  const ask = async (extra?: string) => {
    const r = await structuredCall({
      model: MODELS.agent,
      schema: JusticeOpinionSchema,
      system: SYSTEM,
      content: [...prefix, { type: "text", text: justiceBlock(j) + (extra ? `\n\n${extra}` : "") }],
      effort: "high",
      onStarted,
    });
    calls.push({ model: r.model, usage: r.usage, costUsd: r.costUsd });
    return r.data;
  };

  let opinion = await ask();
  let check = checkCitations(opinion, retrieved);
  if (check.invalid.length) {
    // spec.md §3.3: one retry, naming what failed.
    const problems = check.invalid.map((x) => `- passage_id ${x.citation.passage_id}: ${x.reason}`).join("\n");
    opinion = await ask(`Your previous answer had citations that could not be verified:\n${problems}\nCite only the passages above, quoting them exactly.`);
    check = checkCitations(opinion, retrieved);
  }
  const flagged = check.invalid.length > 0;
  return {
    opinion: { ...opinion, citations: check.valid },
    flagged,
    removedCitations: check.invalid.map((x) => ({ passage_id: x.citation.passage_id, reason: x.reason })),
    costUsd: calls.reduce((s, c) => s + c.costUsd, 0),
    calls,
  };
}

// Fan-out: start one agent, wait until its response begins streaming (its cache write is then readable),
// then start the rest so they read the shared prefix from cache instead of each writing it.
export async function runBench(prefix: Anthropic.Beta.BetaContentBlockParam[], justices: JusticeInput[]): Promise<Map<string, JusticeRun | Error>> {
  const results = new Map<string, JusticeRun | Error>();
  if (!justices.length) return results;
  const [first, ...rest] = justices;
  let started!: () => void;
  const warm = new Promise<void>((resolve) => (started = resolve));
  const firstRun = runJustice(prefix, first, started).then(
    (r) => results.set(first.slug, r),
    (e) => { results.set(first.slug, e as Error); started(); },
  );
  await warm;
  await Promise.all([
    firstRun,
    ...rest.map((j) => runJustice(prefix, j).then((r) => results.set(j.slug, r), (e) => results.set(j.slug, e as Error))),
  ]);
  return results;
}
