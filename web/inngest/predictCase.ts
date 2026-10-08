import { inngest } from "./client";

// The prediction pipeline (spec.md §4). Phase 1 wires the job and its steps;
// each step's real work lands in phase 4 (summarizer, justice agents, validator, clerk).
export const predictCase = inngest.createFunction(
  { id: "predict-case", triggers: [{ event: "case/predict.requested" }] },
  async ({ event, step }) => {
    const { predictionId } = event.data as { predictionId: string };

    await step.run("extract", async () => ({ predictionId, todo: "PDFs to text (Sonnet)" }));
    await step.run("summarize", async () => ({ todo: "briefing summary (Sonnet)" }));
    await step.run("fan-out", async () => ({ todo: "one justice agent per sitting justice (Opus), then citation validator" }));
    await step.run("clerk", async () => ({ todo: "tally, ties and assigner in code; grouping and author in one Opus call" }));
    await step.run("persist-and-lock", async () => ({ todo: "write votes, set locked_at and phase" }));

    return { predictionId, status: "scaffold" };
  }
);

export const functions = [predictCase];
