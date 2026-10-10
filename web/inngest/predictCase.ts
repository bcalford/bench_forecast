// The prediction job (spec.md §4). Each step is retried on its own, so a failure late in a run never repeats
// the paid work before it. Progress is written to `predictions.stage` and each vote to `justice_votes` as it
// lands, which the run page follows over Supabase Realtime.
import { inngest } from "./client";
import { ROSTER } from "@/lib/roster.generated";
import { summarizeBriefing } from "@/lib/agents/summarizer";
import { runJustice, sharedPrefix, type JusticeInput } from "@/lib/agents/justice";
import { runClerk } from "@/lib/agents/clerk";
import { embedQueries } from "@/lib/embedding";
import { retrieveForJustice, type RetrievedPassage } from "@/lib/retrieval";
import {
  loadArgumentTurns, loadBriefs, loadPrediction, lockPrediction, recordSpend, saveSummary, saveVote, setStage,
} from "@/lib/pipeline";
import type { BriefingSummary, JusticeOpinion } from "@/lib/schemas";

type Event = { data: { predictionId: string } };

export const predictCase = inngest.createFunction(
  {
    id: "predict-case",
    triggers: [{ event: "case/predict.requested" }],
    retries: 2, // per step; agent steps are expensive, so keep this low
    onFailure: async ({ event, error }) => {
      const predictionId = (event.data.event as Event).data.predictionId;
      await setStage(predictionId, "failed", { error: error.message.slice(0, 500) });
    },
  },
  async ({ event, step }) => {
    const { predictionId } = event.data as Event["data"];
    const { prediction, caseRecord } = await step.run("load", () => loadPrediction(predictionId));
    const asOf = prediction.as_of ?? new Date().toISOString().slice(0, 10);

    // 1. Summary (Sonnet).
    const summary: BriefingSummary = await step.run("summarize", async () => {
      await setStage(predictionId, "summarizing");
      const briefs = caseRecord.input_mode === "briefs" ? await loadBriefs(caseRecord) : [];
      const r = briefs.length
        ? await summarizeBriefing({ title: caseRecord.title, briefs })
        : await summarizeBriefing({ title: caseRecord.title, description: caseRecord.description ?? "" });
      await saveSummary(predictionId, r.data);
      await recordSpend(predictionId, [{ model: r.model, usage: r.usage, costUsd: r.costUsd }]);
      return r.data;
    });

    // 2. Retrieval, one justice at a time (the database times out under a wider burst; decisions.md Q25).
    const sitting = ROSTER.filter((j) => j.active && !caseRecord.recused.includes(j.slug));
    const queries = [summary.question_presented, ...summary.issues];
    await step.run("stage-retrieving", () => setStage(predictionId, "retrieving"));
    const queryEmbeddings = await step.run("embed-queries", () => embedQueries(queries));
    const passages: Record<string, RetrievedPassage[]> = {};
    for (const j of sitting) {
      passages[j.slug] = await step.run(`retrieve-${j.slug}`, () =>
        retrieveForJustice(j.slug, queries, { queryEmbeddings, excludeDocket: caseRecord.docket ?? undefined, before: asOf }),
      );
    }
    const turns = await step.run("argument-turns", () => loadArgumentTurns(caseRecord));

    // 3. Justice agents (Opus). The first runs alone and writes the shared briefs+summary prompt cache;
    //    the other eight then run in parallel while that cache is warm.
    await step.run("stage-deliberating", () => setStage(predictionId, "deliberating"));
    const agent = (slug: string) =>
      step.run(`justice-${slug}`, async () => {
        const j = sitting.find((x) => x.slug === slug)!;
        const briefs = caseRecord.input_mode === "briefs" ? await loadBriefs(caseRecord) : [];
        const input: JusticeInput = {
          slug, name: j.name, profile: j.profile, votingRecord: j.votingRecord,
          passages: passages[slug], argumentQuestions: turns[slug] ?? null,
        };
        const run = await runJustice(sharedPrefix(caseRecord.title, briefs, summary), input);
        await saveVote(predictionId, slug, run.opinion, passages[slug], run.flagged);
        await recordSpend(predictionId, run.calls);
        return run.opinion;
      });
    const [first, ...rest] = sitting.map((j) => j.slug);
    const opinions = new Map<string, JusticeOpinion>();
    opinions.set(first, await agent(first));
    const others = await Promise.all(rest.map((slug) => agent(slug)));
    rest.forEach((slug, i) => opinions.set(slug, others[i]));

    // 4. Clerk: tally and assigner in code, grouping and author in one Opus call; then lock.
    const result = await step.run("clerk-and-lock", async () => {
      await setStage(predictionId, "clerk");
      const names = Object.fromEntries(ROSTER.map((j) => [j.slug, j.name]));
      const seniority = Object.fromEntries(ROSTER.map((j) => [j.slug, j.seniority_rank]));
      const clerk = await runClerk(caseRecord.title, opinions, names, seniority, null);
      await recordSpend(predictionId, clerk.calls);
      const cost = await lockPrediction(predictionId, clerk.tally, clerk.result, clerk.result.author_explanation);
      return { outcome: clerk.tally.outcome, tally: clerk.tally.tally, author: clerk.result.predicted_author, costUsd: cost };
    });

    return { predictionId, ...result };
  },
);

export const functions = [predictCase];
