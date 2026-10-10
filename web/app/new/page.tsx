import type { Metadata } from "next";
import NewCaseForm from "@/components/NewCaseForm";
import { filingStatus } from "@/lib/gate";
import { serviceClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Forecast a case · Bench Forecast" };
export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  // If the check itself fails, leave the form open: the routes check again before anything is spent.
  const { reason } = await filingStatus(serviceClient(), null).catch(() => ({ reason: "ok" as const }));
  return <NewCaseForm open={reason === "ok"} />;
}
