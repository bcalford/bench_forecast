// Runs SQL against the database directly (no API time limit): a file, or a statement on the command line.
//   npx tsx --env-file=.env.local scripts/db/sql.ts supabase/migrations/xxxx.sql
//   npx tsx --env-file=.env.local scripts/db/sql.ts -c "select 1"
import { readFileSync } from "node:fs";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing from .env.local");
  const sql = process.argv[2] === "-c" ? process.argv[3] : readFileSync(process.argv[2], "utf8");
  // Supabase's database is always named "postgres"; set it in the URL in case the pasted string is cut short.
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  const client = new pg.Client({ connectionString: parsed.toString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const started = Date.now();
    const result = await client.query(sql);
    for (const r of Array.isArray(result) ? result : [result]) {
      if (r.rows?.length) console.table(r.rows);
      else console.log(`${r.command ?? "ok"}${r.rowCount != null ? ` (${r.rowCount})` : ""}`);
    }
    console.log(`done in ${Date.now() - started} ms`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
