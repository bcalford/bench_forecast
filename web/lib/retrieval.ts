// Finds the passages from one justice's own library that bear on a case (spec.md §3.3).
// Each of the summary's issue phrases (plus the question presented) is a query; results are pooled,
// ranked by their best similarity, and capped per source document so one long opinion can't crowd out the rest.
import { serviceClient } from "./supabase";
import { embedQueries } from "./embedding";
import { ok, withRetry } from "./retry";

export type RetrievedPassage = {
  id: string;
  documentId: string;
  text: string;
  similarity: number;
  caseName: string;
  date: string | null;
  label: string | null; // "Opinion of the Court", "Kagan, J., dissenting", "Oral argument", …
  kind: string;
  url: string;
};

type Match = { id: string; document_id: string; text: string; similarity: number };

export async function retrieveForJustice(
  justice: string,
  queries: string[],
  opts: {
    perQuery?: number;
    total?: number;
    perDocument?: number;
    queryEmbeddings?: number[][];
    // Leakage guards (spec.md §7): never return the case being forecast, nor anything written on or after the
    // as-of date (for a pending case, today; for a backtest, the argument date), which could state the outcome.
    excludeDocket?: string;
    before?: string; // YYYY-MM-DD
  } = {},
): Promise<RetrievedPassage[]> {
  const { perQuery = 20, total = 24, perDocument = 3, excludeDocket, before } = opts;
  const db = serviceClient();
  const vectors = opts.queryEmbeddings ?? (await embedQueries(queries));

  // A few searches at a time: each takes 1–5 s on this database instance, and a burst of them would push
  // some past the statement time limit. A search that still times out is retried.
  const best = new Map<string, Match>();
  const queue = [...vectors];
  const worker = async () => {
    for (let v = queue.shift(); v; v = queue.shift()) {
      const vector = JSON.stringify(v);
      const data = (await withRetry(`match_passages ${justice}`, () =>
        ok(db.rpc("match_passages", { query_embedding: vector, for_justice: justice, match_count: perQuery })),
      )) as Match[] | null;
      for (const m of data ?? []) if ((best.get(m.id)?.similarity ?? -1) < m.similarity) best.set(m.id, m);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, vectors.length) }, worker));

  if (!best.size) return [];
  const { data: docs, error } = await db
    .from("documents")
    .select("id, case_name, date, label, kind, url, docket")
    .in("id", [...new Set([...best.values()].map((m) => m.document_id))]);
  if (error) throw new Error(`documents: ${error.message}`);
  const norm = (d: string | null) => (d ?? "").replace(/[–—]/g, "-").trim();
  const allowed = docs.filter(
    (d) => !(excludeDocket && norm(d.docket) === norm(excludeDocket)) && !(before && (!d.date || d.date >= before)),
  );
  const byId = new Map(allowed.map((d) => [d.id, d]));

  const perDoc = new Map<string, number>();
  const picked = [...best.values()]
    .filter((m) => byId.has(m.document_id))
    .sort((a, b) => b.similarity - a.similarity)
    .filter((m) => {
      const n = perDoc.get(m.document_id) ?? 0;
      if (n >= perDocument) return false;
      perDoc.set(m.document_id, n + 1);
      return true;
    })
    .slice(0, total);
  return picked.map((m) => {
    const d = byId.get(m.document_id)!;
    return { id: m.id, documentId: m.document_id, text: m.text, similarity: m.similarity, caseName: d.case_name, date: d.date, label: d.label, kind: d.kind, url: d.url };
  });
}
