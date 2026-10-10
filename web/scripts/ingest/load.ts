import { createClient } from "@supabase/supabase-js";
import type { Role } from "./split";
import { ok, withRetry } from "../../lib/retry";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Run with --env-file=.env.local (Supabase URL and service-role key are required).");
const db = createClient(url, key, { auth: { persistSession: false } });

export type DocumentInput = {
  justice: string;
  kind: "scotus_opinion" | "oral_argument" | "lower_court";
  role: Role | "argument" | "lower_court";
  label: string;
  caseName: string;
  date: string | null;
  url: string;
  docket?: string;
  term?: string;
  pages?: [number, number];
  source: string;
};

// Idempotent: the document is upserted on (justice, url) and its passages are replaced,
// so re-running a term never duplicates anything. Embeddings are added by a separate step.
export async function loadDocument(doc: DocumentInput, passages: string[]): Promise<void> {
  const row = {
    justice: doc.justice, kind: doc.kind, role: doc.role, label: doc.label, case_name: doc.caseName,
    date: doc.date || null, url: doc.url, docket: doc.docket ?? null, term: doc.term ?? null,
    page_start: doc.pages?.[0] ?? null, page_end: doc.pages?.[1] ?? null, source: doc.source,
  };
  const data = await withRetry("documents upsert", () => ok(db.from("documents").upsert(row, { onConflict: "justice,url" }).select("id").single()));
  if (!data) throw new Error(`documents upsert returned no row for ${doc.url}`);

  await withRetry("passages delete", () => ok(db.from("passages").delete().eq("document_id", data.id)));
  for (let i = 0; i < passages.length; i += 200) {
    const rows = passages.slice(i, i + 200).map((text, k) => ({ document_id: data.id, justice: doc.justice, text, ordinal: i + k }));
    await withRetry("passages insert", () => ok(db.from("passages").insert(rows)));
  }
}
