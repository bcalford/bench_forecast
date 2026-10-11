import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupByDocket, processDecision } from "./decision-job";

const FCC_TEXT = "Pp. 34–37. 109 F. 4th 743, reversed and remanded. KAGAN, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. GORSUCH, J., filed a dissenting opinion, in which THOMAS and ALITO, JJ., joined. _________________";
const listed = { term: "OT2024", date: "2025-06-27", docket: "24-354", caseName: "FCC v. Consumers' Research", url: "https://x/fcc.pdf" };

describe("groupByDocket", () => {
  it("keeps every case row filed under one docket", () => {
    const g = groupByDocket([{ caseId: "a", docket: "25-170" }, { caseId: "b", docket: "25-170" }, { caseId: "c", docket: "25-498" }]);
    assert.deepEqual(g.get("25-170"), ["a", "b"]);
    assert.deepEqual(g.get("25-498"), ["c"]);
  });
});

describe("processDecision", () => {
  it("saves and scores the outcome for every case row under the docket", async () => {
    const saved: string[] = [], scored: string[] = [];
    const r = await processDecision(listed, ["a", "b"], {
      text: async () => FCC_TEXT, save: async (id) => { saved.push(id); }, score: async (id) => { scored.push(id); return 1; }, dryRun: false,
    });
    assert.deepEqual(saved, ["a", "b"]);
    assert.deepEqual(scored, ["a", "b"]);
    assert.equal("scored" in r && r.scored, 2);
  });
  it("reports a decision it can't fetch instead of failing the whole run", async () => {
    let saves = 0;
    const r = await processDecision(listed, ["a"], {
      text: async () => { throw new Error("503 fetching PDF"); }, save: async () => { saves++; }, score: async () => 0, dryRun: false,
    });
    assert.equal("error" in r && r.error, "503 fetching PDF");
    assert.equal(saves, 0);
  });
  it("writes nothing on a dry run", async () => {
    let saves = 0;
    const r = await processDecision(listed, ["a"], { text: async () => FCC_TEXT, save: async () => { saves++; }, score: async () => 0, dryRun: true });
    assert.equal(saves, 0);
    assert.equal("reading" in r && r.reading.author, "kagan");
  });
});
