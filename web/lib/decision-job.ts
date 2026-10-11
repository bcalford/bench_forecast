// One decision through the daily job (spec §2): read it, then save and score it for every case row filed
// under its docket. Dependencies are passed in so the job's logic is testable without the network or database.
import type { ListedOpinion } from "./court-site";
import { readDecision, type Reading } from "./decisions";

export function groupByDocket(waiting: { caseId: string; docket: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const w of waiting) out.set(w.docket, [...(out.get(w.docket) ?? []), w.caseId]);
  return out;
}

type Deps = {
  text: (url: string) => Promise<string>;
  save: (caseId: string, r: Reading, decidedAt: string, sourceUrl: string) => Promise<void>;
  score: (caseId: string) => Promise<number>;
  dryRun: boolean;
};

// A decision that can't be fetched or read is reported, not thrown, so one bad PDF doesn't stop the others;
// it is tried again the next day because nothing was saved for it.
export async function processDecision(o: ListedOpinion, caseIds: string[], d: Deps) {
  const base = { docket: o.docket, decided: o.date };
  let reading: Reading;
  try {
    reading = readDecision(await d.text(o.url));
  } catch (e) {
    return { ...base, error: (e as Error).message };
  }
  if (d.dryRun) return { ...base, reading };
  let scored = 0;
  for (const id of caseIds) {
    await d.save(id, reading, o.date, o.url);
    if (reading.clean) scored += await d.score(id);
  }
  return { ...base, clean: reading.clean, reasons: reading.reasons, cases: caseIds.length, scored };
}
