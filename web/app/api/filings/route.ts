// Step 2 of filing: checks the filing, creates the case and its prediction, and starts the Inngest job.
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { inngest } from "@/inngest/client";
import { justices } from "@/lib/court";
import { CURRENT_TERM, MIN_DESCRIPTION, filingOpen } from "@/lib/filing";

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
});

export async function POST(req: Request) {
  if (!filingOpen()) return NextResponse.json({ error: "Filing opens soon." }, { status: 403 });
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

  const { data: prediction, error } = await db
    .from("predictions")
    .insert({ case_id: f.caseId, phase: f.mode === "briefs" && f.transcriptPath ? "after_argument" : "before_argument" })
    .select("id")
    .single();
  if (error || !prediction) return NextResponse.json({ error: "Could not file the case. Try again." }, { status: 500 });

  await inngest.send({ name: "case/predict.requested", data: { predictionId: prediction.id } });
  return NextResponse.json({ predictionId: prediction.id });
}
