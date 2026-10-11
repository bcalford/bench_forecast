import { getText } from "../http";
import { COURT, parseSlipListing, type ListedOpinion } from "../../../lib/court-site";

export type { ListedOpinion };

// The Court's own slip-opinion listing for a term (available from OT2020 on; earlier terms
// have moved to the bound U.S. Reports, so those come from CourtListener's stored copies).
export async function listTerm(year: number): Promise<ListedOpinion[]> {
  const yy = String(year % 100).padStart(2, "0");
  return parseSlipListing(await getText(`${COURT}/opinions/slipopinion/${yy}`, `supremecourt/listing-${yy}.html`), year);
}
