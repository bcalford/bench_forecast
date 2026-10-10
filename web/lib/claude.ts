// One helper for every structured call in the pipeline: schema-constrained output (validated with zod),
// server-side refusal fallbacks, an explicit refusal check, and the call's cost for the spend ledger.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { costUsd } from "./models";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export type StructuredCall<S extends z.ZodType> = {
  model: string;
  schema: S;
  system: Anthropic.Beta.BetaTextBlockParam[] | string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  // Called once the response starts streaming, which is when its prompt cache becomes readable by other requests.
  onStarted?: () => void;
};

export type StructuredResult<T> = {
  data: T;
  model: string; // the model that actually answered (differs from the request if a fallback ran)
  usage: Anthropic.Beta.BetaUsage;
  costUsd: number;
};

export class RefusalError extends Error {}

// A refusal fallback can answer with a model we have no prices for; never lose a paid call's cost to that.
function priced(served: string, requested: string, usage: Anthropic.Usage): number {
  try {
    return costUsd(served, usage);
  } catch {
    console.warn(`No prices for ${served}; recording cost at ${requested} rates`);
    return costUsd(requested, usage);
  }
}

export async function structuredCall<S extends z.ZodType>(call: StructuredCall<S>): Promise<StructuredResult<z.infer<S>>> {
  // Streaming keeps long briefs and ~1,000-word opinions clear of HTTP timeouts.
  const stream = anthropic().beta.messages.stream({
    model: call.model,
    max_tokens: call.maxTokens ?? 32_000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // on a policy decline, the API re-runs the request on a suitable model
    system: call.system,
    messages: [{ role: "user", content: call.content }],
    output_config: { effort: call.effort, format: betaZodOutputFormat(call.schema) },
  });
  if (call.onStarted) {
    let fired = false;
    stream.on("streamEvent", () => {
      if (!fired) { fired = true; call.onStarted!(); }
    });
  }
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new RefusalError(`Declined (${message.stop_details?.category ?? "no category"}): ${message.stop_details?.explanation ?? ""}`);
  }
  if (message.stop_reason === "max_tokens") throw new Error(`Output hit max_tokens (${call.maxTokens ?? 32_000}) before the schema was complete`);

  const parsed = message.parsed_output;
  if (parsed == null) throw new Error("The response did not match the schema");
  return {
    data: parsed as z.infer<S>,
    model: message.model,
    usage: message.usage,
    costUsd: priced(message.model, call.model, message.usage as unknown as Anthropic.Usage),
  };
}
