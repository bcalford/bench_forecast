// Models and prices (decisions.md Q16; prices as of 2026-10). Every call's usage is converted to dollars
// and written to spend_ledger, which the daily cap reads before a new run is queued.
import type Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  agent: "claude-opus-5-5", // nine justice agents and the clerk step
  extract: "claude-sonnet-5-5", // PDF extraction and the briefing summary
} as const;

type Rates = { input: number; output: number; cacheWrite: number; cacheRead: number }; // USD per million tokens
const RATES: Record<string, Rates> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
};

export function costUsd(model: string, usage: Anthropic.Usage): number {
  const r = RATES[model];
  if (!r) throw new Error(`No prices recorded for ${model}; add it to lib/models.ts`);
  const perToken = (rate: number) => rate / 1_000_000;
  return (
    usage.input_tokens * perToken(r.input) +
    usage.output_tokens * perToken(r.output) +
    (usage.cache_creation_input_tokens ?? 0) * perToken(r.cacheWrite) +
    (usage.cache_read_input_tokens ?? 0) * perToken(r.cacheRead)
  );
}
