// The clerk's deterministic rules (spec.md §3.4): tally, outcome, the equally-divided rule and who assigns
// the opinion. Pure functions over the justice agents' votes; the grouping of concurrences and the author
// prediction are left to one model call that receives this result.

export type Vote = "affirm" | "reverse" | "vacate_remand" | "other";
export type Role = "majority" | "concur" | "concur_judgment" | "dissent";

export type JusticeVote = { justice: string; vote: Vote; role: Role; confidence: number };
export type Seniority = Record<string, number>; // slug -> rank, 1 = Chief Justice

export type Side = "affirm" | "set_aside";

export type ClerkTally = {
  sitting: string[];
  sides: Record<Side, string[]>;
  other: string[]; // votes for neither side (e.g. dismiss as improvidently granted)
  tie: boolean;
  winningSide: Side | null;
  outcome: string; // "Affirmed", "Reversed", "Vacated and remanded", "Affirmed by an equally divided Court", …
  tally: [number, number]; // [winning side, losing side]
  majority: string[]; // in seniority order
  dissent: string[]; // in seniority order
  assigner: string | null; // most senior justice in the majority
  authorCandidates: string[]; // majority members not concurring only in the judgment
  inconsistencies: string[]; // a role that contradicts the vote, flagged for the clerk call and the UI
};

export const sideOf = (v: Vote): Side | null => (v === "affirm" ? "affirm" : v === "other" ? null : "set_aside");

export function tallyVotes(votes: JusticeVote[], seniority: Seniority): ClerkTally {
  const bySeniority = (a: string, b: string) => (seniority[a] ?? 99) - (seniority[b] ?? 99);
  const sitting = votes.map((v) => v.justice).sort(bySeniority);
  const sides: Record<Side, string[]> = { affirm: [], set_aside: [] };
  const other: string[] = [];
  for (const v of votes) {
    const side = sideOf(v.vote);
    if (side) sides[side].push(v.justice);
    else other.push(v.justice);
  }
  sides.affirm.sort(bySeniority);
  sides.set_aside.sort(bySeniority);
  other.sort(bySeniority);

  const a = sides.affirm.length;
  const s = sides.set_aside.length;
  const tie = a === s;

  if (tie) {
    // An evenly divided Court leaves the judgment below in place and sets no precedent.
    return {
      sitting, sides, other, tie, winningSide: null,
      outcome: a === 0 ? "No disposition" : "Affirmed by an equally divided Court",
      tally: [a, s], majority: [], dissent: [], assigner: null, authorCandidates: [],
      inconsistencies: [],
    };
  }

  const winningSide: Side = a > s ? "affirm" : "set_aside";
  const majority = sides[winningSide];
  const dissent = sides[winningSide === "affirm" ? "set_aside" : "affirm"];
  const byJustice = new Map(votes.map((v) => [v.justice, v]));

  let outcome = "Affirmed";
  if (winningSide === "set_aside") {
    const vacate = majority.filter((j) => byJustice.get(j)!.vote === "vacate_remand").length;
    // The remedy follows most of the majority; on an even split within it, vacatur is the narrower judgment.
    outcome = vacate * 2 >= majority.length ? "Vacated and remanded" : "Reversed";
  }

  const inconsistencies: string[] = [];
  for (const j of majority) if (byJustice.get(j)!.role === "dissent") inconsistencies.push(`${j} votes with the majority but says dissent`);
  for (const j of dissent) if (byJustice.get(j)!.role !== "dissent") inconsistencies.push(`${j} votes against the majority but says ${byJustice.get(j)!.role}`);

  return {
    sitting, sides, other, tie, winningSide, outcome,
    tally: [majority.length, dissent.length],
    majority, dissent,
    assigner: majority[0] ?? null,
    authorCandidates: majority.filter((j) => byJustice.get(j)!.role !== "concur_judgment"),
    inconsistencies,
  };
}
