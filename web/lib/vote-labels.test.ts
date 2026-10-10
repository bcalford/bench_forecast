import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tallyVotes, type JusticeVote, type Seniority } from "./clerk-rules";
import { labelVotes } from "./vote-labels";

const SENIORITY: Seniority = {
  roberts: 1, thomas: 2, alito: 3, sotomayor: 4, kagan: 5, gorsuch: 6, kavanaugh: 7, barrett: 8, jackson: 9,
};
const v = (justice: string, vote: JusticeVote["vote"], role: JusticeVote["role"] = "majority"): JusticeVote => ({ justice, vote, role, confidence: 0.7 });
const label = (votes: JusticeVote[], author: string | null = null) => labelVotes(votes, tallyVotes(votes, SENIORITY), author);

// Suncor v. Boulder County as forecast: Alito recused, 4–4, so the judgment below stands.
const SUNCOR = [
  v("roberts", "reverse"), v("thomas", "reverse"), v("kavanaugh", "reverse"), v("barrett", "reverse"),
  v("sotomayor", "affirm", "dissent"), v("kagan", "affirm", "dissent"), v("gorsuch", "affirm", "dissent"), v("jackson", "affirm", "dissent"),
];

describe("labelVotes on an evenly divided Court", () => {
  it("names each justice's vote instead of a majority or dissent", () => {
    const l = label(SUNCOR);
    assert.equal(l.divided, true);
    for (const j of ["roberts", "thomas", "kavanaugh", "barrett"]) assert.equal(l.votes[j].role, "Votes to reverse");
    for (const j of ["sotomayor", "kagan", "gorsuch", "jackson"]) assert.equal(l.votes[j].role, "Votes to affirm");
    for (const lv of Object.values(l.votes)) {
      assert.notEqual(lv.role, "Joins majority");
      assert.notEqual(lv.role, "Dissents");
      assert.equal(lv.writes, false);
    }
  });
  it("lists no dissenters or concurrers, and labels the two sides by their votes", () => {
    const l = label(SUNCOR);
    assert.deepEqual(l.dissenting, []);
    assert.deepEqual(l.concurring, []);
    assert.deepEqual(l.sideLabels, { majority: "Votes to affirm", minority: "Votes to reverse" });
  });
  it("shows the affirming side as the side that prevails, since the judgment below stands", () => {
    const l = label(SUNCOR);
    assert.equal(l.votes.kagan.vote, "majority");
    assert.equal(l.votes.roberts.vote, "minority");
  });
  it("calls a mixed reverse/vacate side 'set aside'", () => {
    const mixed = SUNCOR.map((x) => (x.justice === "thomas" ? { ...x, vote: "vacate_remand" as const } : x));
    const l = label(mixed);
    assert.equal(l.votes.thomas.role, "Votes to vacate");
    assert.equal(l.sideLabels.minority, "Votes to set aside");
  });
});

describe("labelVotes on a divided Court with a majority", () => {
  const FCC = [
    v("roberts", "reverse"), v("sotomayor", "reverse"), v("kagan", "reverse"), v("kavanaugh", "reverse", "concur"),
    v("barrett", "reverse"), v("jackson", "reverse", "concur"),
    v("thomas", "affirm", "dissent"), v("alito", "affirm", "dissent"), v("gorsuch", "affirm", "dissent"),
  ];
  it("keeps majority, concurrence, dissent and the author", () => {
    const l = label(FCC, "kagan");
    assert.equal(l.divided, false);
    assert.equal(l.votes.kagan.role, "Writes for the Court");
    assert.equal(l.votes.roberts.role, "Joins majority");
    assert.equal(l.votes.kavanaugh.role, "Concurrence");
    assert.equal(l.votes.thomas.role, "Dissents");
    assert.equal(l.votes.thomas.vote, "minority");
    assert.deepEqual(l.dissenting, ["thomas", "alito", "gorsuch"]);
    assert.deepEqual(l.concurring, ["kavanaugh", "jackson"]);
    assert.deepEqual(l.sideLabels, { majority: "Majority", minority: "Dissent" });
  });
});
