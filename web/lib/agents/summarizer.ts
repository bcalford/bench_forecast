// Briefing summary (spec.md §3.2): reads the merits briefs (native PDF input) or a plain-English
// description and returns the structured summary every justice agent receives.
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall, type StructuredResult } from "../claude";
import { MODELS } from "../models";
import { BriefingSummarySchema, type BriefingSummary } from "../schemas";

import type { PreparedBrief } from "../briefs";

const SYSTEM = `You summarize Supreme Court merits briefings for an audience of informed non-lawyers.
Be neutral: give each side's strongest argument in its own terms, and never signal which should win.
Work only from the documents provided. Do not state, hint at or guess how the Court decided or will decide
the case, even if you believe you know; this summary feeds a forecast that is scored against the real outcome.`;

export async function summarizeBriefing(
  input: { title: string; briefs: PreparedBrief[] } | { title: string; description: string },
): Promise<StructuredResult<BriefingSummary>> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if ("briefs" in input) {
    for (const b of input.briefs) {
      content.push(
        b.kind === "text"
          ? { type: "text", text: `<brief title="${b.label}">\n${b.text}\n</brief>` }
          : { type: "document", title: b.label, source: { type: "base64", media_type: "application/pdf", data: b.pdfBase64 } },
      );
    }
    content.push({ type: "text", text: `Summarize the briefing in ${input.title}.` });
  } else {
    content.push({
      type: "text",
      text: `Summarize this case, ${input.title}, from the description below. It is a plain-English description, not the briefs, so keep to what it supports.\n\n${input.description}`,
    });
  }
  return structuredCall({ model: MODELS.extract, schema: BriefingSummarySchema, system: SYSTEM, content, effort: "medium", maxTokens: 16_000 });
}
