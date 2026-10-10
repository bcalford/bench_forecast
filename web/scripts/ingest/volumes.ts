// Ingests OT2011–OT2019 opinions from the U.S. Reports volumes on supremecourt.gov
// (bound volumes 565–587, preliminary prints 588–591). Their slip opinions are no longer listed,
// and CourtListener's search allows only 50 lookups an hour, so whole volumes are split locally:
//   1. pages are grouped into cases by their running heads ("Cite as: 576 U. S. 591 (2015)" on odd
//      pages, "594 JOHNSON v. UNITED STATES" on even pages);
//   2. each case goes through the same opener-based splitter as the slip opinions.
//   npx tsx --env-file=.env.local scripts/ingest/volumes.ts [--volumes 565-591] [--dry-run]
import { opinionPages } from "./pdf-text";
import { getPdf, getText } from "./http";
import { splitOpinion } from "./split";
import { chunk } from "./chunk";
import { caseMeta, groupCases, termOf, titleCaseName } from "./volume-split";

const BASE = "https://www.supremecourt.gov/opinions";
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const [vFrom, vTo] = (args[args.indexOf("--volumes") + 1] ?? "565-591").split("-").map(Number);

// The U.S. Reports page links each volume; preliminary prints come in parts.
async function volumeUrls(): Promise<Map<number, string[]>> {
  const html = await getText(`${BASE}/USReports.aspx`, "supremecourt/usreports.html");
  const urls = new Map<number, string[]>();
  for (const m of html.matchAll(/href=['"]([^'"]*(?:boundvolumes\/(\d{3})BV|preliminaryprint\/(\d{3})US\dPP)[^'"]*\.pdf)['"]/gi)) {
    const vol = Number(m[2] ?? m[3]);
    const url = new URL(m[1], `${BASE}/`).href;
    if (!urls.has(vol)) urls.set(vol, []);
    if (!urls.get(vol)!.includes(url)) urls.get(vol)!.push(url);
  }
  // A preliminary-print part is sometimes linked twice (_final and _web); keep one per part.
  for (const [vol, list] of urls) {
    const byPart = new Map<string, string>();
    for (const u of list) byPart.set(u.match(/US(\d)PP/)?.[1] ?? u, byPart.get(u.match(/US(\d)PP/)?.[1] ?? u) ?? u);
    urls.set(vol, [...byPart.values()]);
  }
  return urls;
}

async function main() {
  const load = dry ? null : (await import("./load")).loadDocument;
  const urls = await volumeUrls();
  const tally: Record<string, { docs: number; passages: number }> = {};
  const problems: string[] = [];

  for (let vol = vFrom; vol <= (vTo ?? vFrom); vol++) {
    const parts = urls.get(vol);
    if (!parts?.length) { problems.push(`volume ${vol}: not linked on USReports.aspx`); continue; }
    let cases = 0;
    for (const url of parts) {
      const bytes = await getPdf(url, `supremecourt/volumes/${url.split("/").pop()}`);
      if (!bytes) { problems.push(`volume ${vol}: ${url} not available`); continue; }
      const pages = await opinionPages(bytes);
      const groups = groupCases(pages);
      for (const g of groups) try {
        // The syllabus page with the "Decided" line sits just before the first page the grouping recognises.
        const meta = caseMeta(g, pages.slice(Math.max(0, g.firstPage - 3), g.firstPage - 1).join(" "));
        const { sections } = splitOpinion(g.pages);
        if (!sections.length || !g.cite) continue;
        cases++;
        const seen: Record<string, number> = {};
        for (const s of sections) {
          const key = `${s.justice}-${s.role}`;
          const n = (seen[key] = (seen[key] ?? 0) + 1);
          const passages = chunk(s.text);
          const t = (tally[s.justice] ??= { docs: 0, passages: 0 });
          t.docs++; t.passages += passages.length;
          // No "Decided" line found: fall back to the year in the page's "Cite as: … (2020)" line.
          const date = meta.date ?? (g.year ? `${g.year}-01-01` : null);
          await load?.(
            {
              justice: s.justice, kind: "scotus_opinion", role: s.role, label: s.label,
              caseName: titleCaseName(g.name || g.cite), date, url: `${url}#${g.cite.replace(/\s/g, "")}-${key}${n > 1 ? `-${n}` : ""}`,
              docket: meta.docket ?? undefined, term: meta.date ? termOf(meta.date) : undefined,
              pages: [g.firstPage + s.pages[0] - 1, g.firstPage + s.pages[1] - 1], source: "supremecourt.gov (U.S. Reports)",
            },
            passages
          );
        }
      } catch (e) {
        problems.push(`volume ${vol} ${g.cite} ${g.name}: ${(e as Error).message}`); // keep going; re-run picks it up
      }
    }
    console.log(`volume ${vol}: ${cases} cases with a current justice's opinion`);
  }

  console.log(`\n${dry ? "Dry run (nothing written)" : "Loaded"}:`);
  for (const [j, t] of Object.entries(tally).sort()) console.log(`  ${j.padEnd(10)} ${String(t.docs).padStart(4)} opinions ${String(t.passages).padStart(6)} passages`);
  if (problems.length) console.log(`\nProblems (${problems.length}):\n  ` + problems.join("\n  "));
}

main().catch((e) => { console.error(e); process.exit(1); });
