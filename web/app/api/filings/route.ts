// Step 2 of filing: checks the filing, creates the case, claims a run against the invite code and the day's budget, and starts the Inngest job.
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { inngest } from "@/inngest/client";
import { justices } from "@/lib/court";
import { CURRENT_TERM, MIN_DESCRIPTION, normalizeCode, reasonMessage } from "@/lib/filing";
import { claimFiling, refundFiling } from "@/lib/gate";
import { setStage } from "@/lib/pipeline";

const slugs = justices.map((j) => j.slug) as [string, ...string[]];
const Body = z.object({
  caseId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  docket: z.string().trim().max(20),
  mode: z.enum(["briefs", "description"]),
  briefPaths: z.array(z.string().max(200)).max(30),
  transcriptPath: z.string().max(200).nullable(),
  description: z.string().trim().max(8000),
  recused: z.array(z.enum(slugs)).max(7),
  code: z.string().max(40),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Some of the filing is missing or malformed." }, { status: 400 });
  const f = parsed.data;

  // Only paths this filing was given may be attached, and the briefs must actually be in Storage.
  const own = (p: string) => p.startsWith(`${f.caseId}/`);
  const paths = [...f.briefPaths, ...(f.transcriptPath ? [f.transcriptPath] : [])];
  if (!paths.every(own)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (f.mode === "briefs" && f.briefPaths.length < 2) return NextResponse.json({ error: "Both merits briefs are required." }, { status: 400 });
  if (f.mode === "description" && f.description.length < MIN_DESCRIPTION) return NextResponse.json({ error: `Describe the case in at least ${MIN_DESCRIPTION} characters.` }, { status: 400 });

  const db = serviceClient();
  if (f.mode === "briefs") {
    const { data: listed } = await db.storage.from("briefs").list(f.caseId, { limit: 100 });
    const present = new Set((listed ?? []).map((o) => `${f.caseId}/${o.name}`));
    const missing = paths.filter((p) => !present.has(p));
    if (missing.length) return NextResponse.json({ error: "A brief didn't finish uploading. Attach it again." }, { status: 400 });
  }

  const { error: caseError } = await db.from("cases").insert({
    id: f.caseId, title: f.title, docket: f.docket || null, term: CURRENT_TERM, input_mode: f.mode,
    brief_paths: f.mode === "briefs" ? f.briefPaths : [], oa_transcript_path: f.mode === "briefs" ? f.transcriptPath : null,
    description: f.mode === "description" ? f.description : null, recused: f.recused,
  });
  if (caseError) return NextResponse.json({ error: "Could not file the case. Try again." }, { status: 500 });

  // The claim checks the code and the budget and creates the prediction in one transaction (migration 8).
  const phase = f.mode === "briefs" && f.transcriptPath ? "after_argument" : "before_argument";
  const claim = await claimFiling(db, normalizeCode(f.code), f.caseId, phase).catch(() => null);
  if (!claim || claim.reason !== "ok" || !claim.predictionId) {
    // Nothing is left behind for a refused filing: not the case, not its uploaded briefs.
    await db.from("cases").delete().eq("id", f.caseId);
    if (paths.length) await db.storage.from("briefs").remove(paths);
    if (!claim || claim.reason === "ok") return NextResponse.json({ error: "Could not file the case. Try again." }, { status: 500 });
    return NextResponse.json({ error: reasonMessage(claim.reason, claim.maxRuns), reason: claim.reason }, { status: 403 });
  }

  try {
    await inngest.send({ name: "case/predict.requested", data: { predictionId: claim.predictionId } });
  } catch {
    await setStage(claim.predictionId, "failed", { error: "The forecast couldn't be started." });
    await refundFiling(db, claim.predictionId);
    return NextResponse.json({ error: "The forecast couldn't be started, and your invite code wasn't charged. Try again." }, { status: 502 });
  }
  return NextResponse.json({ predictionId: claim.predictionId });
}
