// Drafts each justice's profile from their own library (spec.md §3.8, decisions.md Q11), for the owner to review.
// Reads the opening passages of up to 120 of the justice's opinions, spread across terms and weighted toward
// separate writings (which show a justice's own views most clearly), and asks Opus for a grounded profile.
//   npx tsx --env-file=.env.local scripts/profiles/generate.ts [--only kagan] [--dry-run]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { MODELS, costUsd } from "../../lib/models";

const MAX_DOCS = 120;
const PASSAGES_PER_DOC = 2;
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anthropic = new Anthropic();

const SYSTEM = `You write a working profile of one Supreme Court justice for a forecasting system. The profile is read by
an agent that predicts this justice's votes, and it is reviewed by a person before use.

Write in Markdown with exactly these sections:
## Interpretive method
## Positions by area of law
## Weight given to precedent
## Signature doctrines and recurring themes
## Typical voting partners
## How this justice tends to write separately

You get two sources: this justice's voting record from the Supreme Court Database (agreement rates, rates by issue
area, whose separate opinions they join), and excerpts from this justice's own opinions. Ground every statement in
one of them. Cite an excerpt by case and year in parentheses, e.g. "(Loper Bright, 2024, concurring)"; cite a number
from the voting record as "(SCDB)". Build "Typical voting partners" from the divided-case agreement rates and the
joins list, noting any change in recent terms, and use the issue-area table to anchor "Positions by area of law".
Prefer patterns across several opinions to single quotes. Where neither source shows something, say so plainly
instead of filling the gap from general knowledge. Be neutral and descriptive: no praise, no criticism,
no political labels. Aim for about 900–1,300 words.

Excerpts routinely cite other justices' opinions, e.g. "(Barrett, J., dissenting)"; that is normal and not a sign
of misattribution. Only if an excerpt itself reads as written by someone other than this justice, list it after
the profile under a final heading "## Possible source problems" with one line of reasoning per item. Otherwise
omit that heading. Never put such notes inside the profile sections.`;

type Doc = { id: string; case_name: string; date: string | null; role: string | null; label: string | null; term: string | null };

function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

async function excerptsFor(justice: string): Promise<{ text: string; docs: number }> {
  const { data, error } = await db
    .from("documents")
    .select("id, case_name, date, role, label, term")
    .eq("justice", justice)
    .eq("kind", "scotus_opinion")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  const docs = data as Doc[];
  const separate = docs.filter((d) => d.role && d.role !== "majority");
  const majority = docs.filter((d) => d.role === "majority");
  // Roughly two thirds separate writings, the rest majority opinions, each spread across the years.
  const nSep = Math.min(separate.length, Math.round(MAX_DOCS * 0.65));
  const picked = [...spread(separate, nSep), ...spread(majority, MAX_DOCS - nSep)].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const byDoc = new Map<string, string[]>();
  for (let i = 0; i < picked.length; i += 100) {
    const ids = picked.slice(i, i + 100).map((d) => d.id);
    const { data: ps, error: e2 } = await db
      .from("passages")
      .select("document_id, ordinal, text")
      .in("document_id", ids)
      .lt("ordinal", PASSAGES_PER_DOC)
      .order("ordinal");
    if (e2) throw new Error(e2.message);
    for (const p of ps) (byDoc.get(p.document_id) ?? byDoc.set(p.document_id, []).get(p.document_id)!).push(p.text);
  }
  const text = picked
    .filter((d) => byDoc.has(d.id))
    .map((d) => `<excerpt case="${d.case_name}" year="${d.date?.slice(0, 4) ?? ""}" opinion="${d.label ?? d.role}">\n${byDoc.get(d.id)!.join("\n")}\n</excerpt>`)
    .join("\n");
  return { text, docs: byDoc.size };
}

async function main() {
  const dir = "data/justices";
  const roster = readdirSync(dir)
    .map((slug) => JSON.parse(readFileSync(join(dir, slug, "roster.json"), "utf8")))
    .filter((j) => j.active && (!only || j.slug === only));
  let total = 0;

  for (const j of roster) {
    const { text, docs } = await excerptsFor(j.slug);
    const request = {
      model: MODELS.agent,
      system: SYSTEM,
      messages: [{ role: "user" as const, content: `<justice>${j.name}</justice>\n\n<voting_record>\n${readFileSync(join(dir, j.slug, "voting.md"), "utf8")}\n</voting_record>\n\n${text}\n\nWrite the profile of ${j.name}.` }],
    };
    const { input_tokens } = await anthropic.messages.countTokens(request);
    const estimate = (input_tokens * 4 + 2_500 * 20) / 1e6; // input at $4/M plus ~2,500 output tokens at $20/M
    console.log(`${j.slug.padEnd(10)} ${String(docs).padStart(3)} opinions sampled  ${input_tokens.toLocaleString().padStart(8)} input tokens  ≈ $${estimate.toFixed(2)}`);
    if (dry) { total += estimate; continue; }

    const stream = anthropic.messages.stream({ ...request, max_tokens: 16_000, output_config: { effort: "high" } });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error(`${j.slug}: declined`);
    const body = message.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("\n").trim();
    const cost = costUsd(message.model, message.usage);
    total += cost;
    const header = [
      "---",
      `justice: ${j.slug}`,
      `status: draft — needs owner review`,
      `generated: ${new Date().toISOString().slice(0, 10)}`,
      `model: ${message.model}`,
      `sources: ${docs} opinions from this justice's library (opening passages); Supreme Court Database voting record`,
      "---",
      "",
      `# ${j.name}`,
      "",
    ].join("\n");
    writeFileSync(join(dir, j.slug, "profile.md"), header + body + "\n");
    console.log(`  wrote data/justices/${j.slug}/profile.md  $${cost.toFixed(2)}`);
  }
  console.log(`\n${dry ? "estimated" : "spent"} $${total.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
