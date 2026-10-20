// Assembling an argued case for a docket forecast from the Court's site (spec §1). Pure; the script fetches.
import { justices } from "./court";
import { parseDocketPage, type DocketDoc, type HearingCase } from "./court-site";
import { HOLD_USD } from "./filing";

export type DocketCase = HearingCase & { transcript: string | null; petitioner: DocketDoc | null; respondent: DocketDoc | null; recused: string[] };

const SLUGS = new Set(justices.map((j) => j.slug));

export function assembleCase(h: HearingCase, transcripts: Record<string, string>, docketHtml: string, extraRecusals: string[]): DocketCase {
  for (const s of extraRecusals) if (!SLUGS.has(s)) throw new Error(`Unknown justice "${s}" in --recuse.`);
  const page = parseDocketPage(docketHtml);
  return { ...h, transcript: transcripts[h.docket] ?? null, petitioner: page.petitioner, respondent: page.respondent, recused: [...new Set([...page.recused, ...extraRecusals])] };
}

export function missing(c: DocketCase): string[] {
  const out: string[] = [];
  if (!c.transcript) out.push("no transcript yet");
  if (!c.petitioner) out.push("petitioners' merits brief not found");
  if (!c.respondent) out.push("respondents' merits brief not found");
  return out;
}

// What a docket run is budgeted at: the $2.50 hold, or the costliest past run if one cost more,
// so --max-spend tracks what runs really cost rather than a fixed guess.
export const perCaseEstimate = (pastCosts: number[]) => Math.max(HOLD_USD, Math.ceil(Math.max(0, ...pastCosts) * 100 - 1e-6) / 100);

export const caseLimit = (maxSpend: number, perCase = HOLD_USD) => Math.floor(maxSpend / perCase + 1e-9);
