// Phase 4 end to end, from the command line (spec.md §8.4): briefs in, a full forecast out.
//   npx tsx --env-file=.env.local scripts/try/forecast.ts --title "FCC v. Consumers' Research" \
//     --petitioner a.pdf --respondent b.pdf [--argument transcript.pdf] [--recused kagan] [--out result.json]
//     [--docket 24-354] [--as-of 2025-03-26]   (leakage guards: drop the case's own documents and anything dated on/after as-of)
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { prepareBrief } from "../../lib/briefs";
import { summarizeBriefing } from "../../lib/agents/summarizer";
import { retrieveForJustice } from "../../lib/retrieval";
import { embedQueries } from "../../lib/embedding";
import { runBench, sharedPrefix, type JusticeInput } from "../../lib/agents/justice";
import { runClerk } from "../../lib/agents/clerk";
import { justiceTurns } from "../ingest/transcripts-split";
import type { JusticeOpinion } from "../../lib/schemas";

const readOptional = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : null);

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

type Roster = { slug: string; name: string; seniority_rank: number; active: boolean };
const roster: Roster[] = readdirSync("data/justices")
  .map((d) => JSON.parse(readFileSync(join("data/justices", d, "roster.json"), "utf8")))
  .filter((j: Roster) => j.active)
  .sort((a: Roster, b: Roster) => a.seniority_rank - b.seniority_rank);

async function main() {
  const title = arg("title")!;
  const recused = new Set((arg("recused") ?? "").split(",").filter(Boolean));
  const started = Date.now();
  let cost = 0;

  const briefs = [
    await prepareBrief("Brief for the Petitioners", new Uint8Array(readFileSync(arg("petitioner")!))),
    await prepareBrief("Brief for the Respondents", new Uint8Array(readFileSync(arg("respondent")!))),
  ];
  const summary = await summarizeBriefing({ title, briefs });
  cost += summary.costUsd;
  console.log(`summary: $${summary.costUsd.toFixed(3)} · ${summary.data.issues.length} issues`);

  let turns: ReturnType<typeof justiceTurns> = {};
  if (arg("argument")) {
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(readFileSync(arg("argument")!))), { mergePages: false });
    turns = justiceTurns(text as string[]);
  }

  const queries = [summary.data.question_presented, ...summary.data.issues];
  const queryEmbeddings = await embedQueries(queries); // once, shared by all nine searches
  const sitting = roster.filter((j) => !recused.has(j.slug));
  // One justice at a time (each runs up to three searches at once): the database times out under a wider burst.
  const inputs: JusticeInput[] = [];
  for (const j of sitting) {
    inputs.push({
      slug: j.slug,
      name: j.name,
      profile: readOptional(join("data/justices", j.slug, "profile.md")),
      votingRecord: readOptional(join("data/justices", j.slug, "voting.md")),
      passages: await retrieveForJustice(j.slug, queries, { queryEmbeddings, excludeDocket: arg("docket"), before: arg("as-of") ?? new Date().toISOString().slice(0, 10) }),
      argumentQuestions: turns[j.slug]?.text ?? null,
    });
  }

  for (const i of inputs) console.log(`  ${i.slug.padEnd(10)} ${String(i.passages.length).padStart(2)} passages${i.argumentQuestions ? ", argument questions" : ""}`);

  const runs = await runBench(sharedPrefix(title, briefs, summary.data), inputs);
  const opinions = new Map<string, JusticeOpinion>();
  for (const [slug, r] of runs) {
    if (r instanceof Error) { console.log(`  ${slug}: FAILED ${r.message}`); continue; }
    opinions.set(slug, r.opinion);
    cost += r.costUsd;
    const cached = r.calls.reduce((s, c) => s + (c.usage.cache_read_input_tokens ?? 0), 0);
    console.log(`  ${slug.padEnd(10)} ${r.opinion.vote.padEnd(13)} ${r.opinion.role.padEnd(15)} ${Math.round(r.opinion.confidence * 100)}%  ${r.opinion.citations.length} citations${r.flagged ? " FLAGGED" : ""}  $${r.costUsd.toFixed(3)}  cache-read ${cached.toLocaleString()}`);
  }

  const names = Object.fromEntries(roster.map((j) => [j.slug, j.name]));
  const seniority = Object.fromEntries(roster.map((j) => [j.slug, j.seniority_rank]));
  const clerk = await runClerk(title, opinions, names, seniority, null);
  cost += clerk.costUsd;

  console.log(`\n${clerk.tally.outcome}, ${clerk.tally.tally.join("–")} · assigns: ${clerk.tally.assigner} · author: ${clerk.result.predicted_author}`);
  console.log(`  ${clerk.result.author_explanation}`);
  if (clerk.adjustments.length) console.log(`  clerk adjustments: ${clerk.adjustments.join("; ")}`);
  console.log(`\ntotal $${cost.toFixed(2)} · ${((Date.now() - started) / 1000).toFixed(0)}s`);

  if (arg("out")) {
    writeFileSync(arg("out")!, JSON.stringify({ title, summary: summary.data, justices: Object.fromEntries([...runs].map(([k, v]) => [k, v instanceof Error ? { error: v.message } : v])), clerk, costUsd: cost }, null, 2));
    console.log(`wrote ${arg("out")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
