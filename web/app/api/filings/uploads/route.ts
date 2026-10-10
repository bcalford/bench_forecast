// Step 1 of filing: hands the browser signed upload URLs so briefs go straight to Storage
// (Vercel caps request bodies at 4.5 MB; merits briefs are often larger).
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { filingOpen, storedName } from "@/lib/filing";

const Body = z.object({
  files: z.array(z.object({ slot: z.enum(["pet", "resp", "amicus", "transcript"]), name: z.string().max(300) })).min(1).max(30),
});

export async function POST(req: Request) {
  if (!filingOpen()) return NextResponse.json({ error: "Filing opens soon." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const db = serviceClient();
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
