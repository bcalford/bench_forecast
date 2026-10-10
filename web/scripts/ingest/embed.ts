// Embeds every passage that has no embedding yet. Safe to stop and re-run: it always resumes
// from whatever is still missing.
//   npx tsx --env-file=.env.local scripts/ingest/embed.ts [--limit 2000] [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { EMBEDDING_MODEL } from "../../lib/embedding";
import { ok, withRetry } from "../../lib/retry";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const BATCH = 64;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_KEY) throw new Error("VOYAGE_API_KEY is missing from .env.local");

type Row = { id: string; document_id: string; justice: string; text: string; ordinal: number };

async function embed(texts: string[]): Promise<{ vectors: number[][]; tokens: number }> {
  // The whole exchange is retried, including reading the body: a connection can drop mid-response.
  return withRetry("voyage", async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${VOYAGE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, input_type: "document" }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        const body = await res.json();
        return { vectors: body.data.map((d: { embedding: number[] }) => d.embedding), tokens: body.usage.total_tokens };
      }
      if (res.status === 429 && attempt < 8) {
        const wait = Number(res.headers.get("retry-after")) || Math.min(60, 2 ** attempt * 5);
        console.warn(`  Voyage 429; retrying in ${wait}s`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }, 8);
}

async function main() {
  // The count is informational only: on a large table it can time out, and a failed count must not read as zero.
  const { count, error: countError } = await db.from("passages").select("id", { count: "exact", head: true }).is("embedding", null);
  console.log(countError ? `count unavailable (${countError.message}); embedding until none are left` : `${count} passages without an embedding (model ${EMBEDDING_MODEL})`);
  if (dry || (!countError && count === 0)) return;

  let done = 0;
  let tokens = 0;
  while (done < limit) {
    const data = (await withRetry("select", () =>
      ok(db.from("passages").select("id, document_id, justice, text, ordinal").is("embedding", null).limit(Math.min(BATCH * 8, limit - done))),
    )) ?? [];
    if (!data.length) break;

    for (let i = 0; i < data.length; i += BATCH) {
      const rows = data.slice(i, i + BATCH) as Row[];
      const { vectors, tokens: used } = await embed(rows.map((r) => r.text));
      tokens += used;
      // Full rows, so the upsert's insert path satisfies NOT NULL; it always resolves to an update.
      // Small writes: each inserted vector also updates the search index, and big batches hit the statement timeout.
      for (let k = 0; k < rows.length; k += 16) {
        const part = rows.slice(k, k + 16).map((r, i) => ({ ...r, embedding: JSON.stringify(vectors[k + i]) }));
        await withRetry("passages upsert", () => ok(db.from("passages").upsert(part, { onConflict: "id" })));
      }
      done += rows.length;
    }
    console.log(`  ${done} embedded, ${tokens.toLocaleString()} tokens so far`);
  }
  console.log(`Done: ${done} passages, ${tokens.toLocaleString()} tokens.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
