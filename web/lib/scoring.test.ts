import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Seniority, Vote } from "./clerk-rules";
import { calibration, countingForecasts, lockedBeforeDecision, scoreForecast } from "./scoring";

const S: Seniority = { roberts: 1, thomas: 2, alito: 3, sotomayor: 4, kagan: 5, gorsuch: 6, kavanaugh: 7, barrett: 8, jackson: 9 };
const ALL = Object.keys(S);
const votes = (rev: string[], aff: string[], v: Vote = "reverse") =>
  Object.fromEntries([...rev.map((s) => [s, v]), ...aff.map((s) => [s, "affirm"])]) as Record<string, Vote>;
const conf = (slugs: string[], c = 0.8) => Object.fromEntries(slugs.map((s) => [s, c]));

// FCC v. Consumers' Research: 6–3 to reverse, Kagan writing; Gorsuch, Thomas, Alito dissenting.
const FCC_REV = ["roberts", "sotomayor", "kagan", "kavanaugh", "barrett", "jackson"];
const FCC_AFF = ["thomas", "alito", "gorsuch"];

describe("scoreForecast", () => {
  it("scores an exact forecast as all right", () => {
    const s = scoreForecast(
      { votes: votes(FCC_REV, FCC_AFF), confidence: conf(ALL), author: "kagan" },
      { judgment: "reverse", votes: votes(FCC_REV, FCC_AFF), author: "kagan" }, S);
    assert.deepEqual([s.outcomeCorrect, s.votesCorrect, s.votesTotal, s.majorityCorrect, s.authorCorrect], [true, 9, 9, 9, true]);
  });
  it("counts reverse and vacate as the same side", () => {
    const s = scoreForecast(
      { votes: votes(FCC_REV, FCC_AFF, "reverse"), confidence: conf(ALL), author: "kagan" },
      { judgment: "vacate_remand", votes: votes(FCC_REV, FCC_AFF, "vacate_remand"), author: "roberts" }, S);
    assert.equal(s.outcomeCorrect, true);
    assert.equal(s.votesCorrect, 9);
    assert.equal(s.authorCorrect, false);
  });
  it("separates votes from majority membership when the outcome is wrong", () => {
    // Forecast 5–4 to reverse with Barrett reversing; Court 5–4 to affirm with Barrett affirming.
    const f = votes(["roberts", "thomas", "alito", "gorsuch", "barrett"], ["sotomayor", "kagan", "kavanaugh", "jackson"]);
    const o = votes(["roberts", "thomas", "alito", "gorsuch"], ["sotomayor", "kagan", "kavanaugh", "jackson", "barrett"]);
    const s = scoreForecast({ votes: f, confidence: conf(ALL), author: null }, { judgment: "affirm", votes: o, author: "kagan" }, S);
    assert.equal(s.outcomeCorrect, false);
    assert.equal(s.votesCorrect, 8, "only Barrett's vote missed");
    assert.equal(s.majorityCorrect, 1, "only Barrett is placed right relative to the judgment");
    assert.equal(s.authorCorrect, null, "no predicted author");
  });
  it("treats a predicted 4–4 as affirm", () => {
    const f = votes(["roberts", "thomas", "kavanaugh", "barrett"], ["sotomayor", "kagan", "gorsuch", "jackson"]);
    const o = votes(["roberts", "thomas", "kavanaugh"], ["sotomayor", "kagan", "gorsuch", "jackson", "barrett"]);
    const s = scoreForecast({ votes: f, confidence: conf(Object.keys(f)), author: null }, { judgment: "affirm", votes: o, author: "kagan" }, S);
    assert.equal(s.outcomeCorrect, true);
    assert.equal(s.votesTotal, 8);
  });
  it("counts a justice we treated as recused but who sat as wrong; drops one who really recused", () => {
    const f = votes(FCC_REV.filter((x) => x !== "kagan"), FCC_AFF.filter((x) => x !== "alito"));
    const o = votes(FCC_REV, FCC_AFF.filter((x) => x !== "gorsuch"));
    const s = scoreForecast({ votes: f, confidence: conf(Object.keys(f)), author: null }, { judgment: "reverse", votes: o, author: "kagan" }, S);
    assert.equal(s.votesTotal, 8, "Gorsuch really recused, so 8 sat");
    assert.equal(s.justices.find((j) => j.slug === "kagan")?.voteRight, false);
    assert.equal(s.justices.find((j) => j.slug === "kagan")?.predicted, null);
    assert.equal(s.votesCorrect, 6, "Kagan and Alito were both treated as recused but sat: both missed");
  });
});

describe("lockedBeforeDecision", () => {
  it("compares Eastern calendar dates", () => {
    assert.equal(lockedBeforeDecision("2026-11-03T03:30:00Z", "2026-11-03"), true, "Nov 2, 10:30 PM ET");
    assert.equal(lockedBeforeDecision("2026-11-03T15:00:00Z", "2026-11-03"), false, "decision day");
    assert.equal(lockedBeforeDecision("2026-11-04T01:00:00Z", "2026-11-03"), false);
  });
});

describe("countingForecasts", () => {
  it("keeps one forecast per case: the docket one, else the earliest", () => {
    const fs = [
      { id: "a", caseId: "c1", origin: "invite", lockedAt: "2026-10-10T23:49:00Z" },
      { id: "b", caseId: "c1", origin: "docket", lockedAt: "2026-10-11T02:00:00Z" },
      { id: "c", caseId: "c2", origin: "invite", lockedAt: "2026-10-12T02:00:00Z" },
      { id: "d", caseId: "c2", origin: "owner", lockedAt: "2026-10-11T02:00:00Z" },
    ];
    assert.deepEqual(countingForecasts(fs).map((f) => f.id).sort(), ["b", "d"]);
  });
});

describe("calibration", () => {
  it("bands stated confidence and reports the hit rate", () => {
    const vs = [
      { confidence: 0.55, voteRight: true }, { confidence: 0.58, voteRight: false },
      { confidence: 0.92, voteRight: true }, { confidence: 1, voteRight: true }, { confidence: 0.45, voteRight: false },
    ];
    const b = calibration(vs);
    assert.deepEqual(b.map((x) => [x.lo, x.n, x.observed]), [[0.5, 3, 1 / 3], [0.9, 2, 1]]);
    assert.ok(Math.abs(b[0].stated - (0.55 + 0.58 + 0.45) / 3) < 1e-9);
  });
});
