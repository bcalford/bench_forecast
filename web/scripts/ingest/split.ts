// Splits a Supreme Court opinion PDF into each justice's own writing.
//
// Every opinion opens with a sentence that names its author, in both formats the Court publishes:
//   slip opinions          "JUSTICE KAGAN delivered the opinion of the Court."
//   U.S. Reports prints    "Justice Gorsuch, with whom Justice Thomas joins, concurring."
// Those opening sentences are the boundaries. Page running heads ("KAGAN, J., dissenting") are only used
// to drop syllabus and appendix pages and to strip the head itself. Splitting on openers rather than on
// pages matters because the U.S. Reports prints run short opinions together on one page.
// Pure functions: page texts in, attributed sections out.

export type Role =
  | "majority"
  | "plurality"
  | "concurrence"
  | "concurrence_judgment"
  | "dissent"
  | "concur_dissent"
  | "statement";

export type Section = {
  justice: string; // roster slug
  role: Role;
  label: string; // e.g. "Opinion of the Court", "Kagan, J., dissenting"
  pages: [number, number]; // 1-based, inclusive
  text: string;
};

// Current roster. Opinions by former justices are skipped.
const SURNAMES: Record<string, string> = {
  ROBERTS: "roberts", THOMAS: "thomas", ALITO: "alito", SOTOMAYOR: "sotomayor", KAGAN: "kagan",
  GORSUCH: "gorsuch", KAVANAUGH: "kavanaugh", BARRETT: "barrett", JACKSON: "jackson",
};

// Role words, including part qualifiers: "concurring in Parts I and II–B and in the judgment".
const ROLE_WORDS = "(?:concurring|dissenting)(?:[ ,]+(?:in|part|parts?|Parts?|and|the|judgment|concurring|dissenting|from|denial|of|certiorari|application|for|stay|grant|order|dismissal|as|to|except|[IVX]+(?:[–-][A-Z0-9]+)*|[A-Z0-9](?=[,. ])))*";
const NAME = "([A-Z][A-Za-z'’-]+)";
const JUSTICE = `(?:CHIEF JUSTICE|JUSTICE|Chief Justice|Justice) ${NAME}`;

// One alternation per kind of opening sentence; capture groups say which matched.
const OPENER = new RegExp(
  [
    `${JUSTICE} delivered the opinion of the Court[^.]{0,250}\\.`, // 1: majority author
    `${JUSTICE} announced the judgment of the Court[^.]{0,400}\\.`, // 2: plurality author
    // Joinder lists can be long and comma-laden ("…joins as to Parts I–A, I–B, and II, concurring").
    // The role ends the sentence: "Justice Sotomayor, dissenting in part." A mention inside another opinion keeps
    // going ("Justice Sotomayor, dissenting in part, renews a debate…") and must not start a section.
    `${JUSTICE}(?:, with whom [^.]{0,300}?joins?[^.]{0,200}?)?, (${ROLE_WORDS})\\s*\\.`, // 3, 4: separate opinion
    // Some U.S. Reports prints open a separate opinion with the short form: "Thomas, J., concurring." A citation
    // of that form always ends in a parenthesis ("(Thomas, J., concurring).") and so never matches.
    `(?<![(\\[])\\b${NAME}, (?:C\\. )?J\\., (${ROLE_WORDS})\\s*\\.`, // 5, 6: separate opinion, short form
    `\\bPER CURIAM\\.|\\bPer Curiam\\.`, // unsigned: ends the previous section, attributed to no one
  ].join("|"),
  "g"
);

// Running heads: used to skip whole pages and to strip the head text from each page.
const HEAD_LABEL = new RegExp(
  `(?<![(\\[])(?:\\b${NAME}, (?:C\\. )?J\\., ${ROLE_WORDS}|Opinion of the Court|Opinion of ${NAME}, (?:C\\. )?J\\.|Per Curiam)`
);
function pageKind(pageText: string): "syllabus" | "appendix" | "body" {
  const top = pageText.replace(/\s+/g, " ").slice(0, 260);
  if (/\bAppendix\b/.test(top)) return "appendix";
  if (/\bSyllabus\b/.test(top) && !/delivered the opinion of the Court|Opinion of the Court/.test(top)) return "syllabus";
  return "body";
}

function roleOf(words: string): Role {
  const w = words.toLowerCase();
  if (w.includes("dissenting") && w.includes("concurring")) return "concur_dissent";
  if (w.startsWith("dissenting")) return "dissent";
  if (w.includes("judgment")) return "concurrence_judgment";
  return "concurrence";
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

// Strips page furniture: the running head, "Cite as" lines, proof stamps and page numbers.
function cleanPage(pageText: string): string {
  let t = pageText.replace(/\s+/g, " ").trim();
  const head = t.slice(0, 260).match(HEAD_LABEL);
  if (head?.index !== undefined) t = t.slice(head.index + head[0].length);
  return t
    .replace(/Page Proof Pending Publication/g, " ")
    .replace(/\(Slip Opinion\)|OCTOBER TERM, \d{4}/g, " ")
    .replace(/_{3,}/g, " ")
    .replace(/([a-z])- ([a-z])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

// Everything after an opinion's last sentence and before the next opener is caption and notice text.
function trimCaption(text: string): string {
  const cut = text.search(/SUPREME COURT OF THE UNITED STATES|NOTICE: This opinion is subject to formal revision/);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

export function splitOpinion(pages: string[]): { sections: Section[]; skipped: string[] } {
  // Concatenate the body pages, remembering where each page starts.
  let full = "";
  const starts: { offset: number; page: number }[] = [];
  pages.forEach((p, i) => {
    if (pageKind(p) !== "body") return;
    starts.push({ offset: full.length, page: i + 1 });
    full += cleanPage(p) + " ";
  });
  const pageAt = (offset: number) => {
    let page = starts[0]?.page ?? 1;
    for (const s of starts) if (s.offset <= offset) page = s.page; else break;
    return page;
  };

  const openers = [...full.matchAll(OPENER)];
  const sections: Section[] = [];
  const skipped: string[] = [];

  openers.forEach((m, i) => {
    const from = m.index! + m[0].length;
    const to = i + 1 < openers.length ? openers[i + 1].index! : full.length;
    const text = trimCaption(full.slice(from, to));
    const pagesSpan: [number, number] = [pageAt(m.index!), pageAt(Math.max(from, to - 1))];
    const [, majority, plurality, separateLong, roleLong, separateShort, roleShort] = m;
    const separate = separateLong ?? separateShort;
    const roleWords = roleLong ?? roleShort;
    const surname = majority ?? plurality ?? separate;
    if (!surname) return skipped.push(`per curiam p.${pagesSpan.join("–")}`);
    const slug = SURNAMES[surname.toUpperCase()];
    const role: Role = majority ? "majority" : plurality ? "plurality" : roleOf(roleWords);
    const label = majority ? "Opinion of the Court" : plurality ? `Opinion of ${titleCase(surname)}, J.` : `${titleCase(surname)}, J., ${roleWords}`;
    if (!slug) return skipped.push(`${label} by ${titleCase(surname)} p.${pagesSpan.join("–")}`);
    // The syllabus's own summary ("Pp. 157–162. (a) …") sometimes lands after an opener; it is not the justice's.
    if (/^\s*Pp\. \d/.test(text)) return skipped.push(`syllabus text after ${label} p.${pagesSpan.join("–")}`);
    if (text.split(" ").length < 25) return skipped.push(`${label} (${titleCase(surname)}): too short, p.${pagesSpan.join("–")}`);
    sections.push({ justice: slug, role, label, pages: pagesSpan, text });
  });

  if (!openers.length) skipped.push("no opening sentence naming an author");
  return { sections, skipped };
}
