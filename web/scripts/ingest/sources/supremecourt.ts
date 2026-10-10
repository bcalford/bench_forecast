import { getText } from "../http";

export type ListedOpinion = { term: string; date: string; docket: string; caseName: string; url: string };

const BASE = "https://www.supremecourt.gov";

// The Court's own slip-opinion listing for a term (available from OT2020 on; earlier terms
// have moved to the bound U.S. Reports, so those come from CourtListener's stored copies).
export async function listTerm(year: number): Promise<ListedOpinion[]> {
  const yy = String(year % 100).padStart(2, "0");
  const html = await getText(`${BASE}/opinions/slipopinion/${yy}`, `supremecourt/listing-${yy}.html`);
  const rows = html.split(/<tr[\s>]/i).slice(1);
  const out: ListedOpinion[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const link = row.match(new RegExp(`href=['"](/opinions/${yy}pdf/[^'"]+\\.pdf)['"][^>]*>([^<]+)</a>`, "i"));
    if (!link || cells.length < 4) continue;
    const date = cells.map((c) => c.trim()).find((c) => /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(c));
    const docket = cells.map((c) => c.replace(/<[^>]+>/g, "").trim()).find((c) => /^\d{2}[-–]\d+/.test(c) || /^\d+,? Orig\./.test(c));
    if (!date) continue;
    const [m, d, y] = date.split("/").map(Number);
    out.push({
      term: `OT${year}`,
      date: `20${String(y).padStart(2, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      docket: docket ?? "",
      caseName: link[2].replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "’").trim(),
      url: BASE + link[1],
    });
  }
  return [...new Map(out.map((o) => [o.url, o])).values()];
}
