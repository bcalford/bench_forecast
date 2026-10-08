import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

// Confirms the app can reach Supabase and that the schema and roster seed are in place.
export async function GET() {
  try {
    const { data, error } = await serviceClient().from("justices").select("slug");
    if (error) {
      const hint = error.code === "PGRST205" ? " Apply supabase/migrations and supabase/seed.sql (see web/README.md)." : "";
      return NextResponse.json({ ok: false, error: error.message + hint }, { status: 500 });
    }
    const justices = data.length;
    return NextResponse.json({ ok: justices === 9, justices, ...(justices !== 9 && { error: "Expected 9 justices; run supabase/seed.sql." }) }, { status: justices === 9 ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
