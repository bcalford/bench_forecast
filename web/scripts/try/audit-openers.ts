// Finds sentences that look like an opinion's opening line but that the splitter's OPENER pattern misses.
//   npx tsx scripts/try/audit-openers.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { opinionPages } from "../ingest/pdf-text";
import { OPENER } from "../ingest/split";

const LOOSE = /(?:CHIEF JUSTICE|JUSTICE|Chief Justice|Justice) ([A-Z][A-Za-z'’-]+)(?:, with whom [^.]{0,300}?joins?[^.]{0,200}?)?, ([a-z][^.]{0,200}?(?:concurring|dissenting)[^.]{0,200}?)\.\s+(?=[A-Z“"])/g;

async function main() {
  const dirs = [".cache/corpus/supremecourt/volumes", ...readdirSync(".cache/corpus/supremecourt/pdf").map((d) => join(".cache/corpus/supremecourt/pdf", d))];
  const misses = new Map<string, { n: number; example: string }>();
  let files = 0, openers = 0;
  for (const dir of dirs) for (const f of readdirSync(dir).filter((x) => x.endsWith(".pdf"))) {
    files++;
    const text = (await opinionPages(new Uint8Array(readFileSync(join(dir, f))))).join(" ").replace(/\s+/g, " ");
    const strict = new Set([...text.matchAll(new RegExp(OPENER.source, "g"))].map((m) => m.index));
    for (const m of text.matchAll(LOOSE)) {
      // A real opener follows the end of the previous opinion or a caption, i.e. a sentence end.
      const before = text.slice(Math.max(0, m.index! - 3), m.index!);
      if (!/[.”\]] ?$|ordered\. ?$/.test(before)) continue;
      openers++;
      if (strict.has(m.index)) continue;
      const key = m[2].replace(/\b(?:I|II|III|IV|V|VI|[A-Z])\b/g, "#").slice(0, 90);
      const e = misses.get(key) ?? { n: 0, example: `${f}: …${text.slice(m.index!, m.index! + 220)}…` };
      e.n++;
      misses.set(key, e);
    }
  }
  console.log(`${files} PDFs, ${openers} opener-like sentences, ${[...misses.values()].reduce((s, x) => s + x.n, 0)} missed`);
  for (const [k, v] of [...misses].sort((a, b) => b[1].n - a[1].n)) console.log(`\n${String(v.n).padStart(3)}  ${k}\n     ${v.example}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
