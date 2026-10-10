// The bench as the UI draws it: the sitting roster, seating order, and how a stored vote reads on screen.
import { ROSTER } from "./roster.generated";

export type Justice = { slug: string; name: string; last: string; seniority: number };

// A seat's vote as the bench draws it: side of the predicted judgment, the role as shown, confidence,
// and whether this justice writes (inner mark).
export type SeatVote = { vote: "majority" | "minority"; role: string; confidence: number; writes: boolean };

export const justices: Justice[] = ROSTER.filter((j) => j.active).map((j) => ({
  slug: j.slug, name: j.name, last: j.last_name, seniority: j.seniority_rank,
}));

export const byslug: Record<string, Justice> = Object.fromEntries(justices.map((j) => [j.slug, j]));

// Seats as they sit on the bench, viewed from the courtroom: the Chief in the center,
// then seniority alternating outward (2nd to the Chief's right, which is the viewer's left).
export const benchOrder: Justice[] = (() => {
  const bySeniority = [...justices].sort((a, b) => a.seniority - b.seniority);
  const left: Justice[] = [], right: Justice[] = [];
  bySeniority.slice(1).forEach((j, i) => (i % 2 === 0 ? left : right).push(j));
  return [...left.reverse(), bySeniority[0], ...right];
})();

export const DISPOSITION_WORD: Record<string, string> = {
  affirm: "To affirm", reverse: "To reverse", vacate_remand: "To vacate", other: "Other disposition",
};
