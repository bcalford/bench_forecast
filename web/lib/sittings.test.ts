import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHearingList } from "./court-site";
import { argued, groupBySitting, sittingFromList, sittingSpan, sittingUpdates, type Sitting } from "./sittings";

const october = parseHearingList(readFileSync(join(__dirname, "fixtures", "court", "hearing-october-2026.txt"), "utf8"));
const OCT: Sitting = { name: "October", start: "2026-10-05", end: "2026-10-14" };
const NOV: Sitting = { name: "November", start: "2026-11-02", end: "2026-11-10" };
const DEC: Sitting = { name: "December", start: "2026-11-30", end: "2026-12-09" };
const row = (id: string, sitting: Sitting | null, arguedOn: string | null, filed: string) => ({ id, sitting, argued: arguedOn, filed });

describe("sittingFromList", () => {
  it("names the sitting after its hearing list and spans its first to last argument day", () => {
    assert.deepEqual(sittingFromList("October", october), OCT);
  });
  it("is null for a list with no dated cases", () => {
    assert.equal(sittingFromList("May", []), null);
  });
});

describe("sittingSpan", () => {
  it("writes a span inside one month once", () => {
    assert.equal(sittingSpan(NOV), "Nov 2–10");
  });
  it("names both months when a sitting crosses into the next", () => {
    assert.equal(sittingSpan(DEC), "Nov 30 – Dec 9");
  });
  it("writes a one-day sitting as that day", () => {
    assert.equal(sittingSpan({ name: "May", start: "2027-05-03", end: "2027-05-03" }), "May 3");
  });
});

describe("argued", () => {
  it("writes an argument day short", () => {
    assert.equal(argued("2026-11-03"), "Argued Nov 3");
  });
});

describe("groupBySitting", () => {
  it("puts the newest sitting first and each sitting's cases in argument order", () => {
    const groups = groupBySitting([
      row("a", OCT, "2026-10-14", "2026-10-20"), row("b", NOV, "2026-11-03", "2026-11-04"),
      row("c", OCT, "2026-10-05", "2026-10-11"), row("d", NOV, "2026-11-02", "2026-11-04"),
    ]);
    assert.deepEqual(groups.map((g) => [g.label, g.span, g.rows.map((r) => r.id)]), [
      ["November sitting", "Nov 2–10", ["d", "b"]],
      ["October sitting", "Oct 5–14", ["c", "a"]],
    ]);
  });
  it("orders cases argued the same day by when they were filed, whatever order they arrive in", () => {
    const [g] = groupBySitting([row("late", OCT, "2026-10-05", "2026-10-11"), row("early", OCT, "2026-10-05", "2026-10-10")]);
    assert.deepEqual(g.rows.map((r) => r.id), ["early", "late"]);
  });
  it("keeps a sitting that crosses months as one group under its Court name", () => {
    const groups = groupBySitting([row("a", DEC, "2026-11-30", "2026-12-01"), row("b", DEC, "2026-12-02", "2026-12-03"), row("c", NOV, "2026-11-04", "2026-11-05")]);
    assert.deepEqual(groups.map((g) => [g.label, g.rows.length]), [["December sitting", 2], ["November sitting", 1]]);
  });
  it("puts cases with no sitting last, under Filed on this site, newest filed first", () => {
    const groups = groupBySitting([row("x", null, null, "2026-10-10T12:00:00Z"), row("a", OCT, "2026-10-05", "2026-10-11"), row("y", null, null, "2026-10-12T09:00:00Z")]);
    assert.deepEqual(groups.map((g) => [g.label, g.span, g.rows.map((r) => r.id)]), [
      ["October sitting", "Oct 5–14", ["a"]],
      ["Filed on this site", null, ["y", "x"]],
    ]);
  });
  it("gives each group a stable key", () => {
    const groups = groupBySitting([row("a", OCT, "2026-10-05", "2026-10-11"), row("x", null, null, "2026-10-10")]);
    assert.deepEqual(groups.map((g) => g.key), ["2026-10-05", "site"]);
  });
  it("returns no groups for no rows", () => {
    assert.deepEqual(groupBySitting([]), []);
  });
});

describe("sittingUpdates", () => {
  const listed = [{ docket: "25-170", title: "Suncor", argued: "2026-10-05", consolidatedWith: [], sitting: OCT }, { docket: "25-352", title: "Younge", argued: "2026-11-02", consolidatedWith: [], sitting: NOV }];
  it("fills the sitting, and the argument day if it's missing, for a filed case on a hearing list", () => {
    assert.deepEqual(sittingUpdates([{ id: "c1", docket: "No. 25–170", sitting: null, argued_on: null }], listed), [
      { id: "c1", sitting: "October", sitting_start: "2026-10-05", sitting_end: "2026-10-14", argued_on: "2026-10-05" },
    ]);
  });
  it("keeps an argument day the case already has", () => {
    assert.equal(sittingUpdates([{ id: "c2", docket: "25-352", sitting: null, argued_on: "2026-11-02" }], listed)[0].argued_on, "2026-11-02");
  });
  it("leaves cases that already have a sitting, have no docket, or aren't on any list", () => {
    assert.deepEqual(sittingUpdates([
      { id: "c3", docket: "25-352", sitting: "November", argued_on: "2026-11-02" },
      { id: "c4", docket: null, sitting: null, argued_on: null },
      { id: "c5", docket: "24-354", sitting: null, argued_on: null },
    ], listed), []);
  });
});
