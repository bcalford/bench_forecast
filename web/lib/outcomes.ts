// Outcomes and scores in the database. The reading and scoring logic is pure (lib/decisions.ts, lib/scoring.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vote } from "./clerk-rules";
import { justices } from "./court";
import { normalizeDocket } from "./court-site";
import type { Judgment, Reading } from "./decisions";
import { lockedBeforeDecision, scoreForecast } from "./scoring";

export const SCORED_TERM = "October Term 2026";
const SENIORITY = Object.fromEntries(justices.map((j) => [j.slug, j.seniority]));
const ok = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

// Cases in the term with a locked forecast and no outcome yet.
export async function awaitingOutcome(db: SupabaseClient, term: number) {
  const cases = ok(await db.from("cases").select("id, docket, predictions!inner(status), outcomes(case_id)")
    .eq("term", `October Term ${term}`).eq("predictions.status", "locked")) as { id: string; docket: string | null; outcomes: unknown }[];
  return cases
    .filter((c) => c.docket && !(Array.isArray(c.outcomes) ? c.outcomes.length : c.outcomes))
    .map((c) => ({ caseId: c.id, docket: normalizeDocket(c.docket!) }))
    .filter((c) => c.docket);
}

export async function saveOutcome(db: SupabaseClient, caseId: string, r: Reading, decidedAt: string, sourceUrl: string | null) {
  ok(await db.from("outcomes").upsert({
    case_id: caseId, decided_at: decidedAt, outcome: r.outcome, votes: r.votes, author: r.author,
    status: r.clean ? "scored" : "needs_review", source_url: sourceUrl, notes: r.reasons.join("; ") || null,
  }));
}

// A judgment "in part" is not its first word: "Affirmed in part, reversed in part" is other.
export const judgmentOfOutcome = (outcome: string): Judgment =>
  /\bin part\b/i.test(outcome) ? "other"
    : /^affirmed/i.test(outcome) ? "affirm" : /^reversed/i.test(outcome) ? "reverse" : /^vacated/i.test(outcome) ? "vacate_remand" : "other";

// Why the owner can't simply confirm a held reading: it must name every sitting justice, and a judgment
// in part or several judgments need `set`. Recusals aren't stored, so the owner names them.
export function confirmProblems(o: { outcome: string; votes: Record<string, string>; notes: string | null }, recused: string[]): string[] {
  const problems: string[] = [];
  for (const s of recused) if (!(s in SENIORITY)) problems.push(`unknown justice "${s}"`);
  for (const s of recused) if (s in o.votes) problems.push(`${s} has a vote but was named as recused`);
  const missing = justices.map((j) => j.slug).filter((s) => !(s in o.votes) && !recused.includes(s));
  if (missing.length) problems.push(`no vote read for ${missing.join(", ")}; name recusals with --recused, or use set`);
  if (judgmentOfOutcome(o.outcome) === "other") problems.push(`judgment "${o.outcome}" can't be scored as read; use set`);
  if (/more than one judgment/.test(o.notes ?? "")) problems.push("more than one judgment; use set");
  return problems;
}

// Which locked forecasts to score and which old scores to clear: a corrected date, an outcome sent back to
// review, or a case outside the scored term must not leave a stale score behind.
export function scoringPlan<P extends { id: string; locked_at: string }>(
  preds: P[], outcome: { decided_at: string; status: string }, c: { term: string; decided_before_cutoff: boolean },
): { score: P[]; clear: string[] } {
  const scorable = outcome.status === "scored" && c.term === SCORED_TERM && !c.decided_before_cutoff;
  const score = scorable ? preds.filter((p) => lockedBeforeDecision(p.locked_at, outcome.decided_at)) : [];
  return { score, clear: preds.filter((p) => !score.includes(p)).map((p) => p.id) };
}

// Scores every eligible forecast on the case and clears the rest; upserts, so a corrected outcome rescores.
// Returns rows written.
export async function scoreCase(db: SupabaseClient, caseId: string): Promise<number> {
  const outcome = ok(await db.from("outcomes").select("decided_at, outcome, votes, author, status").eq("case_id", caseId).single()) as
    { decided_at: string; outcome: string; votes: Record<string, Vote>; author: string | null; status: string };
  const c = ok(await db.from("cases").select("term, decided_before_cutoff").eq("id", caseId).single()) as { term: string; decided_before_cutoff: boolean };
  const all = ok(await db.from("predictions").select("id, locked_at, author_pred").eq("case_id", caseId).eq("status", "locked")) as
    { id: string; locked_at: string; author_pred: string | null }[];
  const { score: preds, clear } = scoringPlan(all, outcome, c);
  if (clear.length) ok(await db.from("scores").delete().in("prediction_id", clear));
  let written = 0;
  for (const p of preds) {
    const rows = ok(await db.from("justice_votes").select("justice, vote, confidence").eq("prediction_id", p.id)) as { justice: string; vote: Vote; confidence: number }[];
    const s = scoreForecast(
      { votes: Object.fromEntries(rows.map((r) => [r.justice, r.vote])), confidence: Object.fromEntries(rows.map((r) => [r.justice, Number(r.confidence)])), author: p.author_pred },
      { judgment: judgmentOfOutcome(outcome.outcome), votes: outcome.votes, author: outcome.author }, SENIORITY);
    ok(await db.from("scores").upsert({
      prediction_id: p.id, outcome_correct: s.outcomeCorrect, votes_correct: s.votesCorrect, votes_total: s.votesTotal,
      majority_correct: s.majorityCorrect, author_correct: s.authorCorrect,
    }));
    written++;
  }
  return written;
}
