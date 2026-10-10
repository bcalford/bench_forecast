import { getText } from "../http";

export type ListedArgument = { term: string; date: string; docket: string; caseName: string; url: string };
const BASE = "https://www.supremecourt.gov/oral_arguments";

// The Court's argument-transcript listing for a term (named justices from OT2004; listed here from OT2011).
export async function listArguments(year: number): Promise<ListedArgument[]> {
  const html = await getText(`${BASE}/argument_transcript/${year}`, `supremecourt/arguments-${year}.html`);
  const out: ListedArgument[] = [];
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const link = row.match(new RegExp(`href=['"]\\.\\./(argument_transcripts/${year}/[^'"]+\\.pdf)['"][^>]*>([^<]+)</a>`, "i"));
    const name = row.match(/<span style='display:block;'>([^<]+)<\/span>/i);
    const date = row.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (!link || !date) continue;
    out.push({
      term: `OT${year}`,
      date: `20${date[3]}-${date[1]}-${date[2]}`,
      docket: link[2].trim(),
      caseName: (name?.[1] ?? link[2]).replace(/&amp;/g, "&").replace(/&#39;/g, "’").trim(),
      url: `${BASE}/${link[1]}`,
    });
  }
  return [...new Map(out.map((o) => [o.url, o])).values()];
}
