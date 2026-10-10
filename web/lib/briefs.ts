// Turns a brief PDF into text the model reads. Text is about a quarter of the tokens of native PDF input
// (which bills every page's image as well), and the briefs are read by the summarizer and all nine agents.
// A scanned brief has no text layer, so it falls back to native PDF.
import { extractText, getDocumentProxy } from "unpdf";

export type PreparedBrief =
  | { label: string; kind: "text"; text: string; pages: number }
  | { label: string; kind: "pdf"; pdfBase64: string; pages: number };

const MIN_CHARS_PER_PAGE = 400; // well below any typeset brief page; scans yield almost nothing

export async function prepareBrief(label: string, bytes: Uint8Array): Promise<PreparedBrief> {
  const { totalPages, text } = await extractText(await getDocumentProxy(bytes.slice()), { mergePages: true });
  const cleaned = (text as string).replace(/[ \t]+/g, " ").replace(/([a-z])- \n?([a-z])/g, "$1$2").trim();
  if (cleaned.length / Math.max(1, totalPages) < MIN_CHARS_PER_PAGE) {
    return { label, kind: "pdf", pdfBase64: Buffer.from(bytes).toString("base64"), pages: totalPages };
  }
  return { label, kind: "text", text: cleaned, pages: totalPages };
}
