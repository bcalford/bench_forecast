// Schemas for every structured model output in the pipeline (spec.md §3.2–3.4).
// Passed to client.messages.parse() via zodOutputFormat, which constrains generation to the schema
// and validates the result; the same schemas type the rows written to Supabase.
import { z } from "zod";

// --- Briefing summary (Sonnet) -------------------------------------------------------------------
export const BriefingSummarySchema = z.object({
  facts: z.string().describe("What happened, in plain English, 3–6 sentences."),
  question_presented: z.string().describe("The question the Court agreed to decide, in one or two sentences."),
  procedural_history: z.string().describe("How the case reached the Court: the rulings below."),
  petitioner_argument: z.string().describe("The petitioner's main argument, 3–5 sentences."),
  respondent_argument: z.string().describe("The respondent's main argument, 3–5 sentences."),
  issues: z
    .array(z.string())
    .describe("3–8 short legal issues the case turns on, phrased as search queries (e.g. 'statutory silence as delegation').")
    .min(1),
});
export type BriefingSummary = z.infer<typeof BriefingSummarySchema>;

// --- One justice's prediction (Opus) ------------------------------------------------------------
export const CitationSchema = z.object({
  passage_id: z.string().describe("The id of one of the passages provided for this justice. Never invent one."),
  quote: z.string().describe("The exact words relied on, copied from that passage."),
  why: z.string().describe("One sentence on why this passage bears on the vote."),
});

export const JusticeOpinionSchema = z.object({
  vote: z.enum(["affirm", "reverse", "vacate_remand", "other"]),
  confidence: z.number().describe("Probability between 0 and 1 that this justice casts this vote."),
  role: z.enum(["majority", "concur", "concur_judgment", "dissent"]),
  brief_reason: z.string().describe("Two or three sentences a non-lawyer can follow."),
  detailed_reason: z
    .string()
    .describe("About 600–1,000 words: interpretive approach applied here, precedents relied on, oral-argument signals, what could change the vote."),
  citations: z.array(CitationSchema),
});
export type JusticeOpinion = z.infer<typeof JusticeOpinionSchema>;

// --- Clerk grouping and author (Opus) -----------------------------------------------------------
export const ClerkResultSchema = z.object({
  joins_majority: z.array(z.string()).describe("Slugs of justices joining the majority opinion in full."),
  concurrences: z.array(z.string()).describe("Slugs of majority justices who join and also write separately."),
  concurrences_in_judgment: z.array(z.string()).describe("Slugs of justices who agree only with the result."),
  predicted_author: z.string().nullable().describe("Slug of the predicted opinion author; null on an equally divided Court."),
  author_explanation: z.string().describe("One sentence: who assigns, workload across the term, expertise in the area."),
});
export type ClerkResult = z.infer<typeof ClerkResultSchema>;

// --- Citation validation (spec.md §3.3) ----------------------------------------------------------
// Every passage_id must be one retrieved for that justice; a quote must actually appear in the passage.
export function checkCitations(
  opinion: JusticeOpinion,
  retrieved: Map<string, string>, // passage_id -> passage text
): { valid: JusticeOpinion["citations"]; invalid: { citation: JusticeOpinion["citations"][number]; reason: string }[] } {
  const normalize = (s: string) => s.toLowerCase().replace(/[“”"’']/g, "'").replace(/\s+/g, " ").trim();
  const valid: JusticeOpinion["citations"] = [];
  const invalid: { citation: JusticeOpinion["citations"][number]; reason: string }[] = [];
  for (const c of opinion.citations) {
    const text = retrieved.get(c.passage_id);
    if (!text) invalid.push({ citation: c, reason: "passage was not among those retrieved for this justice" });
    else if (!normalize(text).includes(normalize(c.quote))) invalid.push({ citation: c, reason: "quote does not appear in the passage" });
    else valid.push(c);
  }
  return { valid, invalid };
}
