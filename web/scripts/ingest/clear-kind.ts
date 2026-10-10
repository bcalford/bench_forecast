// Deletes every document of one kind (and, by cascade, its passages) in small batches, so no single statement
// hits the database's time limit. Used before re-splitting a source from scratch.
//   npx tsx --env-file=.env.local scripts/ingest/clear-kind.ts scotus_opinion
import { createClient } from "@supabase/supabase-js";

const kind = process.argv[2];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  if (!["scotus_opinion", "oral_argument", "lower_court"].includes(kind)) throw new Error(`unknown kind ${kind}`);
  let deleted = 0;
  for (;;) {
    const { data, error } = await db.from("documents").select("id").eq("kind", kind).limit(25);
    if (error) throw new Error(error.message);
    if (!data.length) break;
    const del = await db.from("documents").delete().in("id", data.map((d) => d.id));
    if (del.error) throw new Error(del.error.message);
    deleted += data.length;
    if (deleted % 500 < 25) console.log(`  ${deleted} deleted`);
  }
  console.log(`Deleted ${deleted} ${kind} documents.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
