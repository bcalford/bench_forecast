// Ingests opinions four justices wrote before joining the Court, from CourtListener.
// CourtListener rarely tags lower-court authors, so cases are found by the author line printed
// in the opinion ("GORSUCH, Circuit Judge.") and only that justice's own writing is kept.
//   npx tsx --env-file=.env.local scripts/ingest/lower-courts.ts [--only gorsuch] [--dry-run]
import { getText } from "./http";
import { chunk } from "./chunk";

const API = "https://www.courtlistener.com/api/rest/v4";

type Target = { justice: string; court: string; courtName: string; phrase: string; surname: string };
const TARGETS: Target[] = [
  { justice: "gorsuch", court: "ca10", courtName: "Tenth Circuit", phrase: "GORSUCH, Circuit Judge", surname: "GORSUCH" },
  { justice: "kavanaugh", court: "cadc", courtName: "D.C. Circuit", phrase: "filed by Circuit Judge KAVANAUGH", surname: "KAVANAUGH" },
  { justice: "barrett", court: "ca7", courtName: "Seventh Circuit", phrase: "BARRETT, Circuit Judge", surname: "BARRETT" },
  { justice: "jackson", court: "dcd", courtName: "District of D.C.", phrase: "KETANJI BROWN JACKSON, United States District Judge", surname: "JACKSON" },
  { justice: "jackson", court: "cadc", courtName: "D.C. Circuit", phrase: "filed by Circuit Judge JACKSON", surname: "JACKSON" },
];

type Hit = { id: number; caseName: string; dateFiled: string; docketNumber: string };

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const headers = () => {
  const token = process.env.COURTLISTENER_TOKEN;
  if (!token) throw new Error("COURTLISTENER_TOKEN is missing from .env.local");
  return { Authorization: `Token ${token}` };
};

async function findOpinions(t: Target): Promise<Hit[]> {
  const hits: Hit[] = [];
  let url: string | null = `${API}/search/?${new URLSearchParams({ type: "o", court: t.court, q: `"${t.phrase}"`, order_by: "dateFiled asc" })}`;
  for (let page = 1; url; page++) {
    const body = JSON.parse(await getText(url, `courtlistener/lower/${t.justice}-${t.court}-p${page}.json`, headers()));
    for (const r of body.results ?? [])
      for (const o of r.opinions ?? []) hits.push({ id: o.id, caseName: r.caseName, dateFiled: r.dateFiled, docketNumber: r.docketNumber });
    url = body.next;
  }
  return [...new Map(hits.map((h) => [h.id, h])).values()];
}

// One request per opinion: CourtListener's opinions endpoint rejects id__in batches. Each response is cached.
async function fetchTexts(ids: number[]): Promise<Map<number, string>> {
  const texts = new Map<number, string>();
  for (const id of ids) {
    const body = JSON.parse(await getText(`${API}/opinions/${id}/?fields=id,plain_text,html_with_citations,html`, `courtlistener/lower/opinion-${id}.json`, headers()));
    const raw: string = body.plain_text || (body.html_with_citations || body.html || "").replace(/<[^>]+>/g, " ");
    const clean = raw.replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    // OCR spaces out capitals in names ("G O R SU CH", "M cCONNELL"); close those gaps before any matching.
    texts.set(id, clean.replace(/\b[A-Z]{1,2}(?: [A-Z]{1,2}\b)+/g, (m: string) => m.replace(/ /g, "")).replace(/\bM c(?=[A-Z])/g, "Mc"));
  }
  return texts;
}

// OCR'd opinions sometimes space out capitals ("G O R SU CH"); match a surname with optional spaces between letters.
const spaced = (name: string) => name.split("").join("\\s?");

// The justice's own author line, never a panel list ("…and GORSUCH, Circuit Judges.") or a joinder
// ("EBEL, Circuit Judge, joined by …GORSUCH, Circuit Judge, except…").
function authorLine(text: string, t: Target): { index: number; length: number; role: "majority" | "separate" } | null {
  const name = spaced(t.surname);
  const pattern =
    t.court === "cadc"
      ? new RegExp(`(Opinion for the Court|Concurring opinion|Dissenting opinion|Opinion concurring[^.]{0,60}|Opinion dissenting[^.]{0,60}) filed by Circuit Judge ${name}\\.`, "g")
      : new RegExp(`\\b${name},? Circuit Judge(?!s)(,? (?:concurring|dissenting)[^.]{0,200})?[.:]`, "g");
  for (const m of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, m.index! - 250), m.index!);
    if (/joined by[^.]*$|join(?:s|ed)? in[^.]*$/i.test(before)) continue; // inside someone else's joinder list
    const separate = t.court === "cadc" ? !/^Opinion for the Court/.test(m[1]) : Boolean(m[1]);
    return { index: m.index!, length: m[0].length, role: separate ? "separate" : "majority" };
  }
  return null;
}

// Keep the justice's own opinion: from their author line to where another judge's opinion begins.
// A district court opinion is the judge's alone; their name is the signature at the end.
export function ownPortion(text: string, t: Target): { text: string; role: "majority" | "separate" } | null {
  const tidy = (s: string) => s.replace(/^[.:,\s]+/, "").replace(/([a-z])- ([a-z])/g, "$1$2").trim();
  if (t.court === "dcd") {
    const own = tidy(text.replace(/^[\s\S]{0,4000}?MEMORANDUM OPINION( AND ORDER)?/i, ""));
    return own.split(" ").length >= 300 ? { text: own, role: "majority" } : null;
  }
  const line = authorLine(text, t);
  if (!line) return null;
  const after = text.slice(line.index + line.length);
  const other = after.search(
    new RegExp(
      `\\b(?!${t.surname}\\b)[A-Z][A-Z'’-]{2,},? (?:Circuit Judge|C\\.J\\.|J\\.|Chief Judge),? (?:concurring|dissenting)` +
        `|(?:Concurring|Dissenting) opinion filed by (?:Circuit |Chief |Senior Circuit )?Judge (?!${t.surname}\\b)`,
    ),
  );
  const own = tidy(other > 0 ? after.slice(0, other) : after);
  return own.split(" ").length >= 300 ? { text: own, role: line.role } : null;
}

async function main() {
  const load = dry ? null : (await import("./load")).loadDocument;
  for (const t of TARGETS.filter((x) => !only || x.justice === only)) {
    const hits = (await findOpinions(t)).slice(0, limit);
    const texts = await fetchTexts(hits.map((h) => h.id));
    let kept = 0, passages = 0, words = 0;
    const seen = new Set<string>();
    for (const h of hits) {
      const own = ownPortion(texts.get(h.id) ?? "", t);
      if (!own) continue;
      const key = `${h.caseName}|${own.role}`; // CourtListener sometimes holds two copies of one opinion
      if (seen.has(key)) continue;
      seen.add(key);
      if (dry && args.includes("--show")) console.log(`  ${h.caseName.slice(0, 40).padEnd(40)} ${own.role.padEnd(8)} ${String(own.text.split(" ").length).padStart(5)}w | ${own.text.slice(0, 90)} … ${own.text.slice(-70)}`);
      const parts = chunk(own.text);
      kept++; passages += parts.length; words += own.text.split(" ").length;
      await load?.(
        {
          justice: t.justice, kind: "lower_court", role: "lower_court",
          label: `${t.courtName}, ${own.role === "majority" ? "opinion of the court" : "separate opinion"}`,
          caseName: h.caseName, date: h.dateFiled, url: `https://www.courtlistener.com/opinion/${h.id}/`,
          docket: h.docketNumber, source: "courtlistener",
        },
        parts
      );
    }
    console.log(`${t.justice.padEnd(10)} ${t.courtName.padEnd(16)} ${String(hits.length).padStart(4)} found ${String(kept).padStart(4)} kept ${String(passages).padStart(6)} passages ${String(words).padStart(8)} words`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
