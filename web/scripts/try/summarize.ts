// Runs the briefing summarizer once on a real case's merits briefs and prints the summary and its cost.
//   npx tsx --env-file=.env.local scripts/try/summarize.ts <petitioner.pdf> <respondent.pdf> "<case title>" [--count-only]
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { prepareBrief } from "../../lib/briefs";
import { summarizeBriefing } from "../../lib/agents/summarizer";
import { MODELS } from "../../lib/models";

async function main() {
  const [pet, resp, title] = process.argv.slice(2);
  const briefs = [
    await prepareBrief("Brief for the Petitioners", new Uint8Array(readFileSync(pet))),
    await prepareBrief("Brief for the Respondents", new Uint8Array(readFileSync(resp))),
  ];
  for (const b of briefs) console.log(`${b.label}: ${b.pages} pages, read as ${b.kind}${b.kind === "text" ? ` (${b.text.length.toLocaleString()} chars)` : ""}`);

  const count = await new Anthropic().messages.countTokens({
    model: MODELS.extract,
    messages: [{ role: "user", content: briefs.map((b) => (b.kind === "text" ? { type: "text" as const, text: b.text } : { type: "text" as const, text: "(pdf)" })) }],
  });
  console.log(`input ≈ ${count.input_tokens.toLocaleString()} tokens ≈ $${((count.input_tokens * 2) / 1e6).toFixed(2)}`);
  if (process.argv.includes("--count-only")) return;

  const started = Date.now();
  const r = await summarizeBriefing({ title, briefs });
  console.log(`\nmodel ${r.model} · ${((Date.now() - started) / 1000).toFixed(0)}s · in ${r.usage.input_tokens.toLocaleString()} / out ${r.usage.output_tokens.toLocaleString()} tokens · $${r.costUsd.toFixed(3)}\n`);
  console.log(JSON.stringify(r.data, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
