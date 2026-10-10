import { getText } from "../http";
import type { ListedOpinion } from "./supremecourt";
import { listArguments } from "./transcripts";

const API = "https://www.courtlistener.com/api/rest/v4";
const STORAGE = "https://storage.courtlistener.com";

type SearchHit = {
  caseName: string; dateFiled: string; docketNumber: string; judge: string;
  opinions: { local_path: string | null; type: string }[];
};

// Older terms: supremecourt.gov no longer lists their slip opinions, but every argued case appears in the
// argument-transcript listing. One CourtListener search per docket finds the stored slip-opinion PDF.
export async function listTermFromCourtListener(year: number): Promise<{ listed: ListedOpinion[]; missing: string[] }> {
  const token = process.env.COURTLISTENER_TOKEN;
  if (!token) throw new Error("COURTLISTENER_TOKEN is missing from .env.local");
  const argued = await listArguments(year);
  const listed: ListedOpinion[] = [];
  const missing: string[] = [];

  for (const a of argued) {
    const docket = a.docket.split(/[ ,]/)[0];
    const q = new URLSearchParams({ type: "o", court: "scotus", q: `docketNumber:"${docket}"`, order_by: "dateFiled desc" });
    const body = await getText(`${API}/search/?${q}`, `courtlistener/search-${docket}.json`, { Authorization: `Token ${token}` });
    const hits = (JSON.parse(body).results ?? []) as SearchHit[];
    // The merits decision names an authoring justice and has a stored PDF; take the latest (revisions supersede).
    const hit = hits.find((h) => h.judge && h.opinions.some((o) => o.local_path?.endsWith(".pdf")));
    const path = hit?.opinions.find((o) => o.local_path?.endsWith(".pdf"))?.local_path;
    if (!hit || !path) { missing.push(`${a.term} ${docket} ${a.caseName}`); continue; }
    listed.push({ term: `OT${year}`, date: hit.dateFiled, docket, caseName: hit.caseName || a.caseName, url: `${STORAGE}/${path}` });
  }
  // Consolidated cases share one opinion PDF.
  return { listed: [...new Map(listed.map((o) => [o.url, o])).values()], missing };
}
