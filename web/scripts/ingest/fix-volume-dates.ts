// Corrects decision dates and terms on U.S. Reports documents in place (no passage reload, so embeddings stay).
// Re-reads the cached volumes: the "Decided" line where found, otherwise the year in "Cite as: … (2020)".
//   npx tsx --env-file=.env.local scripts/ingest/fix-volume-dates.ts
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { opinionPages } from "./pdf-text";
import { caseMeta, groupCases, termOf } from "./volume-split";
import { ok, withRetry } from "../../lib/retry";

const DIR = join(".cache", "corpus", "supremecourt", "volumes");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  let updated = 0, cases = 0;
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".pdf")).sort()) {
    const pages = await opinionPages(new Uint8Array(readFileSync(join(DIR, file))));
    for (const g of groupCases(pages)) {
      if (!g.cite) continue;
      const meta = caseMeta(g, pages.slice(Math.max(0, g.firstPage - 3), g.firstPage - 1).join(" "));
      const date = meta.date ?? (g.year ? `${g.year}-01-01` : null);
      if (!date) continue;
      const fragment = `#${g.cite.replace(/\s/g, "")}-`;
      const rows = await withRetry("update", () =>
        ok(db.from("documents").update({ date, term: meta.date ? termOf(meta.date) : null }).like("url", `%/${file}${fragment}%`).select("id")),
      );
      cases++;
      updated += rows?.length ?? 0;
    }
    console.log(`${file}: done`);
  }
  console.log(`Updated ${updated} documents across ${cases} cases.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
