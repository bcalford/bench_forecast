// Ingests each justice's questions from oral-argument transcripts.
//   npx tsx --env-file=.env.local scripts/ingest/transcripts.ts --terms 2011-2025 [--dry-run]
import { extractText, getDocumentProxy } from "unpdf";
import { getPdf } from "./http";
import { justiceTurns } from "../../lib/transcripts";
import { chunk } from "./chunk";
import { listArguments } from "./sources/transcripts";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const [from, to] = (args[args.indexOf("--terms") + 1] ?? "2024").split("-").map(Number);
const terms = Array.from({ length: (to ?? from) - from + 1 }, (_, i) => from + i);
const tally: Record<string, { args: number; turns: number; passages: number; words: number }> = {};
const problems: string[] = [];

async function main() {
  const load = dry ? null : (await import("./load")).loadDocument;
  for (const year of terms) {
    const listed = await listArguments(year);
    console.log(`OT${year}: ${listed.length} arguments listed`);
    for (const [i, a] of listed.entries()) {
      try {
        const bytes = await getPdf(a.url, `supremecourt/arguments/${year}/${a.url.split("/").pop()}`);
        if (!bytes) { problems.push(`${a.term} ${a.caseName}: PDF not available`); continue; }
        const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: false });
        const turns = justiceTurns(text as string[]);
        if (!Object.keys(turns).length) problems.push(`${a.term} ${a.caseName}: no justice turns found`);
        for (const [justice, t] of Object.entries(turns)) {
          const passages = chunk(t.text, 180, 30);
          const s = (tally[justice] ??= { args: 0, turns: 0, passages: 0, words: 0 });
          s.args++; s.turns += t.turns; s.passages += passages.length; s.words += t.text.split(" ").length;
          await load?.(
            {
              justice, kind: "oral_argument", role: "argument", label: "Oral argument", caseName: a.caseName,
              date: a.date, url: `${a.url}#${justice}`, docket: a.docket, term: a.term, source: "supremecourt.gov",
            },
            passages
          );
        }
      } catch (e) {
        problems.push(`${a.term} ${a.caseName}: ${(e as Error).message}`);
      }
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${listed.length}`);
    }
  }
  console.log(`\n${dry ? "Dry run (nothing written)" : "Loaded"}:`);
  for (const [j, t] of Object.entries(tally).sort())
    console.log(`  ${j.padEnd(10)} ${String(t.args).padStart(4)} arguments ${String(t.turns).padStart(6)} turns ${String(t.passages).padStart(6)} passages ${String(t.words).padStart(8)} words`);
  if (problems.length) console.log(`\nProblems (${problems.length}):\n  ` + problems.join("\n  "));
}

main().catch((e) => { console.error(e); process.exit(1); });
