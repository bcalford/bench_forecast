import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tallyVotes, type JusticeVote, type Seniority } from "./clerk-rules";

const SENIORITY: Seniority = {
  roberts: 1, thomas: 2, alito: 3, sotomayor: 4, kagan: 5, gorsuch: 6, kavanaugh: 7, barrett: 8, jackson: 9,
};

const v = (justice: string, vote: JusticeVote["vote"], role: JusticeVote["role"] = "majority"): JusticeVote => ({ justice, vote, role, confidence: 0.8 });

// The Hartwell sample: 6–3 to reverse, Roberts in the majority.
const HARTWELL = [
  v("roberts", "reverse"), v("thomas", "reverse", "concur"), v("alito", "reverse"), v("gorsuch", "reverse", "concur"),
  v("kavanaugh", "reverse"), v("barrett", "reverse"),
  v("sotomayor", "affirm", "dissent"), v("kagan", "affirm", "dissent"), v("jackson", "affirm", "dissent"),
];

describe("tallyVotes", () => {
  it("tallies a 6–3 reversal and gives the assignment to the Chief Justice", () => {
    const t = tallyVotes(HARTWELL, SENIORITY);
    assert.equal(t.outcome, "Reversed");
    assert.deepEqual(t.tally, [6, 3]);
    assert.equal(t.assigner, "roberts");
    assert.deepEqual(t.dissent, ["sotomayor", "kagan", "jackson"]);
    assert.deepEqual(t.inconsistencies, []);
  });

  it("gives the assignment to the most senior justice in the majority when the Chief dissents", () => {
    const votes = HARTWELL.map((x) => (x.justice === "roberts" ? v("roberts", "affirm", "dissent") : x));
    const t = tallyVotes(votes, SENIORITY);
    assert.deepEqual(t.tally, [5, 4]);
    assert.equal(t.assigner, "thomas");
  });

  it("reports a 4–4 split after a recusal as affirmed by an equally divided Court", () => {
    const votes = HARTWELL.filter((x) => x.justice !== "barrett").map((x) => (x.justice === "kavanaugh" ? v("kavanaugh", "affirm", "dissent") : x));
    const t = tallyVotes(votes, SENIORITY);
    assert.equal(t.tie, true);
    assert.equal(t.outcome, "Affirmed by an equally divided Court");
    assert.equal(t.assigner, null);
    assert.deepEqual(t.authorCandidates, []);
    assert.equal(t.sitting.length, 8);
  });

  it("handles recusals: a recused justice is simply absent from the votes", () => {
    const t = tallyVotes(HARTWELL.filter((x) => x.justice !== "kagan"), SENIORITY);
    assert.deepEqual(t.tally, [6, 2]);
    assert.ok(!t.sitting.includes("kagan"));
  });

  it("counts vacate-and-remand with reverse, and labels the outcome by most of the majority", () => {
    const votes = HARTWELL.map((x) => (["alito", "kavanaugh", "barrett", "gorsuch"].includes(x.justice) ? { ...x, vote: "vacate_remand" as const } : x));
    const t = tallyVotes(votes, SENIORITY);
    assert.equal(t.outcome, "Vacated and remanded");
    assert.deepEqual(t.tally, [6, 3]);
  });

  it("separates joiners from concurrences in the judgment when listing possible authors", () => {
    const votes = HARTWELL.map((x) => (x.justice === "thomas" ? v("thomas", "reverse", "concur_judgment") : x));
    const t = tallyVotes(votes, SENIORITY);
    assert.ok(t.majority.includes("thomas"));
    assert.ok(!t.authorCandidates.includes("thomas"));
    assert.ok(t.authorCandidates.includes("gorsuch")); // concurring (joining and writing too) can still author
  });

  it("keeps votes for neither side out of the tally", () => {
    const votes = HARTWELL.map((x) => (x.justice === "jackson" ? v("jackson", "other", "concur_judgment") : x));
    const t = tallyVotes(votes, SENIORITY);
    assert.deepEqual(t.tally, [6, 2]);
    assert.deepEqual(t.other, ["jackson"]);
  });

  it("flags a role that contradicts the vote", () => {
    const votes = HARTWELL.map((x) => (x.justice === "alito" ? v("alito", "reverse", "dissent") : x));
    const t = tallyVotes(votes, SENIORITY);
    assert.equal(t.inconsistencies.length, 1);
    assert.match(t.inconsistencies[0], /alito/);
  });

  it("lists the majority and dissent in seniority order regardless of input order", () => {
    const t = tallyVotes([...HARTWELL].reverse(), SENIORITY);
    assert.deepEqual(t.majority, ["roberts", "thomas", "alito", "gorsuch", "kavanaugh", "barrett"]);
  });
});
