import type { Metadata } from "next";
import ScorecardView from "@/components/ScorecardView";
import { loadScorecard } from "@/lib/scorecard-data";

export const metadata: Metadata = { title: "Scorecard · Bench Forecast" };
export const dynamic = "force-dynamic";

export default async function ScorecardPage() {
  const { counted, all, waiting } = await loadScorecard();
  return <ScorecardView counted={counted} all={all} waiting={waiting} />;
}
