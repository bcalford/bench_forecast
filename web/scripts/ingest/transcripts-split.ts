// Pulls each justice's own words out of an oral-argument transcript.
// Pure functions: page texts in, one block of questions per justice out.
//
// The Court has used three page layouts since OT2011:
//   OT2019+       "1 2 3 … 25 <page> Official <text>"               (line numbers in a column)
//   OT2017–2018   "5 10 15 20 25 <page> Official - Subject to Final Review 1 <text> 2 <text> …"
//   OT2011–2016   "Official Alderson Reporting Company <page> 1 <text> 2 <text> …"
// In the last two, line numbers land inside the text and are removed by following their 1…25 sequence.

const SURNAMES: Record<string, string> = {
  ROBERTS: "roberts", THOMAS: "thomas", ALITO: "alito", SOTOMAYOR: "sotomayor", KAGAN: "kagan",
  GORSUCH: "gorsuch", KAVANAUGH: "kavanaugh", BARRETT: "barrett", JACKSON: "jackson",
};

const COLUMN_PREFIX = /^\s*1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25\s+\d+\s+/;
const MARGIN_PREFIX = /^\s*5 10 15 20 25\s+\d+\s+/;
const FURNITURE = /\(202\) 628-4888|www\.hrccourtreporters\.com|Official - Subject to Final Review|Official Alderson Reporting Company|Alderson Reporting Company|Heritage Reporting Corporation|^\s*Official\s+/g;
const SPEAKER = /\b((?:CHIEF )?JUSTICE [A-Z][A-Za-z'’-]+|GENERAL [A-Z][A-Za-z'’-]+|M(?:R|S|RS)\. [A-Z][A-Za-z'’-]+(?: [A-Z][A-Za-z'’-]+)?):\s/g;

// The word index at the back lists terms with counts and page:line references: "substantial [15] 10:9 27:4".
const isIndexPage = (t: string) => (t.match(/\[\d+\]\s+\d+:\d+/g) ?? []).length >= 5;

// Extraction sometimes drops a line number, so a number up to two ahead of the expected one also counts.
function stripInlineLineNumbers(text: string): string {
  let expected = 1;
  return text
    .split(" ")
    .filter((token) => {
      if (!/^\d{1,2}$/.test(token)) return true;
      const n = Number(token);
      if (expected <= 25 && n >= expected && n <= expected + 2) { expected = n + 1; return false; }
      return true;
    })
    .join(" ");
}

function cleanPage(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  if (COLUMN_PREFIX.test(t)) return t.replace(COLUMN_PREFIX, "").replace(FURNITURE, " ").replace(/\s+/g, " ").trim();
  const margin = MARGIN_PREFIX.test(t);
  t = t.replace(MARGIN_PREFIX, "").replace(FURNITURE, " ").replace(/\s+/g, " ").trim();
  if (!margin) t = t.replace(/^\d+\s+/, ""); // Alderson: the page number leads, before line 1
  return stripInlineLineNumbers(t);
}

export type Turns = Record<string, { turns: number; text: string }>;

export function justiceTurns(pages: string[]): Turns {
  const kept = pages.filter((p) => !isIndexPage(p)).map(cleanPage);
  let body = kept.join(" ");
  // Argument starts at the proceedings and ends when the case is submitted.
  const start = body.search(/P ?R ?O ?C ?E ?E ?D ?I ?N ?G ?S/);
  if (start >= 0) body = body.slice(start);
  body = body.replace(/\(Whereupon,[\s\S]*$/i, "");

  const marks = [...body.matchAll(SPEAKER)];
  const out: Turns = {};
  marks.forEach((m, i) => {
    const name = m[1].match(/JUSTICE ([A-Z][A-Za-z'’-]+)$/)?.[1]?.toUpperCase();
    const slug = name && SURNAMES[name];
    if (!slug) return;
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
    const said = body.slice(m.index! + m[0].length, end).replace(/([a-z])- ([a-z])/g, "$1$2").replace(/\s+/g, " ").trim();
    // Skip pure procedure ("Thank you, counsel." / "Mr. Clement.") so passages carry substance.
    if (said.split(" ").length < 6) return;
    const j = (out[slug] ??= { turns: 0, text: "" });
    j.turns++;
    j.text += (j.text ? " " : "") + said;
  });
  return out;
}
