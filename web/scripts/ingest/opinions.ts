// Ingests Supreme Court opinions into each justice's library.
//   npx tsx --env-file=.env.local scripts/ingest/opinions.ts --terms 2020-2025 [--dry-run]
import { opinionPages } from "./pdf-text";
import { getPdf } from "./http";
import { splitOpinion } from "./split";
import { chunk } from "./chunk";
import { listTerm, type ListedOpinion } from "./sources/supremecourt";
import { listTermFromCourtListener } from "./sources/courtlistener";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const [from, to] = (args[args.indexOf("--terms") + 1] ?? "2024").split("-").map(Number);
const terms = Array.from({ length: (to ?? from) - from + 1 }, (_, i) => from + i);

let load: typeof import("./load").loadDocument | null = null;
const tally: Record<string, { docs: number; passages: number; words: number }> = {};
const problems: string[] = [];

async function ingest(op: ListedOpinion) {
  const fromCl = op.url.includes("courtlistener");
  const file = op.url.split("/").slice(fromCl ? -4 : -2).join("/");
  const bytes = await getPdf(op.url, `${fromCl ? "courtlistener" : "supremecourt"}/pdf/${file}`);
  if (!bytes) return problems.push(`${op.term} ${op.caseName}: PDF not available`);
  const { sections } = splitOpinion(await opinionPages(bytes));
  if (!sections.length) problems.push(`${op.term} ${op.caseName}: no signed opinion by a current justice (per curiam, dismissed, or equally divided)`);
  // Stable address per section: justice and role, numbered if the same justice writes twice in one PDF.
  const seen: Record<string, number> = {};
  for (const s of sections) {
    const key = `${s.justice}-${s.role}`;
    const n = (seen[key] = (seen[key] ?? 0) + 1);
    const passages = chunk(s.text);
    const t = (tally[s.justice] ??= { docs: 0, passages: 0, words: 0 });
    t.docs++; t.passages += passages.length; t.words += s.text.split(" ").length;
    await load?.(
      {
        justice: s.justice, kind: "scotus_opinion", role: s.role, label: s.label, caseName: op.caseName,
        date: op.date, url: `${op.url}#${key}${n > 1 ? `-${n}` : ""}`, docket: op.docket,
        term: op.term, pages: s.pages, source: fromCl ? "courtlistener" : "supremecourt.gov",
      },
      passages
    );
  }
}

async function main() {
  if (!dry) load = (await import("./load")).loadDocument;
  for (const year of terms) {
    // supremecourt.gov lists slip opinions from OT2020; earlier terms come from CourtListener's stored copies.
    let listed: ListedOpinion[];
    if (year >= 2020) listed = await listTerm(year);
    else {
      const found = await listTermFromCourtListener(year);
      listed = found.listed;
      for (const m of found.missing) problems.push(`${m}: no stored slip opinion on CourtListener`);
    }
    console.log(`OT${year}: ${listed.length} opinions listed`);
    for (const [i, op] of listed.entries()) {
      try { await ingest(op); } catch (e) { problems.push(`${op.term} ${op.caseName}: ${(e as Error).message}`); }
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${listed.length}`);
    }
  }

  console.log(`\n${dry ? "Dry run (nothing written)" : "Loaded"}:`);
  for (const [j, t] of Object.entries(tally).sort()) console.log(`  ${j.padEnd(10)} ${String(t.docs).padStart(4)} opinions ${String(t.passages).padStart(6)} passages ${String(t.words).padStart(8)} words`);
  if (problems.length) console.log(`\nProblems (${problems.length}):\n  ` + problems.join("\n  "));
}

main().catch((e) => { console.error(e); process.exit(1); });
