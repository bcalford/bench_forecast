// Groups the pages of a U.S. Reports volume into cases, using the running heads:
// "Cite as: 576 U. S. 591 (2015)" on odd pages and "594 JOHNSON v. UNITED STATES" on even pages.
// Pure functions, so they can be tested without downloading anything.

const CITE = /Cite as: (\d{3}) U\. ?S\. (\d+) \((\d{4})\)/;
const EVEN_HEAD = /^\s*\d{1,4}\s+([A-Z0-9][A-Z0-9 .,'’&()\-]+? v\. [A-Z0-9][A-Z0-9 .,'’&()\-]+?|IN RE [A-Z0-9 .,'’&()\-]+?)\s+(?:Opinion|Syllabus|Per Curiam|[A-Z][A-Za-z'’-]+, (?:C\. )?J\.)/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type CaseGroup = { cite: string; name: string; pages: string[]; firstPage: number; year: number | null };

export function groupCases(pages: string[]): CaseGroup[] {
  const groups: CaseGroup[] = [];
  let current: CaseGroup | null = null;
  let inOrders = false;
  pages.forEach((raw, i) => {
    const t = raw.replace(/\s+/g, " ").trim();
    const top = t.slice(0, 220);
    // Orders lists, the Reporter's notes and the index follow the argued cases; none of it is a case's opinion.
    // The orders lists follow the argued cases; once they begin, nothing later is a case's opinion.
    // Reporter's notes and index pages appear anywhere (preliminary prints open with one) and are just skipped.
    if (groups.length && (/^ORDERS\b/.test(t) || /\bORDERS FOR [A-Z]/.test(top))) {
      current = null;
      inOrders = true;
      return;
    }
    if (inOrders || /^(?:Reporter['’]s Note|INDEX\b)/.test(t)) return;
    const cite = top.match(CITE);
    const even = cite ? null : top.match(EVEN_HEAD);
    const key = cite ? `${cite[1]} U.S. ${cite[2]}` : null;
    const name = even?.[1]?.trim() ?? null;
    const startsNew =
      (key && current && current.cite && key !== current.cite) ||
      (name && current && current.name && name !== current.name) ||
      ((key || name) && !current);
    if (startsNew) {
      current = { cite: key ?? "", name: name ?? "", pages: [], firstPage: i + 1, year: cite ? Number(cite[3]) : null };
      groups.push(current);
    }
    if (current) {
      if (key && !current.cite) current.cite = key;
      if (cite && !current.year) current.year = Number(cite[3]);
      if (name && !current.name) current.name = name;
      current.pages.push(raw);
    }
  });
  return groups;
}

export const termOf = (date: string) => {
  const [y, m] = date.split("-").map(Number);
  return `OT${m >= 10 ? y : y - 1}`;
};

export function caseMeta(g: CaseGroup, previousTail: string): { date: string | null; docket: string | null } {
  // The syllabus (and its "Decided" line) sits just before the opinion pages, sometimes on the prior group's last page.
  const text = (previousTail + " " + g.pages.slice(0, 6).join(" ")).replace(/\s+/g, " ");
  const decided = [...text.matchAll(/Decided (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/g)].pop();
  const docket = text.match(/No\. (\d{2}[–-]\d+)/)?.[1]?.replace("–", "-") ?? null;
  const date = decided ? `${decided[3]}-${String(MONTHS.indexOf(decided[1]) + 1).padStart(2, "0")}-${decided[2].padStart(2, "0")}` : null;
  return { date, docket };
}

export const titleCaseName = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bV\. /g, "v. ").replace(/\bU\. S\./g, "U. S.");
