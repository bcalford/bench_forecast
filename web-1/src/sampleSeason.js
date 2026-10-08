// SYNTHETIC sample season for the scorecard. Not real cases, not real results.
// Generated from a fixed seed so the page is stable; the model's estimates are the
// "true" lean plus noise, which yields realistic, unspectacular accuracy.
import { justices, benchOrder } from "./data.js";

const TITLES = [
  "Mercer v. Ohio", "Delgado v. United States", "Pryor Holdings v. FTC", "Ingram v. Board of Regents",
  "Castellano v. Nevada", "Whitfield v. Department of Labor", "Hale County v. Brandt", "Lindqvist v. Minnesota",
  "Arcadia Water District v. EPA", "Thornbury v. SEC", "Navarro v. City of Tacoma", "Beaumont Rail v. Surface Transportation Board",
  "Quintero v. Arizona", "Feldman v. Kessler", "Okonkwo v. United States", "Ashby v. Maryland",
];
const LOCKED = ["Oct 6", "Oct 14", "Oct 21", "Nov 3", "Nov 10", "Nov 18", "Dec 1", "Dec 8", "Dec 15", "Jan 6", "Jan 12", "Jan 20", "Feb 2", "Feb 9", "Feb 23", "Mar 2"];
const DECIDED = ["Feb 24", "Mar 4", "Mar 20", "Apr 1", "Apr 17", "May 5", "May 15", "May 22", "Jun 2", "Jun 5", "Jun 12", "Jun 17", "Jun 20", "Jun 24", "Jun 27", "Jun 30"];

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const bySeniority = [...justices].sort((a, b) => a.seniority - b.seniority);

function buildCase(i, rand) {
  const leanSide = rand() < 0.5 ? "Reverse" : "Affirm"; // the side the conservative bloc favors
  const other = leanSide === "Reverse" ? "Affirm" : "Reverse";
  const shift = (rand() - 0.5) * 5.5; // big shifts make lopsided or unanimous cases

  const predicted = {}, actual = {};
  for (const j of justices) {
    const lean = j.ideology * 1.05 + shift;
    actual[j.slug] = rand() < sigmoid(lean) ? leanSide : other;
    const q = sigmoid(lean + (rand() - 0.5) * 1.9);
    predicted[j.slug] = {
      side: q > 0.5 ? leanSide : other,
      confidence: Math.min(0.97, Math.max(0.52, Math.max(q, 1 - q))),
    };
  }

  const tally = (sideOf) => {
    const counts = { Reverse: 0, Affirm: 0 };
    justices.forEach((j) => counts[sideOf(j.slug)]++);
    const disposition = counts.Reverse > counts.Affirm ? "Reverse" : "Affirm";
    return { disposition, tally: [counts[disposition], 9 - counts[disposition]] };
  };
  const pred = tally((s) => predicted[s].side);
  const act = tally((s) => actual[s]);

  const predMajority = bySeniority.filter((j) => predicted[j.slug].side === pred.disposition);
  const actMajority = bySeniority.filter((j) => actual[j.slug] === act.disposition);
  const actualAuthor = actMajority[Math.floor(rand() * actMajority.length)].slug;
  const predictedAuthor =
    predMajority.some((j) => j.slug === actualAuthor) && rand() < 0.45
      ? actualAuthor
      : predMajority[Math.floor(rand() * predMajority.length)].slug;

  return {
    docket: `S-${101 + i}`,
    title: TITLES[i],
    phase: i % 3 === 0 ? "Before argument" : "After argument",
    locked: LOCKED[i],
    decided: DECIDED[i],
    predicted: { ...pred, author: predictedAuthor, votes: predicted },
    actual: { ...act, author: actualAuthor, votes: actual },
  };
}

function score(c) {
  const votes = benchOrder.map((j) => {
    const p = c.predicted.votes[j.slug];
    const a = c.actual.votes[j.slug];
    return {
      slug: j.slug,
      confidence: p.confidence,
      voteRight: p.side === a,
      majorityRight: (p.side === c.predicted.disposition) === (a === c.actual.disposition),
    };
  });
  return {
    ...c,
    outcomeRight: c.predicted.disposition === c.actual.disposition,
    authorRight: c.predicted.author === c.actual.author,
    votes,
  };
}

export const sampleSeason = (() => {
  const rand = mulberry32(20261008);
  return TITLES.map((_, i) => score(buildCase(i, rand)));
})();
