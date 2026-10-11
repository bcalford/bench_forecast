import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { confirmProblems, judgmentOfOutcome, scoringPlan } from "./outcomes";

const NINE = ["roberts", "thomas", "alito", "sotomayor", "kagan", "gorsuch", "kavanaugh", "barrett", "jackson"];
const votesFor = (slugs: string[]) => Object.fromEntries(slugs.map((s) => [s, "reverse"]));

describe("judgmentOfOutcome", () => {
  it("reads a full judgment", () => {
    assert.equal(judgmentOfOutcome("Affirmed by an equally divided Court"), "affirm");
    assert.equal(judgmentOfOutcome("Reversed and remanded"), "reverse");
    assert.equal(judgmentOfOutcome("Vacated and remanded"), "vacate_remand");
  });
  it("treats a judgment in part as other, not as its first word", () => {
    assert.equal(judgmentOfOutcome("Affirmed in part, reversed in part, and remanded"), "other");
  });
});

describe("confirmProblems", () => {
  const guess = { outcome: "Reversed and remanded", votes: votesFor(NINE), notes: "two opinions run together in one sentence" };
  it("accepts a full guess", () => assert.deepEqual(confirmProblems(guess, []), []));
  it("refuses a guess missing a justice unless named as recused", () => {
    const eight = { ...guess, votes: votesFor(NINE.filter((s) => s !== "alito")) };
    assert.ok(confirmProblems(eight, []).some((p) => /alito/.test(p)));
    assert.deepEqual(confirmProblems(eight, ["alito"]), []);
  });
  it("refuses a recusal that has a vote, or an unknown name", () => {
    assert.ok(confirmProblems(guess, ["alito"]).some((p) => /alito/.test(p)));
    assert.ok(confirmProblems(guess, ["alioto"]).some((p) => /alioto/.test(p)));
  });
  it("refuses a judgment in part", () => {
    assert.ok(confirmProblems({ ...guess, outcome: "Affirmed in part, reversed in part" }, []).some((p) => /set/.test(p)));
  });
  it("refuses a decision with more than one judgment", () => {
    assert.ok(confirmProblems({ ...guess, notes: "more than one judgment (consolidated cases decided differently?)" }, []).some((p) => /set/.test(p)));
  });
});

describe("scoringPlan", () => {
  const preds = [{ id: "early", locked_at: "2026-10-10T21:00:00Z" }, { id: "same-day", locked_at: "2027-01-15T15:00:00Z" }];
  const ot26 = { term: "October Term 2026", decided_before_cutoff: false };
  it("scores forecasts locked before the decision and clears the rest", () => {
    const p = scoringPlan(preds, { decided_at: "2027-01-15", status: "scored" }, ot26);
    assert.deepEqual(p.score.map((x) => x.id), ["early"]);
    assert.deepEqual(p.clear, ["same-day"]);
  });
  it("clears every score when the outcome goes back to review", () => {
    const p = scoringPlan(preds, { decided_at: "2027-01-15", status: "needs_review" }, ot26);
    assert.deepEqual(p.score, []);
    assert.deepEqual(p.clear, ["early", "same-day"]);
  });
  it("clears every score outside the scored term", () => {
    const p = scoringPlan(preds, { decided_at: "2027-01-15", status: "scored" }, { term: "October Term 2024", decided_before_cutoff: false });
    assert.deepEqual(p.clear, ["early", "same-day"]);
  });
});
