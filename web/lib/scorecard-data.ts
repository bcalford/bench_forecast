// Loads the scorecard from the database (spec §3–4): scored OT2026 forecasts and the waiting list.
import { cache } from "react";
import { buildScoredCase, type ScoredCase } from "./scorecard";
import { caseKey, countingForecasts, lockedBeforeDecision } from "./scoring";
import { SCORED_TERM } from "./outcomes";
import { serviceClient } from "./supabase";
import { formatEt } from "./views";

export type WaitingRow = { id: string; docket: string | null; title: string; phase: string; lockedAt: string | null; outcome: string | null; tally: [number, number]; review: boolean };

type Row = {
  id: string; case_id: string; phase: string; origin: string; locked_at: string; outcome: string; majority_count: number; minority_count: number; author_pred: string | null;
  cases: { title: string; docket: string | null; term: string; decided_before_cutoff: boolean; outcomes: { decided_at: string; outcome: string; votes: Record<string, string>; author: string | null; status: string } | null };
  justice_votes: { justice: string; vote: string; confidence: number }[];
};

export const loadScorecard = cache(async (): Promise<{ counted: ScoredCase[]; all: ScoredCase[]; waiting: WaitingRow[] }> => {
  const { data, error } = await serviceClient()
    .from("predictions")
    .select("id, case_id, phase, origin, locked_at, outcome, majority_count, minority_count, author_pred, cases!inner(title, docket, term, decided_before_cutoff, outcomes(decided_at, outcome, votes, author, status)), justice_votes(justice, vote, confidence)")
    .eq("status", "locked").eq("cases.term", SCORED_TERM).eq("cases.decided_before_cutoff", false)
    .order("locked_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  const scoredRows = rows.filter((r) => r.cases.outcomes?.status === "scored" && lockedBeforeDecision(r.locked_at, r.cases.outcomes.decided_at));
  const toCase = (r: Row) => buildScoredCase({
    id: r.id, docket: r.cases.docket ?? "—", title: r.cases.title, phase: r.phase, lockedAt: r.locked_at,
    predictedOutcome: r.outcome, tally: [r.majority_count, r.minority_count], author: r.author_pred, votes: r.justice_votes,
    decidedAt: r.cases.outcomes!.decided_at, outcome: r.cases.outcomes!.outcome, actualVotes: r.cases.outcomes!.votes, actualAuthor: r.cases.outcomes!.author,
  });
  const all = scoredRows.map(toCase);
  const countedIds = new Set(countingForecasts(scoredRows.map((r) => ({ id: r.id, caseId: caseKey(r.cases.docket, r.case_id), origin: r.origin, lockedAt: r.locked_at }))).map((f) => f.id));
  const counted = all.filter((c) => countedIds.has(c.id!));

  const waiting = rows.filter((r) => r.cases.outcomes?.status !== "scored").map((r) => ({
    id: r.id, docket: r.cases.docket, title: r.cases.title, phase: r.phase === "after_argument" ? "After argument" : "Before argument",
    lockedAt: formatEt(r.locked_at), outcome: r.outcome, tally: [r.majority_count, r.minority_count] as [number, number],
    review: r.cases.outcomes?.status === "needs_review",
  }));
  return { counted, all, waiting };
});
