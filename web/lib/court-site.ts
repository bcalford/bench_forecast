// Parsers for the Supreme Court's website: hearing lists, the transcripts page, docket pages and slip-opinion
// listings. Pure functions over text the callers fetch, so scripts and the Inngest job share them.
export const COURT = "https://www.supremecourt.gov";
export const COURT_HEADERS = { "user-agent": "BenchForecast/1.0 (+https://bench-forecast.vercel.app)" };

const SURNAMES: Record<string, string> = {
  ROBERTS: "roberts", THOMAS: "thomas", ALITO: "alito", SOTOMAYOR: "sotomayor", KAGAN: "kagan",
  GORSUCH: "gorsuch", KAVANAUGH: "kavanaugh", BARRETT: "barrett", JACKSON: "jackson",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&#8217;/g, "’").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
const strip = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export const normalizeDocket = (s: string) => (s.match(/\d{2}[-–]\d+/)?.[0] ?? "").replace("–", "-");

export const currentTerm = (now = new Date()) => (now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);

export type HearingCase = { docket: string; title: string; argued: string; consolidatedWith: string[] };

// "No. 25-170. Suncor Energy (U.S.A.) Inc., et al. v. County Commissioners of Boulder County, et al." under a
// "Monday, October 5, 2026" heading. A caption ends at the next "Certiorari to", "Appeal from", "On writ",
// "(Consolidated", or the next "No." — the last one means the two cases are argued together.
export function parseHearingList(text: string): HearingCase[] {
  const flat = text.replace(/\s+/g, " ");
  const token = /(?:Monday|Tuesday|Wednesday|Thursday|Friday), ([A-Z][a-z]+) (\d{1,2}), (\d{4})|No\. (\d{2}-\d+)\. (.+?)\.\s(?=Certiorari|Appeal|On writ|On appeal|\(Consolidated|No\. \d{2}-\d)/g;
  const out: HearingCase[] = [];
  let date = "";
  let group: HearingCase | null = null;
  for (const m of flat.matchAll(token)) {
    if (m[1]) {
      date = `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      group = null;
      continue;
    }
    const docket = m[4];
    const title = m[5].replace(/,? et al\.?/g, "").replace(/\s+/g, " ").trim();
    const next = flat.slice(m.index! + m[0].length, m.index! + m[0].length + 3);
    if (group) group.consolidatedWith.push(docket);
    else {
      const c: HearingCase = { docket, title, argued: date, consolidatedWith: [] };
      if (!out.some((o) => o.docket === docket)) out.push(c);
      group = c;
    }
    if (next !== "No.") group = null;
  }
  return out;
}

export function parseTranscriptLinks(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/argument_transcripts\/(\d{4})\/(\d{2}-\d+)_([A-Za-z0-9]+)\.pdf/g)) {
    out[m[2]] ??= `${COURT}/oral_arguments/argument_transcripts/${m[1]}/${m[2]}_${m[3]}.pdf`;
  }
  return out;
}

export type DocketDoc = { filed: string; url: string };

// Docket rows are <td class="ProceedingDate">May 14 2026</td><td>Brief of petitioners … filed. <a href= URL
// class="documentanchor">Main Document</a> …</td>. Merits briefs are the last "Brief of petitioner(s)" and
// "Brief of respondent(s)" entries that aren't briefs in opposition.
export function parseDocketPage(html: string): { petitioner: DocketDoc | null; respondent: DocketDoc | null; recused: string[] } {
  let petitioner: DocketDoc | null = null;
  let respondent: DocketDoc | null = null;
  const recused = new Set<string>();
  for (const m of html.matchAll(/<td class="ProceedingDate">([^<]+)<\/td>\s*<td>([\s\S]*?)<\/td>/g)) {
    const filed = m[1].trim();
    const text = strip(m[2]);
    const main = m[2].match(/href=\s*["']?([^"'\s>]+)["']?\s+class="documentanchor"[^>]*>\s*Main Document/);
    const url = main ? (main[1].startsWith("http") ? main[1] : COURT + main[1]) : null;
    if (/took no part|recus/i.test(text)) {
      for (const n of text.match(/\b[A-Z]{4,}\b/g) ?? []) if (SURNAMES[n]) recused.add(SURNAMES[n]);
    }
    if (!url || /in opposition|amic/i.test(text)) continue;
    if (/^Brief of (?:the )?(?:federal )?petitioners?\b/i.test(text)) petitioner = { filed, url };
    else if (/^Brief of (?:the )?(?:federal )?respondents?\b/i.test(text)) respondent = { filed, url };
  }
  return { petitioner, respondent, recused: [...recused] };
}

export type ListedOpinion = { term: string; date: string; docket: string; caseName: string; url: string };

// The Court's slip-opinion listing for a term (available from OT2020 on).
export function parseSlipListing(html: string, year: number): ListedOpinion[] {
  const yy = String(year % 100).padStart(2, "0");
  const rows = html.split(/<tr[\s>]/i).slice(1);
  const out: ListedOpinion[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const link = row.match(new RegExp(`href=['"](/opinions/${yy}pdf/[^'"]+\\.pdf)['"][^>]*>([^<]+)</a>`, "i"));
    if (!link || cells.length < 4) continue;
    const date = cells.map((c) => c.trim()).find((c) => /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(c));
    const docket = cells.map((c) => c.replace(/<[^>]+>/g, "").trim()).find((c) => /^\d{2}[-–]\d+/.test(c) || /^\d+,? Orig\./.test(c));
    if (!date) continue;
    const [mo, d, y] = date.split("/").map(Number);
    out.push({
      term: `OT${year}`,
      date: `20${String(y).padStart(2, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      docket: docket ?? "",
      caseName: decode(link[2]).trim(),
      url: COURT + link[1],
    });
  }
  return [...new Map(out.map((o) => [o.url, o])).values()];
}
