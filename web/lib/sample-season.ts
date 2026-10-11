// SYNTHETIC sample season for the scorecard preview. Not real cases, not real results; the page labels it so.
// Ported from web-1/src/sampleSeason.js: generated from a fixed seed so the page is stable; the model's
// estimates are the "true" lean plus noise, which yields realistic, unspectacular accuracy.
import { benchOrder } from "./court";
import type { Disposition, ScoredCase, ScoredVote } from "./scorecard";

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
const LOCKED = ["Oct 6", "Oct 14", "Oct 21", "Nov 3", "Nov 10", "Nov 18", "Dec 1", "Dec 8", "Dec 15", "Jan 6", "Jan 12", "Jan 20", "Feb 2", "Feb 9", "Feb 23", "Mar 2"];
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
    locked: LOCKED[i],
    decided: DECIDED[i],
    predicted: { disposition: pred.disposition as Disposition, tally: pred.tally, author: predictedAuthor, votes: predicted },
    actual: { disposition: act.disposition as Disposition, tally: act.tally, author: actualAuthor },
    outcomeRight: pred.disposition === act.disposition,
    authorRight: predictedAuthor === actualAuthor,
    votes,
  };
}

export const sampleSeason: ScoredCase[] = (() => {
  const rand = mulberry32(20261008);
  return TITLES.map((_, i) => buildCase(i, rand));
})();
