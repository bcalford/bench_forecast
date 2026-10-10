// Page text for opinion PDFs, without footnotes.
// In the U.S. Reports a new opinion can begin partway down a page whose footnotes still belong to the previous
// opinion, so with footnotes left in, a majority's footnotes get filed under the concurrence or dissent that
// follows. This drops the footnote block: smaller-than-body text below the page's last line of body text.
import { getDocumentProxy } from "unpdf";

type Item = { str: string; size: number; y: number; hasEOL?: boolean };

const round = (h: number) => Math.round(h * 2) / 2;

export async function opinionPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes.slice());
  const pages: { items: Item[]; headZone: number }[] = [];
  const weight = new Map<number, number>();

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const [, y0, , y1] = page.view;
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const i of content.items) {
      if (!("transform" in i)) continue; // marked-content markers carry no text
      const it = { str: i.str, size: round(Math.abs(i.transform[3]) || i.height), y: i.transform[5], hasEOL: i.hasEOL };
      items.push(it);
      weight.set(it.size, (weight.get(it.size) ?? 0) + it.str.length);
    }
    pages.push({ items, headZone: y1 - (y1 - y0) * 0.08 }); // running heads sit in the top 8% of the page
  }

  // Body size is constant through a document; on a single page a long footnote can outweigh the body.
  const body = [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const isBody = (i: Item) => i.size >= body * 0.9;

  return pages.map(({ items, headZone }) => {
    // Footnotes sit together below the last line of body-size text. Small text above that line is inline
    // (the small capitals of "Justice Sotomayor" in an opinion's first sentence) and must stay.
    const bodyLines = items.filter((i) => isBody(i) && i.y < headZone && i.str.trim());
    const lowestBody = bodyLines.length ? Math.min(...bodyLines.map((i) => i.y)) : -Infinity;
    const kept = items.filter((i) => i.y >= headZone || isBody(i) || i.y >= lowestBody - 1);
    return kept
      .map((i) => i.str + (i.hasEOL ? "\n" : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .replace(/ ([,.;:)\]”’])/g, "$1") // "Sotomayor , concurring" -> "Sotomayor, concurring"
      .replace(/([a-z]) ?- \n? ?([a-z])/g, "$1$2"); // "Em - ployers" -> "Employers"
  });
}
