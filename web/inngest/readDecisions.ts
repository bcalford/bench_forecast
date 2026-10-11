// Reads the Court's new decisions once a day (6 PM Eastern) and scores the matching forecasts (spec §2).
// Also runs on demand: event "decisions/read.requested" { term?, dryRun? }.
import { inngest } from "./client";
import { COURT, currentTerm, normalizeDocket, parseSlipListing } from "@/lib/court-site";
import { groupByDocket, processDecision } from "@/lib/decision-job";
import { courtText, syllabusText } from "@/lib/fetch-court";
import { awaitingOutcome, saveOutcome, scoreCase } from "@/lib/outcomes";
import { serviceClient } from "@/lib/supabase";

export const readDecisions = inngest.createFunction(
  {
    id: "read-decisions",
    triggers: [{ cron: "TZ=America/New_York 0 18 * * *" }, { event: "decisions/read.requested" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as { term?: number; dryRun?: boolean };
    const term = Number(data.term ?? currentTerm());
    const dryRun = !!data.dryRun;
    const yy = String(term % 100).padStart(2, "0");

    const listed = await step.run("list", async () => parseSlipListing(await courtText(`${COURT}/opinions/slipopinion/${yy}`), term));
    const waiting = await step.run("match", () => awaitingOutcome(serviceClient(), term));
    const byDocket = groupByDocket(waiting); // a docket can have several case rows: one per filing
    const matches = listed.filter((o) => byDocket.has(normalizeDocket(o.docket)));

    const results = [];
    for (const o of matches) {
      const docket = normalizeDocket(o.docket);
      results.push(await step.run(`read-${docket}`, () => {
        const db = serviceClient();
        return processDecision(o, byDocket.get(docket)!, {
          text: syllabusText,
          save: (caseId, reading, decidedAt, url) => saveOutcome(db, caseId, reading, decidedAt, url),
          score: (caseId) => scoreCase(db, caseId),
          dryRun,
        });
      }));
    }
    return { term, dryRun, listed: listed.length, waiting: waiting.length, results };
  },
);
