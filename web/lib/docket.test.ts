import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assembleCase, caseLimit, missing, normalizeDocket, perCaseEstimate } from "./docket";
import { parseTranscriptLinks } from "./court-site";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", "court", n), "utf8");
const SUNCOR = { docket: "25-170", title: "Suncor Energy (U.S.A.) Inc. v. County Commissioners of Boulder County", argued: "2026-10-05", consolidatedWith: [] };

describe("assembleCase", () => {
  it("brings together the briefs, the transcript and recusals", () => {
    const c = assembleCase(SUNCOR, parseTranscriptLinks(fx("transcripts-2026.html")), fx("docket-25-170.html"), ["alito"]);
    assert.ok(c.petitioner && c.respondent && c.transcript);
    assert.deepEqual(c.recused, ["alito"]);
    assert.deepEqual(missing(c), []);
  });
  it("names what is missing, so the case is skipped", () => {
    const c = assembleCase({ ...SUNCOR, docket: "25-9999" }, {}, "<html></html>", []);
    assert.deepEqual(missing(c), ["no transcript yet", "petitioners' merits brief not found", "respondents' merits brief not found"]);
  });
  it("rejects an unknown justice in a recusal override", () => {
    assert.throws(() => assembleCase(SUNCOR, {}, "", ["scalia"]), /Unknown justice/);
  });
});

describe("caseLimit", () => {
  it("starts at most max-spend ÷ $2.50 cases", () => {
    assert.equal(caseLimit(30), 12);
    assert.equal(caseLimit(2), 0);
    assert.equal(caseLimit(2.5), 1);
  });
  it("uses the per-case estimate when one is given", () => {
    assert.equal(caseLimit(10, 3.4), 2);
    assert.equal(caseLimit(6.8, 3.4), 2);
  });
});

describe("perCaseEstimate", () => {
  it("is $2.50 while every past run cost less", () => {
    assert.equal(perCaseEstimate([]), 2.5);
    assert.equal(perCaseEstimate([1.86, 2.16, 2.04]), 2.5);
  });
  it("rises to the costliest past run, rounded up to the cent", () => {
    assert.equal(perCaseEstimate([2.1, 3.401]), 3.41);
  });
});

describe("normalizeDocket", () => {
  it("matches a docket however it was typed", () => {
    for (const d of ["25-459", " 25-459 ", "No. 25-459", "no.25-459"]) assert.equal(normalizeDocket(d), "25-459");
    assert.equal(normalizeDocket("25a123"), "25A123");
    assert.equal(normalizeDocket("22O145"), "22O145");
  });
});
