// Voting record for each current justice from the Supreme Court Database (justice-centered file),
// written to data/justices/<slug>/voting.md (read by the profile generator and the justice agents) and
// voting.json (for the app). Argued cases only. Cite: Harold J. Spaeth, Lee Epstein, et al.,
// 2026 Supreme Court Database, Version 2026 Release 01, http://supremecourtdatabase.org.
//   npx tsx scripts/profiles/voting.ts .cache/scdb/SCDB_2026_01_justiceCentered_Citation.csv
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RELEASE = "2026 Release 01";
const RECENT_TERMS = 3;
const ARGUED = new Set(["1", "6", "7"]); // opinion of the Court, argued per curiam, judgment of the Court
const ISSUE_AREAS: Record<string, string> = {
  "1": "Criminal procedure", "2": "Civil rights", "3": "First Amendment", "4": "Due process", "5": "Privacy",
  "6": "Attorneys", "7": "Unions", "8": "Economic activity", "9": "Judicial power", "10": "Federalism",
  "11": "Interstate relations", "12": "Federal taxation", "13": "Miscellaneous", "14": "Private action",
};
const SCDB_ID: Record<string, string> = {
  "108": "thomas", "111": "roberts", "112": "alito", "113": "sotomayor", "114": "kagan",
  "115": "gorsuch", "116": "kavanaugh", "117": "barrett", "118": "jackson",
};

// Minimal RFC 4180 parser: quoted fields may contain commas and doubled quotes.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, k) => [h, r[k]])));
}

type Vote = { docket: string; term: number; justice: string; inMajority: boolean; forPetitioner: boolean | null; liberal: boolean | null; separate: boolean; authoredMajority: boolean; issue: string; divided: boolean; joined: string[] };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

function main() {
  const file = process.argv[2];
  const raw = parseCsv(readFileSync(file, "latin1"));
  const votes: Vote[] = raw
    .filter((r) => ARGUED.has(r.decisionType) && r.majority)
    .map((r) => {
      const inMajority = r.majority === "2";
      const won = r.partyWinning === "1" ? true : r.partyWinning === "0" ? false : null;
      return {
        docket: r.docketId,
        term: Number(r.term),
        justice: r.justice,
        inMajority,
        forPetitioner: won === null ? null : inMajority === won,
        liberal: r.direction === "2" ? true : r.direction === "1" ? false : null,
        separate: ["3", "4"].includes(r.vote) || (r.opinion === "2" && r.majOpinWriter !== r.justice),
        authoredMajority: r.majOpinWriter === r.justice,
        issue: r.issueArea,
        divided: Number(r.minVotes) > 0,
        joined: [r.firstAgreement, r.secondAgreement].filter((x) => x && x !== "0"), // "0" means joined no one
      };
    });
  const lastTerm = Math.max(...votes.map((v) => v.term));
  const recentFrom = lastTerm - RECENT_TERMS + 1;
  const byDocket = new Map<string, Map<string, Vote>>();
  for (const v of votes) (byDocket.get(v.docket) ?? byDocket.set(v.docket, new Map()).get(v.docket)!).set(v.justice, v);

  const roster = readdirSync("data/justices").map((slug) => JSON.parse(readFileSync(join("data/justices", slug, "roster.json"), "utf8")));
  const idOf = Object.fromEntries(Object.entries(SCDB_ID).map(([id, slug]) => [slug, id]));
  // Former justices appear only by SCDB code and short name ("SGBreyer"); show the surname.
  const scdbNames = new Map(raw.map((r) => [r.justice, r.justiceName]));
  const nameOf = (id: string) =>
    roster.find((j) => j.slug === SCDB_ID[id])?.name ??
    `Justice ${scdbNames.get(id) === "SDOConnor" ? "O'Connor" : (scdbNames.get(id) ?? id).replace(/^([A-Z]+?)([A-Z][a-z].*)$/, "$2")} (former)`;

  for (const j of roster) {
    const id = idOf[j.slug];
    const mine = votes.filter((v) => v.justice === id);
    const recent = mine.filter((v) => v.term >= recentFrom);
    const first = Math.min(...mine.map((v) => v.term));
    const summary = (vs: Vote[]) => ({
      cases: vs.length,
      inMajority: pct(vs.filter((v) => v.inMajority).length, vs.length),
      forPetitioner: pct(vs.filter((v) => v.forPetitioner).length, vs.filter((v) => v.forPetitioner !== null).length),
      writesSeparately: pct(vs.filter((v) => v.separate).length, vs.length),
      majorityOpinions: vs.filter((v) => v.authoredMajority).length,
      liberalInDivided: pct(vs.filter((v) => v.divided && v.liberal).length, vs.filter((v) => v.divided && v.liberal !== null).length),
    });

    const issues = Object.entries(ISSUE_AREAS)
      .map(([code, area]) => {
        const vs = mine.filter((v) => v.issue === code);
        return { area, ...summary(vs), liberal: pct(vs.filter((v) => v.liberal).length, vs.filter((v) => v.liberal !== null).length) };
      })
      .filter((x) => x.cases >= 10)
      .sort((a, b) => b.cases - a.cases);

    const agreement = Object.keys(SCDB_ID)
      .filter((other) => other !== id)
      .map((other) => {
        const shared = (from: number, dividedOnly: boolean) => {
          let n = 0, same = 0;
          for (const v of mine) {
            if (v.term < from || (dividedOnly && !v.divided)) continue;
            const o = byDocket.get(v.docket)?.get(other);
            if (!o) continue;
            n++;
            if (o.inMajority === v.inMajority) same++;
          }
          return { n, rate: pct(same, n) };
        };
        return { justice: SCDB_ID[other], name: nameOf(other), all: shared(0, false), divided: shared(0, true), recentDivided: shared(recentFrom, true) };
      })
      .filter((a) => a.all.n > 0)
      .sort((a, b) => parseInt(b.divided.rate) - parseInt(a.divided.rate));

    const joins = new Map<string, number>();
    for (const v of mine) for (const k of v.joined) joins.set(k, (joins.get(k) ?? 0) + 1);
    const topJoins = [...joins].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => ({ justice: SCDB_ID[k] ?? k, name: nameOf(k), opinionsJoined: n }));

    const all = summary(mine), rec = summary(recent);
    const json = { source: `Supreme Court Database, ${RELEASE}`, argued_cases_only: true, terms: [first, lastTerm], recent_terms: [recentFrom, lastTerm], overall: all, recent: rec, by_issue_area: issues, agreement, separate_opinions_joined: topJoins };
    writeFileSync(join("data/justices", j.slug, "voting.json"), JSON.stringify(json, null, 2) + "\n");

    const md = [
      `# ${j.name}: voting record`,
      ``,
      `Source: Supreme Court Database, ${RELEASE} (Spaeth, Epstein, et al.). Argued cases, OT${first}–OT${lastTerm}; "recent" is OT${recentFrom}–OT${lastTerm}.`,
      `"For petitioner" means voting for the side asking the Court to reverse. "Liberal direction" is the database's own coding of each vote, reported as a statistic.`,
      ``,
      `## Overall`,
      `| | Career | Recent |`,
      `|---|---|---|`,
      `| Cases | ${all.cases} | ${rec.cases} |`,
      `| In the majority | ${all.inMajority} | ${rec.inMajority} |`,
      `| Votes for petitioner | ${all.forPetitioner} | ${rec.forPetitioner} |`,
      `| Writes separately | ${all.writesSeparately} | ${rec.writesSeparately} |`,
      `| Majority opinions written | ${all.majorityOpinions} | ${rec.majorityOpinions} |`,
      `| Liberal direction, divided cases | ${all.liberalInDivided} | ${rec.liberalInDivided} |`,
      ``,
      `## By issue area (career, areas with 10+ cases)`,
      `| Area | Cases | In majority | For petitioner | Liberal direction |`,
      `|---|---|---|---|---|`,
      ...issues.map((x) => `| ${x.area} | ${x.cases} | ${x.inMajority} | ${x.forPetitioner} | ${x.liberal} |`),
      ``,
      `## Agreement with the other current justices (same side of the judgment)`,
      `Divided cases are the informative measure; unanimous decisions put everyone together.`,
      `| Justice | All shared cases | Divided cases | Divided, recent |`,
      `|---|---|---|---|`,
      ...agreement.map((a) => `| ${a.name} | ${a.all.rate} (${a.all.n}) | ${a.divided.rate} (${a.divided.n}) | ${a.recentDivided.rate} (${a.recentDivided.n}) |`),
      ``,
      `## Separate opinions this justice joined most`,
      ...(topJoins.length ? topJoins.map((t) => `- ${t.name}: ${t.opinionsJoined}`) : ["- none recorded"]),
      ``,
    ].join("\n");
    writeFileSync(join("data/justices", j.slug, "voting.md"), md);
    console.log(`${j.slug.padEnd(10)} OT${first}–OT${lastTerm}  ${String(all.cases).padStart(4)} cases  majority ${all.inMajority}  top divided-case ally: ${agreement[0]?.name} ${agreement[0]?.divided.rate}`);
  }
}

main();
