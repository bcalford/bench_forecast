// Fetching from the Court's site, for the decision job and the owner scripts (no disk cache: runs on Vercel too).
import { COURT_HEADERS } from "./court-site";
import { extractText, getDocumentProxy } from "unpdf";

export async function courtText(url: string): Promise<string> {
  const res = await fetch(url, { headers: COURT_HEADERS });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

export async function courtPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: COURT_HEADERS });
  if (!res.ok || !/pdf/i.test(res.headers.get("content-type") ?? "")) throw new Error(`${res.status} fetching PDF ${url}`);
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
