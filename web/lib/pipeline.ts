// What the prediction job reads and writes (spec.md §4–5). Each function is one unit of work an Inngest step
// can retry on its own; everything returned is plain JSON so it can cross step boundaries.
import { extractText, getDocumentProxy } from "unpdf";
import type Anthropic from "@anthropic-ai/sdk";
import { serviceClient } from "./supabase";
import { ok, withRetry } from "./retry";
import { prepareBrief, type PreparedBrief } from "./briefs";
import type { BriefingSummary, ClerkResult, JusticeOpinion } from "./schemas";
import type { ClerkTally } from "./clerk-rules";
import type { RetrievedPassage } from "./retrieval";
import { justiceTurns } from "./transcripts";

export type Stage = "queued" | "reading" | "summarizing" | "retrieving" | "deliberating" | "clerk" | "locked" | "failed";

export type CaseRecord = {
  id: string;
  title: string;
  docket: string | null;
  term: string;
  input_mode: "briefs" | "description";
  brief_paths: string[];
  description: string | null;
  oa_transcript_path: string | null;
  recused: string[];
};

export type PredictionRecord = { id: string; case_id: string; phase: string; as_of: string | null; status: string; stage: Stage };

const BUCKET = "briefs";

export async function loadPrediction(predictionId: string): Promise<{ prediction: PredictionRecord; caseRecord: CaseRecord }> {
  const db = serviceClient();
  const prediction = (await withRetry("load prediction", () =>
    ok(db.from("predictions").select("id, case_id, phase, as_of, status, stage").eq("id", predictionId).single()),
  )) as PredictionRecord;
  const caseRecord = (await withRetry("load case", () =>
    ok(db.from("cases").select("id, title, docket, term, input_mode, brief_paths, description, oa_transcript_path, recused").eq("id", prediction.case_id).single()),
  )) as CaseRecord;
  return { prediction, caseRecord };
}

export async function setStage(predictionId: string, stage: Stage, extra: Record<string, unknown> = {}) {
  const status = stage === "locked" ? "locked" : stage === "failed" ? "failed" : stage === "queued" ? "queued" : "running";
  await withRetry("set stage", () => ok(serviceClient().from("predictions").update({ stage, status, ...extra }).eq("id", predictionId)));
}

async function download(path: string): Promise<Uint8Array> {
  const blob = await withRetry(`download ${path}`, () => ok(serviceClient().storage.from(BUCKET).download(path)));
  if (!blob) throw new Error(`Missing file in storage: ${path}`);
  return new Uint8Array(await blob.arrayBuffer());
}

// Brief text is extracted deterministically, so every step that needs it can re-derive identical bytes
// (which the shared prompt cache depends on) instead of passing large text between steps.
export async function loadBriefs(c: CaseRecord): Promise<PreparedBrief[]> {
  const out: PreparedBrief[] = [];
  for (const path of c.brief_paths) {
    const label = path.split("/").pop()!.replace(/\.pdf$/i, "").replace(/^\d+-/, "").replace(/[-_]/g, " ");
    out.push(await prepareBrief(label, await download(path)));
  }
  return out;
}

export async function loadArgumentTurns(c: CaseRecord): Promise<Record<string, string>> {
  if (!c.oa_transcript_path) return {};
  const { text } = await extractText(await getDocumentProxy(await download(c.oa_transcript_path)), { mergePages: false });
  return Object.fromEntries(Object.entries(justiceTurns(text as string[])).map(([slug, t]) => [slug, t.text]));
}

export async function recordSpend(predictionId: string, calls: { model: string; usage: Anthropic.Beta.BetaUsage | Anthropic.Usage; costUsd: number }[]) {
  if (!calls.length) return;
  const rows = calls.map((c) => ({
    prediction_id: predictionId,
    model: c.model,
    input_tokens: (c.usage.input_tokens ?? 0) + (c.usage.cache_creation_input_tokens ?? 0) + (c.usage.cache_read_input_tokens ?? 0),
    output_tokens: c.usage.output_tokens ?? 0,
    cost_usd: Number(c.costUsd.toFixed(4)),
  }));
  await withRetry("spend ledger", () => ok(serviceClient().from("spend_ledger").insert(rows)));
}

export async function saveSummary(predictionId: string, summary: BriefingSummary) {
  await withRetry("save summary", () => ok(serviceClient().from("predictions").update({ summary_json: summary }).eq("id", predictionId)));
}

// One justice's forecast, written the moment it is ready so the run page fills in seat by seat (Realtime).
export async function saveVote(
  predictionId: string,
  justice: string,
  opinion: JusticeOpinion,
  passages: RetrievedPassage[],
  flagged: boolean,
) {
  const byId = new Map(passages.map((p) => [p.id, p]));
  const citations = opinion.citations.map((c) => {
    const p = byId.get(c.passage_id);
    return { ...c, case_name: p?.caseName ?? null, date: p?.date ?? null, label: p?.label ?? null, url: p?.url ?? null };
  });
  await withRetry("save vote", () =>
    ok(
      serviceClient()
        .from("justice_votes")
        .upsert(
          {
            prediction_id: predictionId,
            justice,
            vote: opinion.vote,
            confidence: Number(opinion.confidence.toFixed(3)),
            role: opinion.role,
            brief_reason: opinion.brief_reason,
            detailed_reason: opinion.detailed_reason,
            citations,
            flagged,
          },
          { onConflict: "prediction_id,justice" },
        ),
    ),
  );
}

export async function lockPrediction(predictionId: string, tally: ClerkTally, clerk: ClerkResult, rationale: string) {
  const { data: spend } = await serviceClient().from("spend_ledger").select("cost_usd").eq("prediction_id", predictionId);
  const cost = (spend ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  await setStage(predictionId, "locked", {
    locked_at: new Date().toISOString(),
    outcome: tally.outcome,
    majority_count: tally.tally[0],
    minority_count: tally.tally[1],
    author_pred: clerk.predicted_author,
    clerk_rationale: rationale,
    cost_usd: Number(cost.toFixed(4)),
    error: null,
  });
  return cost;
}
