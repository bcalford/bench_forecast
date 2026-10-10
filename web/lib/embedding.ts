// One embedding model for the whole library and for every retrieval query; mixing models breaks similarity.
// voyage-law-2 is Voyage's legal-domain model (1024 dimensions, matching passages.embedding).
export const EMBEDDING_MODEL = "voyage-law-2";
export const EMBEDDING_DIMENSIONS = 1024;

// Embeds search queries (input_type "query" pairs with the "document" type used for the library).
export async function embedQueries(texts: string[]): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is missing");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, input_type: "query" }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return body.data.map((d: { embedding: number[] }) => d.embedding);
}
