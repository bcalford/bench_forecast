// Step 1 of filing: checks the invite code and the day's budget, then hands the browser signed upload URLs
// so briefs go straight to Storage (Vercel caps request bodies at 4.5 MB; merits briefs are often larger).
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { normalizeCode, reasonMessage, storedName } from "@/lib/filing";
import { filingStatus } from "@/lib/gate";

const Body = z.object({
  code: z.string().max(40),
  files: z.array(z.object({ slot: z.enum(["pet", "resp", "amicus", "transcript"]), name: z.string().max(300) })).min(1).max(30),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const db = serviceClient();
  // Checked before any upload so a bad code or a spent budget fails fast; the run is claimed in step 2.
  const status = await filingStatus(db, normalizeCode(parsed.data.code)).catch(() => null);
  if (!status) return NextResponse.json({ error: "Could not prepare the upload. Try again." }, { status: 502 });
  if (status.reason !== "ok") {
    return NextResponse.json({ error: reasonMessage(status.reason, status.maxRuns), reason: status.reason }, { status: 403 });
  }

  const caseId = randomUUID();
  let amicus = 0;
  const uploads = [];
  for (const f of parsed.data.files) {
    const path = `${caseId}/${storedName(f.slot, f.slot === "amicus" ? amicus++ : 0, f.name)}`;
    const { data, error } = await db.storage.from("briefs").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: "Could not prepare the upload. Try again." }, { status: 502 });
    uploads.push({ slot: f.slot, path, token: data.token });
  }
  return NextResponse.json({ caseId, uploads });
}
