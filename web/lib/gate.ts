// The filing gate: invite codes and the daily budget, enforced in the database (migration 8; decisions.md Q18).
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { HOLD_USD, type GateReason } from "./filing";

type Row = { reason: GateReason; max_runs: number | null; prediction_id?: string | null };

export async function filingStatus(db: SupabaseClient, code: string | null) {
  const { data, error } = await db
    .rpc("filing_status", { p_code: code, p_cap: env.dailySpendCapUsd(), p_hold: HOLD_USD })
    .single<Row>();
  if (error || !data) throw new Error(`filing_status failed: ${error?.message ?? "no row"}`);
  return { reason: data.reason, maxRuns: data.max_runs };
}

export async function claimFiling(db: SupabaseClient, code: string, caseId: string, phase: "before_argument" | "after_argument") {
  const { data, error } = await db
    .rpc("claim_filing", { p_code: code, p_case_id: caseId, p_phase: phase, p_cap: env.dailySpendCapUsd(), p_hold: HOLD_USD })
    .single<Row>();
  if (error || !data) throw new Error(`claim_filing failed: ${error?.message ?? "no row"}`);
  return { reason: data.reason, maxRuns: data.max_runs, predictionId: data.prediction_id ?? null };
}

export async function refundFiling(db: SupabaseClient, predictionId: string) {
  const { data, error } = await db.rpc("refund_filing", { p_prediction_id: predictionId });
  if (error) throw new Error(`refund_filing failed: ${error.message}`);
  return data === true;
}
