// SYNTHETIC sample season for the scorecard preview. Not real cases, not real results; the page labels it so.
// Ported from web-1/src/sampleSeason.js: generated from a fixed seed so the page is stable; the model's
// estimates are the "true" lean plus noise, which yields realistic, unspectacular accuracy.
import { benchOrder } from "./court";
import type { Disposition, ScoredCase, ScoredVote } from "./scorecard";
import type { Sitting } from "./sittings";

// Illustrative leanings for the synthetic generator only; never shown. Seniority order, as in the prototype.
const LEANINGS: [slug: string, lean: number][] = [
  ["roberts", 0.3], ["thomas", 3.0], ["alito", 2.6], ["sotomayor", -3.2], ["kagan", -2.2],
  ["gorsuch", 1.8], ["kavanaugh", 0.7], ["barrett", 1.0], ["jackson", -3.0],
];

const TITLES = [
  "Mercer v. Ohio", "Delgado v. United States", "Pryor Holdings v. FTC", "Ingram v. Board of Regents",
  "Castellano v. Nevada", "Whitfield v. Department of Labor", "Hale County v. Brandt", "Lindqvist v. Minnesota",
  "Arcadia Water District v. EPA", "Thornbury v. SEC", "Navarro v. City of Tacoma", "Beaumont Rail v. Surface Transportation Board",
  "Quintero v. Arizona", "Feldman v. Kessler", "Okonkwo v. United States", "Ashby v. Maryland",
];
// Synthetic sittings and argument days, three or four cases each. A before-argument case locks four days ahead
// of its argument, an after-argument one five days after.
const SITTINGS: Sitting[] = [
  { name: "October", start: "2026-10-05", end: "2026-10-14" }, { name: "November", start: "2026-11-02", end: "2026-11-10" },
  { name: "December", start: "2026-11-30", end: "2026-12-09" }, { name: "January", start: "2027-01-11", end: "2027-01-21" },
  { name: "February", start: "2027-02-22", end: "2027-03-03" },
];
const ARGUED = [
  "2026-10-05", "2026-10-07", "2026-10-13", "2026-11-02", "2026-11-04", "2026-11-09", "2026-11-30", "2026-12-02", "2026-12-08",
  "2027-01-11", "2027-01-13", "2027-01-20", "2027-02-22", "2027-02-24", "2027-03-01", "2027-03-03",
];
const shiftDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + d * 864e5);
const DECIDED = ["Feb 24", "Mar 4", "Mar 20", "Apr 1", "Apr 17", "May 5", "May 15", "May 22", "Jun 2", "Jun 5", "Jun 12", "Jun 17", "Jun 20", "Jun 24", "Jun 27", "Jun 30"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
type Side = "Reverse" | "Affirm";

function buildCase(i: number, rand: () => number): ScoredCase {
  const leanSide: Side = rand() < 0.5 ? "Reverse" : "Affirm"; // the side the conservative bloc favors
  const other: Side = leanSide === "Reverse" ? "Affirm" : "Reverse";
  const shift = (rand() - 0.5) * 5.5; // big shifts make lopsided or unanimous cases

  const predicted: Record<string, { side: Side; confidence: number }> = {};
  const actual: Record<string, Side> = {};
  for (const [slug, ideology] of LEANINGS) {
    const lean = ideology * 1.05 + shift;
    actual[slug] = rand() < sigmoid(lean) ? leanSide : other;
    const q = sigmoid(lean + (rand() - 0.5) * 1.9);
    predicted[slug] = { side: q > 0.5 ? leanSide : other, confidence: Math.min(0.97, Math.max(0.52, Math.max(q, 1 - q))) };
  }

  const tally = (sideOf: (slug: string) => Side) => {
    const counts = { Reverse: 0, Affirm: 0 };
    LEANINGS.forEach(([slug]) => counts[sideOf(slug)]++);
    const disposition: Side = counts.Reverse > counts.Affirm ? "Reverse" : "Affirm";
    return { disposition, tally: [counts[disposition], 9 - counts[disposition]] as [number, number] };
  };
  const pred = tally((s) => predicted[s].side);
  const act = tally((s) => actual[s]);

  const predMajority = LEANINGS.map(([s]) => s).filter((s) => predicted[s].side === pred.disposition);
  const actMajority = LEANINGS.map(([s]) => s).filter((s) => actual[s] === act.disposition);
  const actualAuthor = actMajority[Math.floor(rand() * actMajority.length)];
  const predictedAuthor = predMajority.includes(actualAuthor) && rand() < 0.45
    ? actualAuthor
    : predMajority[Math.floor(rand() * predMajority.length)];

  const votes: ScoredVote[] = benchOrder.map((j) => ({
    slug: j.slug,
    confidence: predicted[j.slug].confidence,
    voteRight: predicted[j.slug].side === actual[j.slug],
    majorityRight: (predicted[j.slug].side === pred.disposition) === (actual[j.slug] === act.disposition),
  }));
  return {
    id: null,
    docket: `25-${2104 + i * 13}`,
    title: TITLES[i],
    phase: i % 3 === 0 ? "Before argument" : "After argument",
    locked: shiftDays(ARGUED[i], i % 3 === 0 ? -4 : 5).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    decided: DECIDED[i],
    predicted: { disposition: pred.disposition as Disposition, tally: pred.tally, author: predictedAuthor, votes: predicted },
    actual: { disposition: act.disposition as Disposition, tally: act.tally, author: actualAuthor },
    outcomeRight: pred.disposition === act.disposition,
    authorRight: predictedAuthor === actualAuthor,
    votes,
    sitting: SITTINGS[Math.min(Math.floor(i / 3), SITTINGS.length - 1)], argued: ARGUED[i], filed: shiftDays(ARGUED[i], i % 3 === 0 ? -4 : 5).toISOString(),
  };
}

export const sampleSeason: ScoredCase[] = (() => {
  const rand = mulberry32(20261008);
  return TITLES.map((_, i) => buildCase(i, rand));
})();
