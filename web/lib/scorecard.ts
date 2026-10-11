// The scorecard's data shape and arithmetic (spec §4). Pure: lib/scorecard-data.ts loads real cases into it,
// lib/sample-season.ts builds the synthetic preview in the same shape.
import type { Vote } from "./clerk-rules";
import { justices } from "./court";
import type { Judgment } from "./decisions";
import { lockedBeforeDecision, scoreForecast } from "./scoring";

export type Disposition = "Affirm" | "Reverse" | "Vacate" | "Other";
export type ScoredVote = { slug: string; confidence: number; voteRight: boolean; majorityRight: boolean };
export type ScoredCase = {
  id: string | null; docket: string; title: string; phase: "Before argument" | "After argument"; locked: string; decided: string;
  predicted: { disposition: Disposition; tally: [number, number]; author: string | null; votes: Record<string, { side: Disposition; confidence: number }> };
  actual: { disposition: Disposition; tally: [number, number]; author: string | null };
  outcomeRight: boolean; authorRight: boolean | null; votes: ScoredVote[];
};
export type ScoredInput = {
  id: string; docket: string; title: string; phase: string; lockedAt: string; predictedOutcome: string; tally: [number, number];
  author: string | null; votes: { justice: string; vote: string; confidence: number }[];
  decidedAt: string; outcome: string; actualVotes: Record<string, string>; actualAuthor: string | null;
};

const SENIORITY = Object.fromEntries(justices.map((j) => [j.slug, j.seniority]));
const VOTE_DISPOSITION: Record<string, Disposition> = { affirm: "Affirm", reverse: "Reverse", vacate_remand: "Vacate", other: "Other" };
const JUDGMENT: Record<Disposition, Judgment> = { Affirm: "affirm", Reverse: "reverse", Vacate: "vacate_remand", Other: "other" };

export const dispositionOf = (text: string): Disposition =>
  /^affirmed/i.test(text) ? "Affirm" : /^reversed/i.test(text) ? "Reverse" : /^vacated/i.test(text) ? "Vacate" : "Other";

const shortDate = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });

export function buildScoredCase(i: ScoredInput): ScoredCase {
  const predVotes = Object.fromEntries(i.votes.map((v) => [v.justice, v.vote as Vote]));
  const confidence = Object.fromEntries(i.votes.map((v) => [v.justice, Number(v.confidence)]));
  const actualDisposition = dispositionOf(i.outcome);
  const s = scoreForecast({ votes: predVotes, confidence, author: i.author },
    { judgment: JUDGMENT[actualDisposition], votes: i.actualVotes as Record<string, Vote>, author: i.actualAuthor }, SENIORITY);
  const withJudgment = Object.values(i.actualVotes).filter((v) => (v === "affirm") === (actualDisposition === "Affirm")).length;
  return {
    id: i.id, docket: i.docket, title: i.title,
    phase: i.phase === "after_argument" ? "After argument" : "Before argument",
    locked: shortDate(i.lockedAt, "America/New_York"), decided: shortDate(`${i.decidedAt}T12:00:00Z`, "UTC"),
    predicted: {
      disposition: dispositionOf(i.predictedOutcome), tally: i.tally, author: i.author,
      votes: Object.fromEntries(i.votes.map((v) => [v.justice, { side: VOTE_DISPOSITION[v.vote] ?? "Other", confidence: Number(v.confidence) }])),
    },
    actual: { disposition: actualDisposition, tally: [withJudgment, Object.keys(i.actualVotes).length - withJudgment], author: i.actualAuthor },
    outcomeRight: s.outcomeCorrect, authorRight: s.authorCorrect,
    votes: s.justices.map((j) => ({ slug: j.slug, confidence: j.confidence ?? 0, voteRight: j.voteRight, majorityRight: j.majorityRight })),
  };
}

export function seasonRecord(cases: ScoredCase[]) {
  const votes = cases.flatMap((c) => c.votes);
  const authored = cases.filter((c) => c.authorRight !== null);
  return {
    n: cases.length, outcomeRight: cases.filter((c) => c.outcomeRight).length,
    votes: votes.length, voteRight: votes.filter((v) => v.voteRight).length, majorityRight: votes.filter((v) => v.majorityRight).length,
    authorN: authored.length, authorRight: authored.filter((c) => c.authorRight).length,
  };
}

export function perJustice(cases: ScoredCase[]) {
  const out: Record<string, { right: number; n: number }> = {};
  for (const v of cases.flatMap((c) => c.votes)) {
    out[v.slug] ??= { right: 0, n: 0 };
    out[v.slug].n++;
    if (v.voteRight) out[v.slug].right++;
  }
  return out;
}

export function byPhase(cases: ScoredCase[]) {
  return (["Before argument", "After argument"] as const).map((phase) => {
    const cs = cases.filter((c) => c.phase === phase);
    const vs = cs.flatMap((c) => c.votes);
    return { phase, n: cs.length, outcomeRight: cs.filter((c) => c.outcomeRight).length, votes: vs.length, voteRight: vs.filter((v) => v.voteRight).length };
  });
}

// Splits locked forecasts into scored and waiting. One locked on or after its decision day is in neither:
// only forecasts locked before their decision count, whether or not the outcome has been reviewed yet.
export function partitionForecasts<R extends { locked_at: string; cases: { outcomes: { decided_at: string; status: string } | null } }>(
  rows: R[],
): { scored: R[]; waiting: R[] } {
  const fair = rows.filter((r) => !r.cases.outcomes || lockedBeforeDecision(r.locked_at, r.cases.outcomes.decided_at));
  return {
    scored: fair.filter((r) => r.cases.outcomes?.status === "scored"),
    waiting: fair.filter((r) => r.cases.outcomes?.status !== "scored"),
  };
}
