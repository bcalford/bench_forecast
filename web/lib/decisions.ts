// Reading the Court's decision from a slip opinion's syllabus (spec §2): the judgment, each justice's vote,
// the author and recusals. Anything it can't read with confidence comes back unclean, with reasons, for the
// owner's review queue. Pure; lib/fetch-court.ts supplies the text.
import { justices } from "./court";

export type Judgment = "affirm" | "reverse" | "vacate_remand" | "other";
type CastVote = "affirm" | "reverse" | "vacate_remand";
export type Reading = {
  judgment: Judgment | null; outcome: string; votes: Record<string, CastVote>; author: string | null;
  recused: string[]; clean: boolean; reasons: string[];
};

const SLUGS = justices.map((j) => j.slug);
const NAME = new RegExp(`\\b(${SLUGS.join("|")})\\b`, "gi");
const names = (s: string) => [...new Set([...s.matchAll(NAME)].map((m) => m[1].toLowerCase()))];
const STARTS_LINEUP = /\b(?:[A-Z]{3,}|[A-Z][a-z]{2,}), (?:C\. ?J\.|J\.), (?:delivered|announced)\b/;
const NEXT_SENTENCE = /\.\s+(?=(?:[A-Z]{3,}|[A-Z][a-z]{2,}), (?:C\. ?J\.|J\.),)/;

// PDF text splits words across lines ("KA - VANAUGH", "considera- tion"), and preliminary prints lose the
// "fi" ligature ("fled" for "filed", "Affrmed" for "Affirmed").
const tidy = (t: string) => t.replace(/\s+/g, " ").replace(/\b([A-Z]{2,}) ?- ([A-Z]{2,})\b/g, "$1$2").replace(/([a-z])- ([a-z])/g, "$1$2")
  .replace(/\bfled\b/g, "filed").replace(/\b([Aa])ffrmed\b/g, "$1ffirmed")
  // Page headers that can fall inside the syllabus: "7 Cite as: 606 U. S. ____ (2025) Syllabus", "6 FCC v. CONSUMERS’ RESEARCH Syllabus".
  .replace(/\b(?:\d+ )?Cite as: \d+ U\. ?S\. \S+ \(\d{4}\)(?: \d+)?(?: Syllabus)?/g, " ")
  .replace(/\b\d+ [A-Z0-9][A-Z0-9’'.&,\- ]*? v\. [A-Z0-9][A-Z0-9’'.&,\- ]*? Syllabus\b/g, " ")
  .replace(/\s+/g, " ");

// Where the line-up stops: the rule under the syllabus, the opinion's first page, or (in preliminary prints)
// the list of counsel, cut back to the end of the last opinion sentence so a lawyer's name can't be read
// as a Justice's. Page headers ("7 Cite as: … Syllabus") can fall inside a line-up, so they don't end it.
function lineupEnd(rest: string): number {
  const hard = rest.search(/_{5,}|NOTICE: This opinion|\* Justice |JUSTICE [A-Z]+ delivered/);
  let end = hard > 0 ? hard : Math.min(rest.length, 2000);
  const argued = rest.slice(0, end).search(/\bargued the cause\b/);
  if (argued > 0) {
    const ends = [...rest.slice(0, argued).matchAll(/(?:joined|opinions?|case|Court)\b[^.]{0,80}?\./g)];
    const last = ends[ends.length - 1];
    if (last) end = last.index! + last[0].length;
  }
  return end;
}

// The judgment line follows the syllabus's last page cite ("Pp. 34–37." or "P. 26."), so only the text after
// it is searched: a lower court's "affirmed" earlier in the syllabus is not the Court's judgment.
function judgmentOf(before: string): { judgment: Judgment | null; outcome: string; mixed: boolean; several: boolean } {
  const cites = [...before.matchAll(/\bPp?\. ?\d+(?:[–-] ?\d+)?\./g)];
  const lastCite = cites[cites.length - 1];
  const tail = lastCite ? before.slice(lastCite.index! + lastCite[0].length) : before.slice(-300);
  const all = [...tail.matchAll(/\b(affirmed|reversed|vacated|dismissed)\b[^.;]*[.;]/gi)];
  const m = all.pop();
  if (!m) return { judgment: null, outcome: "Undetermined", mixed: false, several: false };
  const several = new Set([...all, m].map((x) => x[1].toLowerCase())).size > 1;
  const phrase = m[0].replace(/[.;]$/, "").trim();
  const word = m[1].toLowerCase();
  const judgment: Judgment = word === "affirmed" ? "affirm" : word === "reversed" ? "reverse" : word === "vacated" ? "vacate_remand" : "other";
  return { judgment, outcome: phrase.charAt(0).toUpperCase() + phrase.slice(1).toLowerCase(), mixed: /\bin part\b/i.test(phrase), several };
}

export function readDecision(raw: string): Reading {
  const text = tidy(raw);
  const reasons: string[] = [];
  const start = text.search(STARTS_LINEUP);
  if (start < 0) {
    const perCuriam = /PER CURIAM/i.test(text);
    return { judgment: null, outcome: "Undetermined", votes: {}, author: null, recused: [], clean: false, reasons: [perCuriam ? "per curiam: no author line" : "no opinion line found"] };
  }
  const lineup = text.slice(start, start + lineupEnd(text.slice(start)));
  const { judgment, outcome, mixed, several } = judgmentOf(text.slice(Math.max(0, start - 600), start));
  if (!judgment) reasons.push("no judgment line before the opinion line");
  else if (judgment === "other") reasons.push(`judgment is "${outcome}"`);
  if (mixed) reasons.push(`judgment "${outcome}" is in part`);
  if (several) reasons.push("more than one judgment (consolidated cases decided differently?)");

  const withJ = new Set<string>(), against = new Set<string>(), recused = new Set<string>();
  let author: string | null = null;
  for (const sentence of lineup.split(NEXT_SENTENCE)) {
    const verb = sentence.search(/\b(delivered|announced|filed|took no part)\b/);
    if (verb < 0) continue;
    const subjects = names(sentence.slice(0, verb));
    const whichAt = sentence.search(/\b(?:in )?which\b/);
    const joiners = whichAt >= 0 ? names(sentence.slice(whichAt)) : [];
    const body = sentence.slice(verb);
    if (/^took no part/.test(body)) { subjects.forEach((s) => recused.add(s)); continue; }
    if (/^announced the judgment/.test(body)) { reasons.push("plurality: the judgment was announced without a majority opinion"); continue; }
    // Two opinions run together (an unstripped page header hid the sentence break): don't guess who joined what.
    if ((sentence.match(/\b(?:delivered|filed|took no part)\b/g) ?? []).length > 1) {
      reasons.push("two opinions run together in one sentence");
      continue;
    }
    if (/^delivered the opinion for a unanimous Court/.test(body)) {
      author = subjects[0] ?? null;
      SLUGS.forEach((s) => withJ.add(s));
      continue;
    }
    if (/^delivered/.test(body)) {
      author = subjects[0] ?? null;
      [...subjects, ...joiners].forEach((s) => withJ.add(s));
      continue;
    }
    const kind = body.replace(/,? in which.*$/, "");
    const dissent = /dissent/i.test(kind);
    const concur = /concur/i.test(kind);
    if ((dissent && concur) || (dissent && /\bin part\b/i.test(kind))) {
      reasons.push(`${subjects.join(" and ")}: ${kind.replace(/^filed (?:an? )?/, "")} (in part)`);
      continue;
    }
    if (dissent) [...subjects, ...joiners].forEach((s) => against.add(s));
    else if (concur) [...subjects, ...joiners].forEach((s) => withJ.add(s));
  }

  for (const s of recused) { withJ.delete(s); against.delete(s); }
  for (const s of against) if (withJ.has(s)) reasons.push(`${s} appears both with and against the judgment`);
  const unaccounted = SLUGS.filter((s) => !recused.has(s) && !withJ.has(s) && !against.has(s));
  if (unaccounted.length) reasons.push(`${unaccounted.join(", ")} not accounted for`);

  const votes: Record<string, CastVote> = {};
  if (judgment && judgment !== "other") {
    const opposite: CastVote = judgment === "affirm" ? "reverse" : "affirm";
    for (const s of withJ) if (!against.has(s)) votes[s] = judgment;
    for (const s of against) if (!withJ.has(s)) votes[s] = opposite;
  }
  return { judgment, outcome, votes, author, recused: [...recused], clean: reasons.length === 0, reasons };
}
