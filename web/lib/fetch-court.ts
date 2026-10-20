// Fetching from the Court's site, for the decision job and the owner scripts (no disk cache: runs on Vercel too).
import { COURT_HEADERS } from "./court-site";
import { extractText, getDocumentProxy } from "unpdf";

// A failed fetch from the Court's site. notFound means a 404: the page isn't published (yet), so callers can
// stop or skip; anything else is a real failure and should stop the run rather than look like "not published".
export class CourtFetchError extends Error {
  constructor(message: string, readonly status: number | null) { super(message); }
  get notFound() { return this.status === 404; }
}

type Opts = { waitMs?: number };
const TRIES = 3;

// Three tries, waiting 1 s then 2 s, for network errors, 429 and 5xx. A 404 or other 4xx is final.
async function courtFetch(url: string, { waitMs = 1000 }: Opts): Promise<Response> {
  for (let i = 1; ; i++) {
    let err: Error;
    try {
      const res = await fetch(url, { headers: COURT_HEADERS });
      if (res.ok) return res;
      err = new CourtFetchError(`${res.status} fetching ${url}`, res.status);
      if (res.status !== 429 && res.status < 500) throw err;
    } catch (e) {
      if (e instanceof CourtFetchError && e.status !== 429 && (e.status ?? 0) < 500) throw e;
      err = e instanceof CourtFetchError ? e : new CourtFetchError(`${(e as Error).message} fetching ${url}`, null);
    }
    if (i >= TRIES) throw err;
    await new Promise((r) => setTimeout(r, waitMs * i));
  }
}

export async function courtText(url: string, opts: Opts = {}): Promise<string> {
  return (await courtFetch(url, opts)).text();
}

export async function courtPdf(url: string, opts: Opts = {}): Promise<Uint8Array> {
  const res = await courtFetch(url, opts);
  if (!/pdf/i.test(res.headers.get("content-type") ?? "")) throw new CourtFetchError(`not a PDF (${res.headers.get("content-type")}) at ${url}`, res.status);
  return new Uint8Array(await res.arrayBuffer());
}

// The opening pages of an opinion (syllabus first) as one string. Plain text, not the corpus reader's
// footnote-stripping pages: in preliminary prints the end of the syllabus, judgment line included, is set
// smaller than body text and would be dropped. The opinion body's "JUSTICE X delivered…" form doesn't match
// readDecision's "X, J., delivered…", so the extra pages do no harm.
export async function syllabusText(pdfUrl: string): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(await courtPdf(pdfUrl)), { mergePages: false });
  return (text as string[]).slice(0, 12).join("\n");
}
