// Forecast every argued October Term 2026 case after argument (spec §1). Runs go to production through
// Inngest Cloud (INNGEST_PROD_EVENT_KEY) and count against --max-spend, not the public cap.
//   npm run docket -- list
//   npm run docket -- schedule                     (every case on the published hearing lists, future ones too)
//   npm run docket -- forecast --max-spend 30 [--cases 25-170,25-498] [--recuse 25-170:alito] [--dry-run] [--force]
import { randomUUID } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { COURT, parseHearingList, parseTranscriptLinks, type HearingCase } from "../../lib/court-site";
import { assembleCase, caseLimit, missing, type DocketCase } from "../../lib/docket";
import { courtPdf, courtText } from "../../lib/fetch-court";
import { HOLD_USD, storedName } from "../../lib/filing";
import { serviceClient } from "../../lib/supabase";
import { prodInngest } from "./prod-inngest";

const TERM = 2026;
const MONTHS = ["October", "November", "December", "January", "February", "March", "April", "May", "June"];
const db = serviceClient();
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

async function hearingCases(includeFuture = false): Promise<HearingCase[]> {
  const out: HearingCase[] = [];
  for (const [i, m] of MONTHS.entries()) {
    const year = i < 3 ? TERM : TERM + 1;
    let bytes: Uint8Array;
    try { bytes = await courtPdf(`${COURT}/oral_arguments/hearinglists/HearingList-${m}${year}.pdf`); } catch { break; }
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    out.push(...parseHearingList(String(text)));
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return includeFuture ? out : out.filter((c) => c.argued && c.argued <= today);
}

// Cases already forecast after argument (locked, queued or running), by docket.
async function alreadyForecast(): Promise<Set<string>> {
  const { data, error } = await db.from("cases").select("docket, predictions!inner(status, phase)")
    .eq("term", `October Term ${TERM}`).eq("predictions.phase", "after_argument").in("predictions.status", ["locked", "queued", "running"]);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((c) => c.docket as string));
}

async function gather(cases: HearingCase[]): Promise<DocketCase[]> {
  const transcripts = parseTranscriptLinks(await courtText(`${COURT}/oral_arguments/argument_transcript/${TERM}`));
  const overrides = list(arg("recuse")).map((r) => r.split(":"));
  const out: DocketCase[] = [];
  for (const h of cases) {
    const html = await courtText(`${COURT}/docket/docketfiles/html/public/${h.docket}.html`).catch(() => "");
    out.push(assembleCase(h, transcripts, html, overrides.filter(([d]) => d === h.docket).map(([, s]) => s)));
  }
  return out;
}

async function file(c: DocketCase): Promise<string> {
  const caseId = randomUUID();
  const put = async (url: string, name: string) => {
    const path = `${caseId}/${name}`;
    const { error } = await db.storage.from("briefs").upload(path, await courtPdf(url), { contentType: "application/pdf" });
    if (error) throw new Error(`upload ${name}: ${error.message}`);
    return path;
  };
  const briefPaths = [await put(c.petitioner!.url, storedName("pet", 0, "")), await put(c.respondent!.url, storedName("resp", 0, ""))];
  const transcriptPath = await put(c.transcript!, storedName("transcript", 0, ""));
  const ins = await db.from("cases").insert({
    id: caseId, title: c.title, docket: c.docket, term: `October Term ${TERM}`, input_mode: "briefs",
    brief_paths: briefPaths, oa_transcript_path: transcriptPath, recused: c.recused, argued_on: c.argued,
  });
  if (ins.error) throw new Error(ins.error.message);
  const p = await db.from("predictions").insert({ case_id: caseId, phase: "after_argument", origin: "docket", as_of: c.argued }).select("id").single();
  if (p.error) throw new Error(p.error.message);
  try {
    await prodInngest().send({ name: "case/predict.docket", data: { predictionId: p.data.id } });
  } catch (e) {
    // Leave nothing that looks in flight: a failed run doesn't block the case on the next batch.
    await db.from("predictions").update({ status: "failed", stage: "failed", error: "The run couldn't be started." }).eq("id", p.data.id);
    throw new Error(`couldn't start the run (${(e as Error).message}); marked failed, so the next batch retries it`);
  }
  return p.data.id as string;
}

async function main() {
  const cmd = process.argv[2];
  const done = await alreadyForecast();
  const only = list(arg("cases"));

  if (cmd === "schedule") {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    for (const c of await hearingCases(true)) {
      const status = done.has(c.docket) ? "forecast exists" : !c.argued ? "date not set" : c.argued > today ? "upcoming" : "argued";
      console.log(`${c.docket.padEnd(9)} ${(c.argued || "—").padEnd(10)}  ${status.padEnd(15)}  ${c.title}${c.consolidatedWith.length ? `  (with ${c.consolidatedWith.join(", ")})` : ""}`);
    }
    return;
  }

  let cases = await hearingCases();
  if (only.length) cases = cases.filter((c) => only.includes(c.docket));
  const gathered = await gather(cases);

  if (cmd === "list") {
    for (const c of gathered) {
      const status = done.has(c.docket) ? "forecast exists" : missing(c).join("; ") || "ready";
      console.log(`${c.docket.padEnd(9)} argued ${c.argued}  ${status}${c.recused.length ? `  recused: ${c.recused.join(", ")}` : ""}${c.consolidatedWith.length ? `  (with ${c.consolidatedWith.join(", ")})` : ""}  ${c.title}`);
    }
    return;
  }
  if (cmd !== "forecast") throw new Error("Usage: npm run docket -- list | schedule | forecast --max-spend N [--cases a,b] [--recuse docket:slug] [--dry-run] [--force]");

  const maxSpend = Number(arg("max-spend"));
  if (!(maxSpend > 0)) throw new Error("Pass --max-spend in dollars, e.g. --max-spend 30.");
  const limit = caseLimit(maxSpend);
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry-run");
  const todo = gathered.filter((c) => force || !done.has(c.docket));
  let started = 0;
  for (const c of todo) {
    const why = missing(c);
    if (why.length) { console.log(`skip ${c.docket}: ${why.join("; ")}`); continue; }
    if (started >= limit) { console.log(`stop: --max-spend $${maxSpend} allows ${limit} case(s) at $${HOLD_USD.toFixed(2)} each`); break; }
    if (dry) { console.log(`would file ${c.docket} ${c.title}${c.recused.length ? ` (recused: ${c.recused.join(", ")})` : ""}`); started++; continue; }
    try {
      const id = await file(c);
      console.log(`filed ${c.docket} ${c.title} → https://bench-forecast.vercel.app/runs/${id}`);
      started++;
    } catch (e) {
      console.log(`failed ${c.docket}: ${(e as Error).message}`);
    }
  }
  console.log(`${dry ? "Would start" : "Started"} ${started} forecast(s), about $${(started * HOLD_USD).toFixed(2)}.`);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
