// Shapes a forecast from the database into what the pages draw. Server-side only (service-role client).
import { cache } from "react";
import { serviceClient } from "./supabase";
import { tallyVotes, type JusticeVote } from "./clerk-rules";
import { justices, byslug, DISPOSITION_WORD, type SeatVote } from "./court";
import type { BriefingSummary } from "./schemas";
import { labelVotes, type VoteLabels } from "./vote-labels";

export type CitationView = { passage_id: string; quote: string; why: string; case_name: string | null; date: string | null; label: string | null; url: string | null };

export type VoteView = SeatVote & {
  disposition: string; // "To reverse"
  roleKey: string; // majority | concur | concur_judgment | dissent
  briefReason: string;
  detailedReason: string;
  citations: CitationView[];
  flagged: boolean;
};

export type ForecastView = {
  id: string;
  title: string;
  docket: string | null;
  term: string;
  petitioner: string;
  respondent: string;
  phase: string; // "Before argument" | "After argument"
  stage: string;
  status: string;
  error: string | null;
  fairTest: boolean; // false when the case was decided before the models' training cutoff
  lockedAt: string | null; // formatted, Eastern time
  outcome: string | null;
  tally: [number, number];
  author: string | null;
  authorRationale: string | null;
  summary: BriefingSummary | null;
  votes: Record<string, VoteView>;
  arrival: string[]; // slugs in the order their votes landed
  sitting: string[];
  recused: string[];
  concurring: string[];
  dissenting: string[];
  sideLabels: VoteLabels["sideLabels"]; // "Majority"/"Dissent", or each side's vote on an evenly divided Court
};

export const formatEt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"
    : null;

type VoteRow = { justice: string; vote: string; confidence: number | string; role: string; brief_reason: string; detailed_reason: string; citations: CitationView[]; flagged: boolean; created_at: string };

// Cached per request, so the page and its metadata share one read.
export const loadForecast = cache(async (id: string): Promise<ForecastView | null> => {
  const db = serviceClient();
  const { data: p } = await db
    .from("predictions")
    .select("id, case_id, phase, stage, status, error, locked_at, outcome, majority_count, minority_count, author_pred, clerk_rationale, summary_json")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  const [{ data: c }, { data: rows }] = await Promise.all([
    db.from("cases").select("title, docket, term, recused, decided_before_cutoff").eq("id", p.case_id).single(),
    db.from("justice_votes").select("justice, vote, confidence, role, brief_reason, detailed_reason, citations, flagged, created_at").eq("prediction_id", id).order("created_at"),
  ]);
  if (!c) return null;
  const voteRows = (rows ?? []) as VoteRow[];

  // Sides come from the same rules the clerk used; while votes are still arriving they are provisional.
  const seniority = Object.fromEntries(justices.map((j) => [j.slug, j.seniority]));
  const tally = tallyVotes(
    voteRows.map((r): JusticeVote => ({ justice: r.justice, vote: r.vote as JusticeVote["vote"], role: r.role as JusticeVote["role"], confidence: Number(r.confidence) })),
    seniority,
  );
  const author = p.author_pred as string | null;
  const labels = labelVotes(voteRows.map((r) => ({ justice: r.justice, vote: r.vote as JusticeVote["vote"], role: r.role as JusticeVote["role"] })), tally, author);

  const votes: Record<string, VoteView> = {};
  for (const r of voteRows) {
    votes[r.justice] = {
      ...labels.votes[r.justice],
      confidence: Number(r.confidence),
      disposition: DISPOSITION_WORD[r.vote] ?? r.vote,
      briefReason: r.brief_reason,
      detailedReason: r.detailed_reason,
      citations: r.citations ?? [],
      flagged: r.flagged,
    };
  }

  const recused: string[] = c.recused ?? [];
  const sitting = justices.map((j) => j.slug).filter((s) => !recused.includes(s));
  const [petitioner, respondent] = (c.title as string).split(/\s+v\.\s+/);
  return {
    id: p.id,
    title: c.title,
    docket: c.docket,
    term: c.term,
    petitioner: petitioner ?? c.title,
    respondent: respondent ?? "",
    phase: p.phase === "after_argument" ? "After argument" : "Before argument",
    stage: p.stage,
    status: p.status,
    error: p.error,
    fairTest: !c.decided_before_cutoff,
    lockedAt: formatEt(p.locked_at),
    outcome: p.outcome ?? (voteRows.length ? tally.outcome : null),
    tally: p.majority_count != null ? [p.majority_count, p.minority_count] : tally.tally,
    author,
    authorRationale: p.clerk_rationale,
    summary: (p.summary_json as BriefingSummary | null) ?? null,
    votes,
    arrival: voteRows.map((r) => r.justice),
    sitting,
    recused,
    concurring: labels.concurring,
    dissenting: labels.dissenting,
    sideLabels: labels.sideLabels,
  };
});

export const lastName = (slug: string) => byslug[slug]?.last ?? slug;

export type ForecastRow = { id: string; title: string; docket: string | null; term: string; phase: string; outcome: string | null; tally: [number, number]; status: string; lockedAt: string | null; fairTest: boolean };

// Every forecast, newest first: locked ones with their result, running ones as in progress. Failed runs are left out.
export async function listForecasts(): Promise<ForecastRow[]> {
  const db = serviceClient();
  const { data } = await db
    .from("predictions")
    .select("id, phase, status, outcome, majority_count, minority_count, locked_at, created_at, cases!inner(title, docket, term, decided_before_cutoff)")
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(100);
  type Row = { id: string; phase: string; status: string; outcome: string | null; majority_count: number | null; minority_count: number | null; locked_at: string | null; cases: { title: string; docket: string | null; term: string; decided_before_cutoff: boolean } };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, title: r.cases.title, docket: r.cases.docket, term: r.cases.term,
    phase: r.phase === "after_argument" ? "After argument" : "Before argument",
    outcome: r.outcome, tally: [r.majority_count ?? 0, r.minority_count ?? 0], status: r.status, lockedAt: formatEt(r.locked_at), fairTest: !r.cases.decided_before_cutoff,
  }));
}
