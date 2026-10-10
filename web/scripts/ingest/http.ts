import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Polite fetching: an identifying User-Agent, a pause between requests, retries with backoff on 429/5xx,
// and a disk cache under web/.cache so re-runs never download the same file twice.
export const CACHE = join(process.cwd(), ".cache", "corpus");
const UA = "bench-forecast corpus ingestion (portfolio research project; github.com/bcalford/bench_forecast)";
const PAUSE_MS = 1100;
// CourtListener's API allows about 5 requests a minute on this account, token or not; stay under it.
const COURTLISTENER_API_PAUSE_MS = 12_500;
let last = 0;

async function politeFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const pause = url.includes("courtlistener.com/api/") ? COURTLISTENER_API_PAUSE_MS : PAUSE_MS;
    const wait = last + pause - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, redirect: "follow", signal: AbortSignal.timeout(60_000) });
    } catch (e) {
      // Dropped connections and timeouts are transient; back off and try again rather than ending a long run.
      if (attempt >= 8) throw e;
      const wait = Math.min(120, 2 ** attempt * 5);
      console.warn(`  network error on ${url} (${(e as Error).message}); retrying in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.ok || (res.status < 500 && res.status !== 429) || attempt >= 8) return res;
    const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt * 5;
    console.warn(`  ${res.status} on ${url}; retrying in ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
  }
}

export async function getText(url: string, cacheKey: string, headers?: Record<string, string>): Promise<string> {
  const path = join(CACHE, cacheKey);
  if (existsSync(path)) return readFileSync(path, "utf8");
  const res = await politeFetch(url, headers);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return text;
}

export async function getPdf(url: string, cacheKey: string): Promise<Uint8Array | null> {
  const path = join(CACHE, cacheKey);
  if (existsSync(path)) return new Uint8Array(readFileSync(path));
  const res = await politeFetch(url);
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}
