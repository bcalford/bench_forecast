// Files a case the way the filing form will (phase 5): uploads the briefs, creates the case and prediction,
// and sends the event that starts the Inngest job. Needs `npm run dev` and `npm run inngest:dev` running.
//   npx tsx --env-file=.env.local scripts/try/enqueue.ts --title "…" --term "October Term 2024" \
//     --petitioner a.pdf --respondent b.pdf [--argument t.pdf] [--docket 24-354] [--as-of 2025-03-26] [--recused kagan]
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { serviceClient } from "../../lib/supabase";
import { ok } from "../../lib/retry";
import { inngest } from "../../inngest/client";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const db = serviceClient();
  const caseId = randomUUID();
  const upload = async (file: string, name: string) => {
    const path = `${caseId}/${name}`;
    await ok(db.storage.from("briefs").upload(path, readFileSync(file), { contentType: "application/pdf" }));
    return path;
  };
  const briefPaths = [await upload(arg("petitioner")!, "01-Brief for the Petitioners.pdf"), await upload(arg("respondent")!, "02-Brief for the Respondents.pdf")];
  const transcript = arg("argument") ? await upload(arg("argument")!, "argument-transcript.pdf") : null;

  await ok(db.from("cases").insert({
    id: caseId, title: arg("title"), docket: arg("docket") ?? null, term: arg("term") ?? "October Term 2026",
    input_mode: "briefs", brief_paths: briefPaths, oa_transcript_path: transcript,
    recused: (arg("recused") ?? "").split(",").filter(Boolean),
  }));
  const prediction = (await ok(db.from("predictions").insert({
    case_id: caseId, phase: transcript ? "after_argument" : "before_argument", as_of: arg("as-of") ?? null,
  }).select("id").single())) as { id: string };

  await inngest.send({ name: "case/predict.requested", data: { predictionId: prediction.id } });
  console.log(`case ${caseId}\nprediction ${prediction.id}\nqueued — follow it at http://localhost:8288 (Inngest dev server)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
