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

// Filing is closed in production until invite codes and the daily budget land (phase 6).
export const filingOpen = () => process.env.NODE_ENV !== "production" || process.env.FILING_OPEN === "1";
