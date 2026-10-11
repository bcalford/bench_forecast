import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { currentTerm, normalizeDocket, parseDocketPage, parseHearingList, parseSlipListing, parseTranscriptLinks } from "./court-site";

const fx = (name: string) => readFileSync(join(__dirname, "fixtures", "court", name), "utf8");

describe("normalizeDocket", () => {
  it("pulls a docket number out of a label and uses a plain hyphen", () => {
    assert.equal(normalizeDocket("No. 25–170"), "25-170");
    assert.equal(normalizeDocket("25-5343"), "25-5343");
    assert.equal(normalizeDocket("Original 22"), "");
  });
});

describe("parseHearingList", () => {
  const cases = parseHearingList(fx("hearing-october-2026.txt"));
  it("finds each argued case with its date and a clean title", () => {
    const suncor = cases.find((c) => c.docket === "25-170");
    assert.deepEqual(suncor, {
      docket: "25-170", argued: "2026-10-05", consolidatedWith: [],
      title: "Suncor Energy (U.S.A.) Inc. v. County Commissioners of Boulder County",
    });
    assert.equal(cases.find((c) => c.docket === "25-498")?.argued, "2026-10-06");
    assert.equal(cases.find((c) => c.docket === "25-735")?.title, "Floyd D. Johnson v. United States Congress");
  });
  it("lists no holiday or session header as a case, and no docket twice", () => {
    assert.ok(cases.length >= 6);
    assert.equal(new Set(cases.map((c) => c.docket)).size, cases.length);
    for (const c of cases) assert.match(c.docket, /^\d{2}-\d+$/);
  });
  it("groups consolidated cases under the first docket", () => {
    const text = "Monday, November 2, 2026\nNo. 25-111. Alpha Corp. v. Beta.\nNo. 25-222. Gamma v. Beta.\n(Consolidated for one hour of oral argument.)\nCertiorari to the C. A. 9th Circuit.\nNo. 25-333. Delta v. Echo.\nCertiorari to the C. A. 2nd Circuit.";
    const cs = parseHearingList(text);
    assert.deepEqual(cs.map((c) => [c.docket, c.consolidatedWith]), [["25-111", ["25-222"]], ["25-333", []]]);
    assert.equal(cs[0].title, "Alpha Corp. v. Beta");
  });
});

describe("parseTranscriptLinks", () => {
  it("maps docket numbers to absolute transcript URLs", () => {
    const links = parseTranscriptLinks(fx("transcripts-2026.html"));
    assert.equal(links["25-170"], "https://www.supremecourt.gov/oral_arguments/argument_transcripts/2026/25-170_8m58.pdf");
  });
});

describe("parseDocketPage", () => {
  it("takes the merits briefs' main documents, not briefs in opposition or replies", () => {
    const d = parseDocketPage(fx("docket-25-170.html"));
    assert.equal(d.petitioner?.url, "https://www.supremecourt.gov/DocketPDF/25/25-170/408810/20260514091116673_Boulder%20brief%20for%20petitioners%20FINAL.pdf");
    assert.equal(d.respondent?.url, "https://www.supremecourt.gov/DocketPDF/25/25-170/418043/20260803182738077_25-170%20Brief.pdf");
    assert.equal(d.petitioner?.filed, "May 14 2026");
  });
  it("handles a government petitioner and a single respondent", () => {
    const d = parseDocketPage(fx("docket-25-579.html"));
    assert.ok(d.petitioner?.url.includes("/25-579/"));
    assert.ok(d.respondent?.url.includes("/25-579/"));
    assert.notEqual(d.petitioner?.filed, "Feb 04 2026", "not the cert-stage reply");
    assert.notEqual(d.respondent?.filed, "Jan 16 2026", "not the brief in opposition");
  });
  it("reads a recusal entry", () => {
    const html = `<td class="ProceedingDate">Oct 01 2026</td><td>JUSTICE ALITO took no part in the consideration or decision of this petition.</td>`;
    assert.deepEqual(parseDocketPage(html).recused, ["alito"]);
  });
  it("reads a recusal entry in the docket's real wording", () => {
    const html = `<td class="ProceedingDate">Jun 30 2026</td><td>Justice Jackson took no part in the consideration or decision of this petition.</td>`;
    assert.deepEqual(parseDocketPage(html).recused, ["jackson"]);
  });
  it("doesn't take a brief filed in support of the other side as the respondents' brief", () => {
    const row = (date: string, text: string, url: string) => `<td class="ProceedingDate">${date}</td><td>${text} <a href= ${url} class="documentanchor" target="_blank">Main Document</a></td>`;
    const html = row("May 1 2026", "Brief of respondents Acme Corp. filed.", "https://x/resp.pdf") + row("May 8 2026", "Brief of respondent United States in support of petitioners filed.", "https://x/us.pdf");
    assert.equal(parseDocketPage(html).respondent?.url, "https://x/resp.pdf");
  });
  it("returns nulls when a brief is missing", () => {
    assert.deepEqual(parseDocketPage("<html></html>"), { petitioner: null, respondent: null, recused: [] });
  });
});

describe("parseSlipListing", () => {
  it("lists OT2024 opinions with dates, dockets and PDF links", () => {
    const list = parseSlipListing(fx("slipopinion-24.html"), 2024);
    const fcc = list.find((o) => o.docket.startsWith("24-354"));
    assert.equal(fcc?.date, "2025-06-27");
    assert.match(fcc!.url, /^https:\/\/www\.supremecourt\.gov\/opinions\/24pdf\/24-354_.+\.pdf$/);
    assert.ok(list.length > 50);
  });
});

describe("currentTerm", () => {
  it("rolls over in October", () => {
    assert.equal(currentTerm(new Date("2026-10-10T12:00:00Z")), 2026);
    assert.equal(currentTerm(new Date("2027-06-30T12:00:00Z")), 2026);
    assert.equal(currentTerm(new Date("2026-09-30T12:00:00Z")), 2025);
  });
});
