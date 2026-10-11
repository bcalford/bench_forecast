import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assembleCase, caseLimit, missing } from "./docket";
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
});
