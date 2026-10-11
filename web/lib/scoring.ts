// Scoring a locked forecast against the Court's decision (spec §3). Pure functions; lib/outcomes.ts stores
// the results and lib/scorecard.ts reuses them for the page.
import { sideOf, tallyVotes, type Seniority, type Vote } from "./clerk-rules";
import { normalizeDocket } from "./court-site";
import type { Judgment } from "./decisions";

export type ForecastForScoring = { votes: Record<string, Vote>; confidence: Record<string, number>; author: string | null };
export type OutcomeForScoring = { judgment: Judgment; votes: Record<string, Vote>; author: string | null };
export type JusticeScore = { slug: string; predicted: Vote | null; actual: Vote; confidence: number | null; voteRight: boolean; majorityRight: boolean };
export type ForecastScore = {
  outcomeCorrect: boolean; votesCorrect: number; votesTotal: number; majorityCorrect: number; authorCorrect: boolean | null;
  justices: JusticeScore[];
};

type Side = "affirm" | "set_aside" | "other";
const voteSide = (v: Vote): Side => sideOf(v) ?? "other";
const judgmentSide = (j: Judgment): Side => (j === "affirm" ? "affirm" : j === "other" ? "other" : "set_aside");

// The side a forecast's votes come down on; an even split leaves the judgment below in place.
export function predictedJudgmentSide(votes: Record<string, Vote>, seniority: Seniority): "affirm" | "set_aside" {
  const t = tallyVotes(Object.entries(votes).map(([justice, vote]) => ({ justice, vote, role: "majority" as const, confidence: 0.5 })), seniority);
  return t.tie || !t.winningSide ? "affirm" : t.winningSide;
}

export function scoreForecast(f: ForecastForScoring, o: OutcomeForScoring, seniority: Seniority): ForecastScore {
  const predSide = predictedJudgmentSide(f.votes, seniority);
  const actSide = judgmentSide(o.judgment);
  const justices: JusticeScore[] = Object.entries(o.votes)
    .sort(([a], [b]) => (seniority[a] ?? 99) - (seniority[b] ?? 99))
    .map(([slug, actual]) => {
      const predicted = f.votes[slug] ?? null;
      if (!predicted) return { slug, predicted: null, actual, confidence: null, voteRight: false, majorityRight: false };
      return {
        slug, predicted, actual, confidence: f.confidence[slug] ?? null,
        voteRight: voteSide(predicted) === voteSide(actual),
        majorityRight: (voteSide(predicted) === predSide) === (voteSide(actual) === actSide),
      };
    });
  return {
    outcomeCorrect: predSide === actSide,
    votesCorrect: justices.filter((j) => j.voteRight).length,
    votesTotal: justices.length,
    majorityCorrect: justices.filter((j) => j.majorityRight).length,
    authorCorrect: f.author && o.author ? f.author === o.author : null,
    justices,
  };
}

const etDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// Locked on an Eastern calendar day before the decision day.
export const lockedBeforeDecision = (lockedAtIso: string, decidedAt: string) => etDate(lockedAtIso) < decidedAt;

// What counts as one case: its docket number, since each filing creates its own case row; the row id when
// there is no docket number.
export const caseKey = (docket: string | null, caseId: string) => (docket && normalizeDocket(docket)) || caseId;

// One forecast per case for the term totals: the docket forecast if there is one, else the earliest locked.
export function countingForecasts<T extends { caseId: string; origin: string; lockedAt: string }>(fs: T[]): T[] {
  const best = new Map<string, T>();
  for (const f of fs) {
    const cur = best.get(f.caseId);
    const better = !cur
      || (f.origin === "docket" && cur.origin !== "docket")
      || (f.origin === cur.origin && f.lockedAt < cur.lockedAt)
      || (cur.origin !== "docket" && f.origin !== "docket" && f.lockedAt < cur.lockedAt);
    if (better) best.set(f.caseId, f);
  }
  return [...best.values()];
}

export const CALIBRATION_MIN_VOTES = 20;
export type CalibrationBand = { lo: number; hi: number; n: number; stated: number; observed: number };
const BANDS: [number, number][] = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1]];

export function calibration(votes: { confidence: number; voteRight: boolean }[]): CalibrationBand[] {
  return BANDS.map(([lo, hi], i) => {
    const b = votes.filter((v) => (i === 0 ? v.confidence < hi : i === BANDS.length - 1 ? v.confidence >= lo : v.confidence >= lo && v.confidence < hi));
    return {
      lo, hi, n: b.length,
      stated: b.reduce((s, v) => s + v.confidence, 0) / (b.length || 1),
      observed: b.filter((v) => v.voteRight).length / (b.length || 1),
    };
  }).filter((b) => b.n > 0);
}
