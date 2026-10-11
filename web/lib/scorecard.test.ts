import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildScoredCase, byPhase, dispositionOf, perJustice, seasonRecord, type ScoredInput } from "./scorecard";

const REV = ["roberts", "sotomayor", "kagan", "kavanaugh", "barrett", "jackson"];
const AFF = ["thomas", "alito", "gorsuch"];
const base: ScoredInput = {
  id: "p1", docket: "24-354", title: "FCC v. Consumers' Research", phase: "after_argument",
  lockedAt: "2026-10-10T21:21:00Z", predictedOutcome: "Reversed", tally: [6, 3], author: "kagan",
  votes: [...REV.map((j) => ({ justice: j, vote: "reverse", confidence: 0.8 })), ...AFF.map((j) => ({ justice: j, vote: "affirm", confidence: 0.7 }))],
  decidedAt: "2026-11-04", outcome: "Reversed and remanded",
  actualVotes: Object.fromEntries([...REV.map((j) => [j, "reverse"]), ...AFF.map((j) => [j, "affirm"])]), actualAuthor: "kagan",
};

describe("dispositionOf", () => {
  it("reads the judgment wording", () => {
    assert.equal(dispositionOf("Reversed and remanded"), "Reverse");
    assert.equal(dispositionOf("Affirmed by an equally divided Court"), "Affirm");
    assert.equal(dispositionOf("Vacated and remanded"), "Vacate");
    assert.equal(dispositionOf("Dismissed as improvidently granted"), "Other");
  });
});

describe("buildScoredCase", () => {
  it("shapes a scored forecast for the page", () => {
    const c = buildScoredCase(base);
    assert.equal(c.phase, "After argument");
    assert.deepEqual([c.predicted.disposition, c.predicted.tally, c.actual.disposition, c.actual.tally], ["Reverse", [6, 3], "Reverse", [6, 3]]);
    assert.equal(c.outcomeRight, true);
    assert.equal(c.authorRight, true);
    assert.equal(c.votes.length, 9);
    assert.equal(c.locked, "Oct 10");
    assert.equal(c.decided, "Nov 4");
    assert.equal(c.predicted.votes.thomas.side, "Affirm");
  });
});

describe("aggregations", () => {
  const right = buildScoredCase(base);
  const wrong = buildScoredCase({ ...base, id: "p2", docket: "25-1", phase: "before_argument", outcome: "Affirmed", actualVotes: Object.fromEntries([...REV.slice(0, 2).map((j) => [j, "reverse"]), ...[...REV.slice(2), ...AFF].map((j) => [j, "affirm"])]), actualAuthor: null });
  it("totals the season", () => {
    const r = seasonRecord([right, wrong]);
    assert.deepEqual(r, { n: 2, outcomeRight: 1, votes: 18, voteRight: 9 + 5, majorityRight: 9 + 4, authorN: 1, authorRight: 1 });
  });
  it("counts each justice's votes", () => {
    assert.deepEqual(perJustice([right, wrong]).kagan, { right: 1, n: 2 });
    assert.deepEqual(perJustice([right, wrong]).thomas, { right: 2, n: 2 });
  });
  it("splits by phase", () => {
    assert.deepEqual(byPhase([right, wrong]).map((p) => [p.phase, p.n, p.outcomeRight]), [["Before argument", 1, 0], ["After argument", 1, 1]]);
  });
});
