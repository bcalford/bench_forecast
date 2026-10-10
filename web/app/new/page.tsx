import type { Metadata } from "next";
import NewCaseForm from "@/components/NewCaseForm";
import { filingOpen } from "@/lib/filing";

export const metadata: Metadata = { title: "Forecast a case · Bench Forecast" };
export const dynamic = "force-dynamic";

export default function NewCasePage() {
  return <NewCaseForm open={filingOpen()} />;
}
