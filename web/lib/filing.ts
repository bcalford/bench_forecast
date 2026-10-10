// Shared rules for filing a case: what the form checks in the browser is checked again on the server.
export const MAX_MB = 25;
export const MIN_DESCRIPTION = 80;
export const CURRENT_TERM = "October Term 2026";

export type Filing = {
  caseId: string;
  title: string;
  docket: string;
  mode: "briefs" | "description";
  briefPaths: string[]; // petitioner, respondent, then amici; Storage paths under `${caseId}/`
  transcriptPath: string | null;
  description: string;
  recused: string[];
  code: string;
};

export type Slot = "pet" | "resp" | "amicus" | "transcript";

// Stored names carry an order prefix and the label the summarizer shows for each brief.
export function storedName(slot: Slot, index: number, original: string) {
  const safe = original.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9 ._-]+/g, "").trim().slice(0, 80) || "brief";
  if (slot === "pet") return "01-Brief for the Petitioner.pdf";
  if (slot === "resp") return "02-Brief for the Respondent.pdf";
  if (slot === "transcript") return "argument-transcript.pdf";
  return `${String(10 + index).padStart(2, "0")}-Amicus - ${safe}.pdf`;
}

// The filing gate (migration 8). Reasons come back from filing_status and claim_filing.
export type GateReason = "ok" | "unknown" | "inactive" | "used_up" | "cap";
export const HOLD_USD = 2.5; // held from the day's budget for each run in flight
export const CODE_RE = /^BF-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const CODE_FORMAT_MESSAGE = "Invite codes look like BF-7Q2K-M4XD. Check for a missing dash.";

// Accepts lowercase, spaces and missing dashes; anything else comes back trimmed and upper-cased.
export function normalizeCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 10 && raw.startsWith("BF") ? `BF-${raw.slice(2, 6)}-${raw.slice(6)}` : input.trim().toUpperCase();
}

export function reasonMessage(reason: Exclude<GateReason, "ok">, maxRuns: number | null = null): string {
  switch (reason) {
    case "unknown": return "That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD.";
    case "inactive": return "That invite code has been turned off.";
    case "used_up": return maxRuns == null ? "That invite code has used all of its runs." : `That invite code has used all ${maxRuns} of its runs.`;
    case "cap": return "Today's forecasting budget is spent. Filing reopens at midnight Eastern.";
  }
}

export const isCodeReason = (r: unknown) => r === "unknown" || r === "inactive" || r === "used_up";
