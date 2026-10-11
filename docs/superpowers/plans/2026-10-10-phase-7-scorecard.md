# Phase 7: Docket Forecasts, Decisions and the Scorecard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forecast every argued OT2026 case after argument with an owner-run script, read the Court's decisions daily, score the forecasts, and publish the record on `/scorecard`.

**Architecture:** Pure parsers for the Court's website (`lib/court-site.ts`) and for decision syllabi (`lib/decisions.ts`), a pure scorer (`lib/scoring.ts`) and pure scorecard aggregations (`lib/scorecard.ts`) carry all the logic and the tests. Thin server modules talk to Supabase (`lib/outcomes.ts`, `lib/scorecard-data.ts`); an Inngest cron function reads decisions; two owner scripts (`docket`, `outcomes`) start runs and manage the review queue; the scorecard page ports the `web-1` prototype onto `ScoredCase[]`.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase (Postgres, Storage, supabase-js), Inngest 4.22 (cron + events), `unpdf` (already used), `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-phase-7-scorecard-design.md`

All paths are relative to `web/` unless they start with `docs/`, `PROGRESS.md` or `decisions.md`.

## Global Constraints

- Term string for scored cases: `October Term 2026`. Only forecasts on cases with that term, `decided_before_cutoff = false`, locked on an Eastern calendar date before `outcomes.decided_at`, are scored.
- Docket forecasts: after argument only; petitioners' and respondents' merits briefs ("Main Document") and the transcript; no amici, no replies, no briefs in opposition; at most ⌊max-spend ÷ $2.50⌋ cases per run of the script (`HOLD_USD = 2.5` from `lib/filing.ts`).
- `predictions.origin` ∈ `invite | docket | owner`; the public cap (`filing_budget`) counts only `invite`.
- Daily decision job: Inngest cron `TZ=America/New_York 0 18 * * *`, plus event `decisions/read.requested` `{ term?: number, dryRun?: boolean }`.
- Outcome votes: `{ slug: "affirm" | "reverse" | "vacate_remand" | "other" }`, recused justices absent; `outcomes.status` ∈ `scored | needs_review`.
- Sides for scoring: `affirm` vs set aside (`reverse`, `vacate_remand`); `other` matches only `other`; an equally divided Court counts as affirm.
- Totals count one forecast per case: the `docket` forecast if any, else the earliest locked. Before/after-argument figures use every scored forecast.
- Calibration bands: 50–59, 60–69, 70–79, 80–89, 90–100 % (confidence below 0.5 joins the first band); shown at ≥ 20 scored votes.
- Scripts that start production runs use a separate Inngest client with `INNGEST_PROD_EVENT_KEY` (only these scripts read it); the app's own client and `INNGEST_DEV` are untouched.
- Court site requests send `User-Agent: BenchForecast/1.0 (+https://bench-forecast.vercel.app)`.
- Product rules: no scoreboard/betting look, no partisan colours; the sample season is always labelled "Sample data, not real results" and never opens by default.
- Commits: no Claude attribution. No push without the owner's say-so. No real docket forecasts (spending) without the owner running the script.

## Review Focus

1. A Court page whose layout shifts (a brief filed under unusual wording, a consolidated case, a caption with extra periods) → the docket script skips that case with a reason instead of filing the wrong documents (Task 2 parser tests on real fixtures; Task 6 skip logic).
2. A decision whose syllabus line-up the parser misreads (hyphen-split names, unanimous wording, "concurring in part", per curiam) → the outcome goes to review, never scored silently wrong (Task 3 tests on real syllabi).
3. A case forecast more than once (invite + docket, or a rerun) → term totals count it once; before/after still sees each (Task 4 `countingForecasts` test).
4. An outcome corrected after scoring → its scores are replaced, not duplicated (Task 5 upsert check).
5. The docket script run twice, or while runs are still in flight → no second forecast for the same case (Task 6 existing-forecast check includes queued and running).

## Where this plan departs from the spec (found while checking the real systems)

- **Concurrency.** Spec §1 has docket runs share `predict-case` with `concurrency: [{ key: "event.data.lane", limit: 2 }]`. Inngest's concurrency limit counts *steps*, not runs (`node_modules/inngest/types.d.ts`, `ConcurrencyOption`), so that setting would also cap every public run at 2 justices at a time (about 10 minutes instead of 5). Instead the same handler is registered twice: `predict-case` (unchanged) and `predict-docket-case` on event `case/predict.docket` with `concurrency: [{ limit: 9 }]`. No `lane` field. A 12-case batch takes about an hour rather than 30 minutes.
- **Starting production runs from a script.** `.env.local` sets `INNGEST_DEV`, so the app's client sends to the local dev server. The docket and outcomes scripts use their own client with `INNGEST_PROD_EVENT_KEY`, which nothing else reads.
- **Titles and recusals.** Docket pages have no parseable caption, so titles come from the hearing list. Recusals are rarely on the docket before the decision, so `--recuse` is the main route and the docket parse is a fallback.
- **Existing forecasts.** The docket script also skips cases with a *queued or running* after-argument forecast, not only locked ones, so a rerun during a batch doesn't double-file.
- **`readDecision(text)`** takes only the text; the sitting Court is the active roster less any recusals it reads.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20261011000010_scorecard.sql` | create | `predictions.origin`, invite-only `filing_budget`, `claim_filing` origin, `spend_today_by_origin()`, `outcomes` status columns |
| `scripts/try/gate-check.ts` | modify | origin checks |
| `lib/court-site.ts` + `lib/court-site.test.ts` + `lib/fixtures/court/*` | create | parsers: hearing list, transcripts page, docket page, slip listing; `normalizeDocket` |
| `scripts/ingest/sources/supremecourt.ts` | modify | use `parseSlipListing` |
| `lib/decisions.ts` + `lib/decisions.test.ts` | create | `readDecision(syllabus)` |
| `lib/scoring.ts` + `lib/scoring.test.ts` | create | `scoreForecast`, `countingForecasts`, `lockedBeforeDecision`, `calibration` |
| `lib/fetch-court.ts` | create | fetch text/PDF from the Court site; `syllabusText(pdfUrl)` |
| `lib/outcomes.ts` | create | DB: awaiting cases, save outcome, score a case |
| `inngest/readDecisions.ts`, `inngest/functions.ts` | create | daily job; function list |
| `inngest/predictCase.ts`, `app/api/inngest/route.ts` | modify | docket twin function; register functions |
| `scripts/admin/prod-inngest.ts` | create | production Inngest client for scripts |
| `scripts/admin/outcomes.ts` | create | `review / confirm / set / run` |
| `lib/docket.ts` + `lib/docket.test.ts` | create | assemble a docket case from the Court site |
| `scripts/admin/docket.ts` | create | `list / forecast` |
| `scripts/admin/invite.ts` | modify | spend line for docket/owner |
| `lib/scorecard.ts` + `lib/scorecard.test.ts` | create | `ScoredCase`, `buildScoredCase`, aggregations |
| `lib/scorecard-data.ts` | create | load scored cases, waiting list |
| `lib/sample-season.ts` | create | port of `web-1/src/sampleSeason.js` |
| `components/ScorecardView.tsx`, `app/scorecard/page.tsx` | create / modify | port of `web-1/src/pages/Scorecard.jsx` |
| `package.json` | modify | `docket`, `outcomes` scripts |
| `docs/scorecard-ops.md`, `PROGRESS.md`, `decisions.md` | create / modify | owner runbook, handoff, Q27 |

---

### Task 1: Migration 10 — origins, invite-only budget, outcome status

**Files:**
- Create: `supabase/migrations/20261011000010_scorecard.sql`
- Modify: `scripts/try/gate-check.ts`

**Interfaces:**
- Produces: `predictions.origin` (`invite | docket | owner`, default `owner`); `claim_filing` inserts `origin = 'invite'`; `filing_budget(cap, hold)` counts only invite runs; `spend_today_by_origin() returns table (origin text, usd numeric)`; `outcomes.status` (`scored | needs_review`, default `scored`), `outcomes.source_url`, `outcomes.notes`.

- [ ] **Step 1: Extend the gate check (failing test)**

In `scripts/try/gate-check.ts`, in the "Holds" block, change both prediction inserts to give an origin, and add owner-origin checks. Replace:

```ts
    await a.query(
      "insert into predictions (case_id, phase, status, created_at) values ($1, 'before_argument', 'queued', now() - interval '3 hours')",
      [await newCase()],
    );
    assert.equal(await room(), before, "a run stuck for 3 hours holds nothing");
    await a.query("insert into predictions (case_id, phase, status) values ($1, 'before_argument', 'queued')", [await newCase()]);
    assert.equal(await room(), before - HOLD, "a fresh queued run holds $2.50");
```

with:

```ts
    await a.query(
      "insert into predictions (case_id, phase, status, origin, created_at) values ($1, 'before_argument', 'queued', 'invite', now() - interval '3 hours')",
      [await newCase()],
    );
    assert.equal(await room(), before, "a run stuck for 3 hours holds nothing");
    const fresh = await newCase();
    await a.query("insert into predictions (case_id, phase, status, origin) values ($1, 'before_argument', 'queued', 'invite')", [fresh]);
    assert.equal(await room(), before - HOLD, "a fresh queued invite run holds $2.50");

    // Owner and docket runs neither hold nor spend from the public budget.
    const ownerCase = await newCase();
    const ownerPred = (await a.query("insert into predictions (case_id, phase, status, origin) values ($1, 'after_argument', 'running', 'docket') returning id", [ownerCase])).rows[0].id;
    await a.query("insert into spend_ledger (prediction_id, model, input_tokens, output_tokens, cost_usd) values ($1, 'gate-check', 0, 0, 5)", [ownerPred]);
    assert.equal(await room(), before - HOLD, "docket runs don't touch the public budget");
    const invitePred = (await a.query("select id from predictions where case_id = $1", [fresh])).rows[0].id;
    await a.query("insert into spend_ledger (prediction_id, model, input_tokens, output_tokens, cost_usd) values ($1, 'gate-check', 0, 0, 1)", [invitePred]);
    assert.equal(await room(), before - HOLD - 1, "invite spend counts");
    const byOrigin = Object.fromEntries((await a.query("select origin, usd from spend_today_by_origin()")).rows.map((r) => [r.origin, Number(r.usd)]));
    assert.ok(byOrigin.docket >= 5, "spend_today_by_origin reports docket spend");
```

After the concurrency block (after `assert.equal((await status(CODES.one)).reason, "used_up");`) add:

```ts
    assert.equal((await a.query("select origin from predictions where id = $1", [won.prediction_id])).rows[0].origin, "invite", "claims are invite runs");
```

In the `finally` block, before deleting cases, add:

```ts
    await a.query("delete from spend_ledger where model = 'gate-check'");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx tsx --env-file=.env.local scripts/try/gate-check.ts`
Expected: FAIL with `column "origin" of relation "predictions" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261011000010_scorecard.sql`:

```sql
-- Phase 7: which runs are which, a public budget that counts only invite runs, and the outcome review queue
-- (docs/superpowers/specs/2026-10-10-phase-7-scorecard-design.md §1–2).

alter table predictions
  add column origin text not null default 'owner' check (origin in ('invite', 'docket', 'owner'));
update predictions p set origin = 'invite' where exists (select 1 from filing_claims fc where fc.prediction_id = p.id);

-- The public cap counts invite runs only: the owner's docket batches and backtests have their own limits.
create or replace function filing_budget(p_cap numeric, p_hold numeric) returns numeric
language sql stable security invoker as $$
  select p_cap
    - coalesce((select sum(s.cost_usd) from spend_ledger s join predictions p on p.id = s.prediction_id
                where p.origin = 'invite'
                  and s.created_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')), 0)
    - p_hold * (select count(*) from predictions
                where origin = 'invite' and status in ('queued', 'running') and created_at > now() - interval '2 hours');
$$;

create or replace function claim_filing(p_code text, p_case_id uuid, p_phase text, p_cap numeric, p_hold numeric)
returns table (reason text, max_runs integer, prediction_id uuid)
language plpgsql volatile security invoker as $$
#variable_conflict use_column
declare
  c invite_codes%rowtype;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('bench_forecast.claim_filing'));
  select * into c from invite_codes where code = p_code for update;
  if not found then return query select 'unknown'::text, null::integer, null::uuid; return; end if;
  if not c.active then return query select 'inactive'::text, c.max_runs, null::uuid; return; end if;
  if c.used_runs >= c.max_runs then return query select 'used_up'::text, c.max_runs, null::uuid; return; end if;
  if filing_budget(p_cap, p_hold) < p_hold then return query select 'cap'::text, c.max_runs, null::uuid; return; end if;

  update invite_codes set used_runs = used_runs + 1 where code = p_code;
  insert into predictions (case_id, phase, origin) values (p_case_id, p_phase, 'invite') returning id into new_id;
  insert into filing_claims (prediction_id, invite_code) values (new_id, p_code);
  return query select 'ok'::text, c.max_runs, new_id;
end $$;

-- Today's spend (midnight America/New_York onward) by origin, for `npm run invite -- spend`.
create function spend_today_by_origin() returns table (origin text, usd numeric)
language sql stable security invoker as $$
  select coalesce(p.origin, 'none'), sum(s.cost_usd)
    from spend_ledger s left join predictions p on p.id = s.prediction_id
   where s.created_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')
   group by 1;
$$;
revoke execute on function spend_today_by_origin() from public, anon, authenticated;
grant execute on function spend_today_by_origin() to service_role;

-- The outcome review queue.
alter table outcomes
  add column status text not null default 'scored' check (status in ('scored', 'needs_review')),
  add column source_url text,
  add column notes text;
```

- [ ] **Step 4: Apply and verify**

Run: `cd web && npx tsx --env-file=.env.local scripts/db/sql.ts supabase/migrations/20261011000010_scorecard.sql`
Expected: `ALTER`/`UPDATE`/`CREATE`/`REVOKE`/`GRANT` lines, then `done in … ms`.
Run: `npx tsx --env-file=.env.local scripts/try/gate-check.ts` → `gate-check: all checks passed`.
Run: `npx tsx --env-file=.env.local scripts/db/sql.ts -c "select origin, count(*) from predictions group by 1 order by 1"` → `invite` 1 (Suncor) and `owner` for the rest (FCC and any failed test runs).

- [ ] **Step 5: Commit**

```bash
git add web/supabase/migrations/20261011000010_scorecard.sql web/scripts/try/gate-check.ts
git commit -m "Run origins: the public cap counts only invite runs; outcome review columns"
```

---

### Task 2: Parsers for the Court's website

**Files:**
- Create: `lib/court-site.ts`, `lib/court-site.test.ts`
- Create fixtures: `lib/fixtures/court/hearing-october-2026.txt`, `lib/fixtures/court/transcripts-2026.html`, `lib/fixtures/court/docket-25-170.html`, `lib/fixtures/court/docket-25-579.html`, `lib/fixtures/court/slipopinion-24.html`
- Modify: `scripts/ingest/sources/supremecourt.ts`

**Interfaces:**
- Produces:
  - `COURT = "https://www.supremecourt.gov"`, `COURT_HEADERS = { "user-agent": "BenchForecast/1.0 (+https://bench-forecast.vercel.app)" }`
  - `normalizeDocket(s: string): string` — `"No. 25–170"` → `"25-170"`; `""` if none.
  - `type HearingCase = { docket: string; title: string; argued: string /* YYYY-MM-DD */; consolidatedWith: string[] }`; `parseHearingList(text: string): HearingCase[]`
  - `parseTranscriptLinks(html: string): Record<string, string>` (docket → absolute PDF URL)
  - `type DocketDoc = { filed: string; url: string }`; `parseDocketPage(html: string): { petitioner: DocketDoc | null; respondent: DocketDoc | null; recused: string[] }`
  - `type ListedOpinion = { term: string; date: string; docket: string; caseName: string; url: string }`; `parseSlipListing(html: string, year: number): ListedOpinion[]`
  - `currentTerm(now?: Date): number` — the October Term year in progress (October onward = this year, else last year).

- [ ] **Step 1: Save the fixtures from the live site**

```bash
cd web && mkdir -p lib/fixtures/court
UA="BenchForecast/1.0 (+https://bench-forecast.vercel.app)"
curl -s -A "$UA" -o /tmp/hl.pdf https://www.supremecourt.gov/oral_arguments/hearinglists/HearingList-October2026.pdf
cat > /tmp/hl.mts <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
const pdf = await getDocumentProxy(new Uint8Array(readFileSync("/tmp/hl.pdf")));
const { text } = await extractText(pdf, { mergePages: true });
writeFileSync("lib/fixtures/court/hearing-october-2026.txt", String(text));
EOF
cp /tmp/hl.mts ./hl.mts && npx tsx hl.mts && rm hl.mts
curl -s -A "$UA" -o lib/fixtures/court/transcripts-2026.html https://www.supremecourt.gov/oral_arguments/argument_transcript/2026
curl -s -A "$UA" -o lib/fixtures/court/docket-25-170.html https://www.supremecourt.gov/docket/docketfiles/html/public/25-170.html
curl -s -A "$UA" -o lib/fixtures/court/docket-25-579.html https://www.supremecourt.gov/docket/docketfiles/html/public/25-579.html
curl -s -A "$UA" -o lib/fixtures/court/slipopinion-24.html https://www.supremecourt.gov/opinions/slipopinion/24
wc -c lib/fixtures/court/*
```
Expected: five non-empty files; the hearing text contains `No. 25-170. Suncor Energy`.

- [ ] **Step 2: Write the failing tests**

Create `lib/court-site.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { currentTerm, normalizeDocket, parseDocketPage, parseHearingList, parseSlipListing, parseTranscriptLinks } from "./court-site";

const fx = (name: string) => readFileSync(join(__dirname, "fixtures", "court", name), "utf8");

describe("normalizeDocket", () => {
  it("pulls a docket number out of a label and uses a plain hyphen", () => {
    assert.equal(normalizeDocket("No. 25–170"), "25-170");
    assert.equal(normalizeDocket("25-5343"), "25-5343");
    assert.equal(normalizeDocket("Original 22"), "");
  });
});

describe("parseHearingList", () => {
  const cases = parseHearingList(fx("hearing-october-2026.txt"));
  it("finds each argued case with its date and a clean title", () => {
    const suncor = cases.find((c) => c.docket === "25-170");
    assert.deepEqual(suncor, {
      docket: "25-170", argued: "2026-10-05", consolidatedWith: [],
      title: "Suncor Energy (U.S.A.) Inc. v. County Commissioners of Boulder County",
    });
    assert.equal(cases.find((c) => c.docket === "25-498")?.argued, "2026-10-06");
    assert.equal(cases.find((c) => c.docket === "25-735")?.title, "Floyd D. Johnson v. United States Congress");
  });
  it("lists no holiday or session header as a case, and no docket twice", () => {
    assert.ok(cases.length >= 6);
    assert.equal(new Set(cases.map((c) => c.docket)).size, cases.length);
    for (const c of cases) assert.match(c.docket, /^\d{2}-\d+$/);
  });
  it("groups consolidated cases under the first docket", () => {
    const text = "Monday, November 2, 2026\nNo. 25-111. Alpha Corp. v. Beta.\nNo. 25-222. Gamma v. Beta.\n(Consolidated for one hour of oral argument.)\nCertiorari to the C. A. 9th Circuit.\nNo. 25-333. Delta v. Echo.\nCertiorari to the C. A. 2nd Circuit.";
    const cs = parseHearingList(text);
    assert.deepEqual(cs.map((c) => [c.docket, c.consolidatedWith]), [["25-111", ["25-222"]], ["25-333", []]]);
    assert.equal(cs[0].title, "Alpha Corp. v. Beta");
  });
});

describe("parseTranscriptLinks", () => {
  it("maps docket numbers to absolute transcript URLs", () => {
    const links = parseTranscriptLinks(fx("transcripts-2026.html"));
    assert.equal(links["25-170"], "https://www.supremecourt.gov/oral_arguments/argument_transcripts/2026/25-170_8m58.pdf");
  });
});

describe("parseDocketPage", () => {
  it("takes the merits briefs' main documents, not briefs in opposition or replies", () => {
    const d = parseDocketPage(fx("docket-25-170.html"));
    assert.equal(d.petitioner?.url, "https://www.supremecourt.gov/DocketPDF/25/25-170/408810/20260514091116673_Boulder%20brief%20for%20petitioners%20FINAL.pdf");
    assert.equal(d.respondent?.url, "https://www.supremecourt.gov/DocketPDF/25/25-170/418043/20260803182738077_25-170%20Brief.pdf");
    assert.equal(d.petitioner?.filed, "May 14 2026");
  });
  it("handles a government petitioner and a single respondent", () => {
    const d = parseDocketPage(fx("docket-25-579.html"));
    assert.ok(d.petitioner?.url.includes("/25-579/"));
    assert.ok(d.respondent?.url.includes("/25-579/"));
    assert.notEqual(d.petitioner?.filed, "Feb 04 2026", "not the cert-stage reply");
    assert.notEqual(d.respondent?.filed, "Jan 16 2026", "not the brief in opposition");
  });
  it("reads a recusal entry", () => {
    const html = `<td class="ProceedingDate">Oct 01 2026</td><td>JUSTICE ALITO took no part in the consideration or decision of this petition.</td>`;
    assert.deepEqual(parseDocketPage(html).recused, ["alito"]);
  });
  it("returns nulls when a brief is missing", () => {
    assert.deepEqual(parseDocketPage("<html></html>"), { petitioner: null, respondent: null, recused: [] });
  });
});

describe("parseSlipListing", () => {
  it("lists OT2024 opinions with dates, dockets and PDF links", () => {
    const list = parseSlipListing(fx("slipopinion-24.html"), 2024);
    const fcc = list.find((o) => o.docket.startsWith("24-354"));
    assert.equal(fcc?.date, "2025-06-27");
    assert.match(fcc!.url, /^https:\/\/www\.supremecourt\.gov\/opinions\/24pdf\/24-354_.+\.pdf$/);
    assert.ok(list.length > 50);
  });
});

describe("currentTerm", () => {
  it("rolls over in October", () => {
    assert.equal(currentTerm(new Date("2026-10-10T12:00:00Z")), 2026);
    assert.equal(currentTerm(new Date("2027-06-30T12:00:00Z")), 2026);
    assert.equal(currentTerm(new Date("2026-09-30T12:00:00Z")), 2025);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd web && npx tsx --test lib/court-site.test.ts`
Expected: FAIL — cannot find module `./court-site`.

- [ ] **Step 4: Implement `lib/court-site.ts`**

```ts
// Parsers for the Supreme Court's website: hearing lists, the transcripts page, docket pages and slip-opinion
// listings. Pure functions over text the callers fetch, so scripts and the Inngest job share them.
export const COURT = "https://www.supremecourt.gov";
export const COURT_HEADERS = { "user-agent": "BenchForecast/1.0 (+https://bench-forecast.vercel.app)" };

const SURNAMES: Record<string, string> = {
  ROBERTS: "roberts", THOMAS: "thomas", ALITO: "alito", SOTOMAYOR: "sotomayor", KAGAN: "kagan",
  GORSUCH: "gorsuch", KAVANAUGH: "kavanaugh", BARRETT: "barrett", JACKSON: "jackson",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&#8217;/g, "’").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
const strip = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export const normalizeDocket = (s: string) => (s.match(/\d{2}[-–]\d+/)?.[0] ?? "").replace("–", "-");

export const currentTerm = (now = new Date()) => (now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);

export type HearingCase = { docket: string; title: string; argued: string; consolidatedWith: string[] };

// "No. 25-170. Suncor Energy (U.S.A.) Inc., et al. v. County Commissioners of Boulder County, et al." under a
// "Monday, October 5, 2026" heading. A caption ends at the next "Certiorari to", "Appeal from", "On writ",
// "(Consolidated", or the next "No." — the last one means the two cases are argued together.
export function parseHearingList(text: string): HearingCase[] {
  const flat = text.replace(/\s+/g, " ");
  const token = /(?:Monday|Tuesday|Wednesday|Thursday|Friday), ([A-Z][a-z]+) (\d{1,2}), (\d{4})|No\. (\d{2}-\d+)\. (.+?)\.\s(?=Certiorari|Appeal|On writ|On appeal|\(Consolidated|No\. \d{2}-\d)/g;
  const out: HearingCase[] = [];
  let date = "";
  let group: HearingCase | null = null;
  for (const m of flat.matchAll(token)) {
    if (m[1]) {
      date = `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      group = null;
      continue;
    }
    const docket = m[4];
    const title = m[5].replace(/,? et al\.?/g, "").replace(/\s+/g, " ").trim();
    const next = flat.slice(m.index! + m[0].length, m.index! + m[0].length + 3);
    if (group) group.consolidatedWith.push(docket);
    else {
      const c: HearingCase = { docket, title, argued: date, consolidatedWith: [] };
      if (!out.some((o) => o.docket === docket)) out.push(c);
      group = c;
    }
    if (next !== "No.") group = null;
  }
  return out;
}

export function parseTranscriptLinks(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/argument_transcripts\/(\d{4})\/(\d{2}-\d+)_([A-Za-z0-9]+)\.pdf/g)) {
    out[m[2]] ??= `${COURT}/oral_arguments/argument_transcripts/${m[1]}/${m[2]}_${m[3]}.pdf`;
  }
  return out;
}

export type DocketDoc = { filed: string; url: string };

// Docket rows are <td class="ProceedingDate">May 14 2026</td><td>Brief of petitioners … filed. <a href= URL
// class="documentanchor">Main Document</a> …</td>. Merits briefs are the last "Brief of petitioner(s)" and
// "Brief of respondent(s)" entries that aren't briefs in opposition.
export function parseDocketPage(html: string): { petitioner: DocketDoc | null; respondent: DocketDoc | null; recused: string[] } {
  let petitioner: DocketDoc | null = null;
  let respondent: DocketDoc | null = null;
  const recused = new Set<string>();
  for (const m of html.matchAll(/<td class="ProceedingDate">([^<]+)<\/td>\s*<td>([\s\S]*?)<\/td>/g)) {
    const filed = m[1].trim();
    const text = strip(m[2]);
    const main = m[2].match(/href=\s*["']?([^"'\s>]+)["']?\s+class="documentanchor"[^>]*>\s*Main Document/);
    const url = main ? (main[1].startsWith("http") ? main[1] : COURT + main[1]) : null;
    if (/took no part|recus/i.test(text)) {
      for (const n of text.match(/\b[A-Z]{4,}\b/g) ?? []) if (SURNAMES[n]) recused.add(SURNAMES[n]);
    }
    if (!url || /in opposition|amic/i.test(text)) continue;
    if (/^Brief of (?:the )?(?:federal )?petitioners?\b/i.test(text)) petitioner = { filed, url };
    else if (/^Brief of (?:the )?(?:federal )?respondents?\b/i.test(text)) respondent = { filed, url };
  }
  return { petitioner, respondent, recused: [...recused] };
}

export type ListedOpinion = { term: string; date: string; docket: string; caseName: string; url: string };

// The Court's slip-opinion listing for a term (available from OT2020 on).
export function parseSlipListing(html: string, year: number): ListedOpinion[] {
  const yy = String(year % 100).padStart(2, "0");
  const rows = html.split(/<tr[\s>]/i).slice(1);
  const out: ListedOpinion[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const link = row.match(new RegExp(`href=['"](/opinions/${yy}pdf/[^'"]+\\.pdf)['"][^>]*>([^<]+)</a>`, "i"));
    if (!link || cells.length < 4) continue;
    const date = cells.map((c) => c.trim()).find((c) => /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(c));
    const docket = cells.map((c) => c.replace(/<[^>]+>/g, "").trim()).find((c) => /^\d{2}[-–]\d+/.test(c) || /^\d+,? Orig\./.test(c));
    if (!date) continue;
    const [mo, d, y] = date.split("/").map(Number);
    out.push({
      term: `OT${year}`,
      date: `20${String(y).padStart(2, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      docket: docket ?? "",
      caseName: decode(link[2]).trim(),
      url: COURT + link[1],
    });
  }
  return [...new Map(out.map((o) => [o.url, o])).values()];
}
```

Then make `scripts/ingest/sources/supremecourt.ts` delegate (keeping its export names):

```ts
import { getText } from "../http";
import { COURT, parseSlipListing, type ListedOpinion } from "../../../lib/court-site";

export type { ListedOpinion };

// The Court's own slip-opinion listing for a term (available from OT2020 on; earlier terms
// have moved to the bound U.S. Reports, so those come from CourtListener's stored copies).
export async function listTerm(year: number): Promise<ListedOpinion[]> {
  const yy = String(year % 100).padStart(2, "0");
  return parseSlipListing(await getText(`${COURT}/opinions/slipopinion/${yy}`, `supremecourt/listing-${yy}.html`), year);
}
```

(Keep anything else exported from that file below `listTerm` unchanged.)

- [ ] **Step 5: Run to verify it passes, then the suite**

Run: `cd web && npx tsx --test lib/court-site.test.ts` → all pass.
If `parseHearingList` misses a case in the real fixture, print `parseHearingList(fx(...)).map(c => c.docket)` against `grep -o "No\. [0-9-]*" lib/fixtures/court/hearing-october-2026.txt` and fix the caption terminator, not the test.
Run: `npm test` and `npx tsc --noEmit` → pass.

- [ ] **Step 6: Commit**

```bash
git add web/lib/court-site.ts web/lib/court-site.test.ts web/lib/fixtures/court web/scripts/ingest/sources/supremecourt.ts
git commit -m "Parsers for the Court's hearing lists, transcripts, docket pages and slip listings"
```

---

### Task 3: Reading a decision's syllabus

**Files:**
- Create: `lib/decisions.ts`, `lib/decisions.test.ts`

**Interfaces:**
- Consumes: `justices` from `lib/court.ts` (the nine active slugs).
- Produces:
  - `type Judgment = "affirm" | "reverse" | "vacate_remand" | "other"`
  - `type Reading = { judgment: Judgment | null; outcome: string; votes: Record<string, "affirm" | "reverse" | "vacate_remand">; author: string | null; recused: string[]; clean: boolean; reasons: string[] }`
  - `readDecision(text: string): Reading` — `text` is the opening pages of a slip opinion (syllabus first); `outcome` is the judgment wording, capitalised ("Reversed and remanded"), or `"Undetermined"`.

The syllabus ends with the judgment and a line-up paragraph. FCC v. Consumers' Research, as the PDF text comes out:
`… Pp. 34–37. 109 F. 4th 743, reversed and remanded. KAGAN, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. KA - VANAUGH, J., and JACKSON, J., filed concurring opinions. GORSUCH, J., filed a dissenting opinion, in which THOMAS and ALITO, JJ., joined. _________________`
The opinion body uses a different form ("JUSTICE KAGAN delivered the opinion of the Court."), so the `NAME, J., delivered` form matches only the syllabus. A survey of the cached OT2024–OT2025 slip opinions found these line-up forms: "delivered the opinion of the Court", "… for a unanimous Court", "… with respect to Parts …", "joined as to Part …", "filed concurring opinions" (plural), "concurring in part and concurring in the judgment" (with the judgment), joint dissents, "took no part in the considera- tion …", and, for review, "dissenting in part", "concurring in the judgment in part and dissenting in part", no judgment line (stay applications), per curiam.

- [ ] **Step 1: Write the failing tests (real syllabus text)**

Create `lib/decisions.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readDecision } from "./decisions";

const END = " _________________ _________________ 1 Cite as: 606 U. S. ____ (2025) Opinion of the Court NOTICE: This opinion is subject to formal revision.";
const sides = (r: ReturnType<typeof readDecision>) => ({
  with: Object.entries(r.votes).filter(([, v]) => v === r.judgment).map(([s]) => s).sort(),
  against: Object.entries(r.votes).filter(([, v]) => v !== r.judgment).map(([s]) => s).sort(),
});

describe("readDecision on clean syllabi", () => {
  it("FCC v. Consumers' Research: 6–3 reversal, Kagan writing, a hyphen-split name", () => {
    const r = readDecision("Pp. 34–37. 109 F. 4th 743, reversed and remanded. KAGAN, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. KA - VANAUGH, J., and JACKSON, J., filed concurring opinions. GORSUCH, J., filed a dissenting opinion, in which THOMAS and ALITO, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.judgment, "reverse");
    assert.equal(r.outcome, "Reversed and remanded");
    assert.equal(r.author, "kagan");
    assert.deepEqual(sides(r), { with: ["barrett", "jackson", "kagan", "kavanaugh", "roberts", "sotomayor"], against: ["alito", "gorsuch", "thomas"] });
    assert.equal(r.votes.thomas, "affirm");
  });
  it("Catholic Charities: a unanimous Court", () => {
    const r = readDecision("Pp. 13–15. 3 Cite as: 605 U. S. ____ (2025) Syllabus 2024 WI 13, 411 Wis. 2d 1, 3 N. W. 3d 666, reversed and remanded. SOTOMAYOR, J., delivered the opinion for a unanimous Court. THOMAS, J., and JACKSON, J., filed concurring opinions." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.author, "sotomayor");
    assert.equal(Object.keys(r.votes).length, 9);
    assert.ok(Object.values(r.votes).every((v) => v === "reverse"));
  });
  it("Oklahoma v. EPA: a recusal and a concurrence in the judgment", () => {
    const r = readDecision("Pp. 9–13. 93 F. 4th 1262, reversed and remanded. THOMAS, J., delivered the opinion of the Court, in which SOTOMAYOR, KAGAN, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. GORSUCH, J., filed an opinion concurring in the judgment, in which ROBERTS, C. J., joined. ALITO, J., took no part in the consideration or decision of the case." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(r.recused, ["alito"]);
    assert.equal(Object.keys(r.votes).length, 8);
    assert.equal(r.votes.gorsuch, "reverse");
    assert.equal(r.votes.alito, undefined);
  });
  it("Gutierrez v. Saenz: a partial join that concurs in the judgment", () => {
    const r = readDecision("Pp. 13–14. 93 F. 4th 267, reversed and remanded. SOTOMAYOR, J., delivered the opinion of the Court, in which ROBERTS, C. J., and KAGAN, KAVANAUGH, and JACKSON, JJ., joined, and in which BARRETT, J., joined as to all but Part II.B.2. BARRETT, J., filed an opinion concurring in part and concurring in the judgment. THOMAS, J., filed a dissenting opinion. ALITO, J., filed a dissenting opinion, in which THOMAS and GORSUCH, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(sides(r).against, ["alito", "gorsuch", "thomas"]);
    assert.equal(r.votes.barrett, "reverse");
  });
  it("Monsalvo Velazquez v. Bondi: several dissents, one written jointly", () => {
    const r = readDecision("Pp. 11–18. 88 F. 4th 1301, reversed and remanded. 3 Cite as: 604 U. S. ____ (2025) Syllabus GORSUCH, J., delivered the opinion of the Court, in which ROBERTS, C. J., and SOTOMAYOR, KAGAN, and JACKSON, JJ., joined. THOMAS, J., filed a dissenting opinion, in which ALITO, J., joined, and in which KAVANAUGH and BARRETT, JJ., joined as to Parts I and II. ALITO, J., and BARRETT, J., filed dissenting opinions, in which KAVANAUGH, J., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.deepEqual(sides(r), { with: ["gorsuch", "jackson", "kagan", "roberts", "sotomayor"], against: ["alito", "barrett", "kavanaugh", "thomas"] });
  });
  it("Free Speech Coalition v. Paxton: an affirmance", () => {
    const r = readDecision("Pp. 34–35. 95 F. 4th 263, affirmed. THOMAS, J., delivered the opinion of the Court, in which ROBERTS, C. J., ALITO, GORSUCH, KAVANAUGH, and BARRETT, JJ., joined. KAGAN, J., filed a dissenting opinion, in which SOTOMAYOR and JACKSON, JJ., joined." + END);
    assert.equal(r.judgment, "affirm");
    assert.equal(r.outcome, "Affirmed");
    assert.equal(r.votes.kagan, "reverse");
  });
  it("EPA v. Calumet: vacated, with the Chief Justice in dissent", () => {
    const r = readDecision("Pp. 18–21. 86 F. 4th 1121, vacated and remanded. THOMAS, J., delivered the opinion of the Court, in which ALITO, SOTOMAYOR, KAGAN, KAVANAUGH, BARRETT, and JACKSON, JJ., joined. GORSUCH, J., filed a dissenting opinion, in which ROBERTS, C. J., joined." + END);
    assert.equal(r.judgment, "vacate_remand");
    assert.equal(r.votes.roberts, "affirm");
    assert.equal(r.clean, true, r.reasons.join("; "));
  });
  it("reads mixed-case names (preliminary-print small caps)", () => {
    const r = readDecision("Pp. 9–10. Reversed and remanded. Kavanaugh, J., delivered the opinion of the Court, in which Roberts, C. J., and Thomas, Alito, Gorsuch, and Barrett, JJ., joined. Kagan, J., filed a dissenting opinion, in which Sotomayor and Jackson, JJ., joined." + END);
    assert.equal(r.clean, true, r.reasons.join("; "));
    assert.equal(r.author, "kavanaugh");
  });
});

describe("readDecision sends unclear decisions to review", () => {
  it("Glossip v. Oklahoma: concurring in part and dissenting in part", () => {
    const r = readDecision("529 P. 3d 218, reversed and remanded. SOTOMAYOR, J., delivered the opinion of the Court, in which ROBERTS, C. J., and KAGAN, KAVANAUGH, and JACKSON, JJ., joined, and in which BARRETT, J., joined as to Part II. BARRETT, J., filed an opinion concurring in part and dissenting in part. THOMAS, J., filed a dissenting opinion, in which ALITO, J., joined, and in which BARRETT, J., joined as to Parts IV– A–1, IV–A–2, and IV–A–3. GORSUCH, J., took no part in the considera- tion or decision of the case." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /in part/.test(x)), r.reasons.join("; "));
    assert.deepEqual(r.recused, ["gorsuch"]);
  });
  it("Trump v. CASA: no judgment line", () => {
    const r = readDecision("P. 26. Applications for partial stays granted. BARRETT, J., delivered the opinion of the Court, in which ROBERTS, C. J., and THOMAS, ALITO, GORSUCH, and KAVANAUGH, JJ., joined. SOTOMAYOR, J., filed a dissenting opinion, in which KAGAN and JACKSON, JJ., joined. JACKSON, J., filed a dissenting opinion." + END);
    assert.equal(r.clean, false);
    assert.equal(r.judgment, null);
    assert.ok(r.reasons.some((x) => /judgment/.test(x)));
  });
  it("a per curiam", () => {
    const r = readDecision("SUPREME COURT OF THE UNITED STATES No. 25–1 ALPHA v. BETA PER CURIAM. The petition is granted and the judgment is reversed.");
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /per curiam/i.test(x)));
  });
  it("a plurality", () => {
    const r = readDecision("Reversed and remanded. ALITO, J., announced the judgment of the Court and delivered an opinion, in which ROBERTS, C. J., and THOMAS, J., joined." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /plurality/i.test(x)));
  });
  it("a justice left unaccounted for", () => {
    const r = readDecision("Affirmed. ROBERTS, C. J., delivered the opinion of the Court, in which THOMAS, ALITO, and GORSUCH, JJ., joined. KAGAN, J., filed a dissenting opinion." + END);
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => /not accounted for/.test(x)));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx tsx --test lib/decisions.test.ts`
Expected: FAIL — cannot find module `./decisions`.

- [ ] **Step 3: Implement `lib/decisions.ts`**

```ts
// Reading the Court's decision from a slip opinion's syllabus (spec §2): the judgment, each justice's vote,
// the author and recusals. Anything it can't read with confidence comes back unclean, with reasons, for the
// owner's review queue. Pure; lib/fetch-court.ts supplies the text.
import { justices } from "./court";

export type Judgment = "affirm" | "reverse" | "vacate_remand" | "other";
type CastVote = "affirm" | "reverse" | "vacate_remand";
export type Reading = {
  judgment: Judgment | null; outcome: string; votes: Record<string, CastVote>; author: string | null;
  recused: string[]; clean: boolean; reasons: string[];
};

const SLUGS = justices.map((j) => j.slug);
const NAME = new RegExp(`\\b(${SLUGS.join("|")})\\b`, "gi");
const names = (s: string) => [...new Set([...s.matchAll(NAME)].map((m) => m[1].toLowerCase()))];
const STARTS_LINEUP = /\b(?:[A-Z]{3,}|[A-Z][a-z]{2,}), (?:C\. ?J\.|J\.), (?:delivered|announced)\b/;
const NEXT_SENTENCE = /\.\s+(?=(?:[A-Z]{3,}|[A-Z][a-z]{2,}), (?:C\. ?J\.|J\.),)/;

// PDF text splits words across lines: "KA - VANAUGH", "considera- tion".
const tidy = (t: string) => t.replace(/\s+/g, " ").replace(/\b([A-Z]{2,}) ?- ([A-Z]{2,})\b/g, "$1$2").replace(/([a-z])- ([a-z])/g, "$1$2");

function judgmentOf(before: string): { judgment: Judgment | null; outcome: string; mixed: boolean } {
  const m = [...before.matchAll(/\b(affirmed|reversed|vacated|dismissed)\b[^.]*\./gi)].pop();
  if (!m) return { judgment: null, outcome: "Undetermined", mixed: false };
  const phrase = m[0].replace(/\.$/, "").trim();
  const word = m[1].toLowerCase();
  const judgment: Judgment = word === "affirmed" ? "affirm" : word === "reversed" ? "reverse" : word === "vacated" ? "vacate_remand" : "other";
  return { judgment, outcome: phrase.charAt(0).toUpperCase() + phrase.slice(1).toLowerCase(), mixed: /\bin part\b/i.test(phrase) };
}

export function readDecision(raw: string): Reading {
  const text = tidy(raw);
  const reasons: string[] = [];
  const start = text.search(STARTS_LINEUP);
  if (start < 0) {
    const perCuriam = /PER CURIAM/i.test(text);
    return { judgment: null, outcome: "Undetermined", votes: {}, author: null, recused: [], clean: false, reasons: [perCuriam ? "per curiam: no author line" : "no opinion line found"] };
  }
  const endAt = text.slice(start).search(/_{5,}|NOTICE: This opinion|\bOpinion of the Court\b|\bCite as:/);
  const lineup = text.slice(start, endAt > 0 ? start + endAt : start + 2000);
  const { judgment, outcome, mixed } = judgmentOf(text.slice(Math.max(0, start - 600), start));
  if (!judgment) reasons.push("no judgment line before the opinion line");
  else if (judgment === "other") reasons.push(`judgment is "${outcome}"`);
  if (mixed) reasons.push(`judgment "${outcome}" is in part`);

  const withJ = new Set<string>(), against = new Set<string>(), recused = new Set<string>();
  let author: string | null = null;
  for (const sentence of lineup.split(NEXT_SENTENCE)) {
    const verb = sentence.search(/\b(delivered|announced|filed|took no part)\b/);
    if (verb < 0) continue;
    const subjects = names(sentence.slice(0, verb));
    const whichAt = sentence.search(/\bin which\b/);
    const joiners = whichAt >= 0 ? names(sentence.slice(whichAt)) : [];
    const body = sentence.slice(verb);
    if (/^took no part/.test(body)) { subjects.forEach((s) => recused.add(s)); continue; }
    if (/^announced the judgment/.test(body)) { reasons.push("plurality: the judgment was announced without a majority opinion"); continue; }
    if (/^delivered the opinion for a unanimous Court/.test(body)) {
      author = subjects[0] ?? null;
      SLUGS.forEach((s) => withJ.add(s));
      continue;
    }
    if (/^delivered/.test(body)) {
      author = subjects[0] ?? null;
      [...subjects, ...joiners].forEach((s) => withJ.add(s));
      continue;
    }
    const kind = body.replace(/,? in which.*$/, "");
    const dissent = /dissent/i.test(kind);
    const concur = /concur/i.test(kind);
    if (dissent && concur) {
      reasons.push(`${subjects.join(" and ")}: ${kind.replace(/^filed (?:an? )?/, "")} (in part)`);
      continue;
    }
    if (dissent) [...subjects, ...joiners].forEach((s) => against.add(s));
    else if (concur) [...subjects, ...joiners].forEach((s) => withJ.add(s));
  }

  for (const s of recused) { withJ.delete(s); against.delete(s); }
  for (const s of against) if (withJ.has(s)) reasons.push(`${s} appears both with and against the judgment`);
  const unaccounted = SLUGS.filter((s) => !recused.has(s) && !withJ.has(s) && !against.has(s));
  if (unaccounted.length) reasons.push(`${unaccounted.join(", ")} not accounted for`);

  const votes: Record<string, CastVote> = {};
  if (judgment && judgment !== "other") {
    const opposite: CastVote = judgment === "affirm" ? "reverse" : "affirm";
    for (const s of withJ) if (!against.has(s)) votes[s] = judgment;
    for (const s of against) if (!withJ.has(s)) votes[s] = opposite;
  }
  return { judgment, outcome, votes, author, recused: [...recused], clean: reasons.length === 0, reasons };
}
```

Note on the Glossip case: Barrett joins the majority opinion "as to Part II" (added to `withJ`) and files "concurring in part and dissenting in part" (a reason); she also joins Thomas's dissent in part (added to `against`), which adds "appears both with and against". Both reasons are expected; the test checks only that one mentions "in part".

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx tsx --test lib/decisions.test.ts`
Expected: all pass. If a clean case fails, print `r.reasons` and fix the parser, not the fixture (the fixtures are verbatim syllabus text).
Run: `npm test` → all pass.

- [ ] **Step 5: Check against every cached OT2024–OT2025 slip opinion**

Create `web/read-all.mts` (temporary, deleted after) with:

```ts
import { listTerm } from "./scripts/ingest/sources/supremecourt";
import { getPdf } from "./scripts/ingest/http";
import { opinionPages } from "./scripts/ingest/pdf-text";
import { readDecision } from "./lib/decisions";
let clean = 0, held = 0;
for (const term of [2024, 2025]) for (const o of await listTerm(term)) {
  const b = await getPdf(o.url, `supremecourt/syl-${o.url.split("/").pop()}`);
  if (!b) continue;
  const r = readDecision((await opinionPages(b)).slice(0, 12).join("\n"));
  if (r.clean) clean++; else { held++; console.log(`held ${o.docket} ${o.caseName}: ${r.reasons.join("; ")}`); }
}
console.log(`clean ${clean}, held ${held}`);
```

Run: `cd web && npx tsx read-all.mts | tail -40 && rm read-all.mts`
Expected: most argued cases clean; held ones are per curiams, partial dissents, pluralities, applications. Spot-check three clean ones by hand against the syllabus (judgment, author, dissenters). A clean reading that is wrong is a parser bug: add that syllabus as a test in Step 1 and fix before committing.

- [ ] **Step 6: Commit**

```bash
git add web/lib/decisions.ts web/lib/decisions.test.ts
git commit -m "Read the judgment, votes, author and recusals from a decision's syllabus"
```

---

### Task 4: Scoring rules

**Files:**
- Create: `lib/scoring.ts`, `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `sideOf`, `tallyVotes`, `type Vote`, `type Seniority` from `lib/clerk-rules.ts`; `type Judgment` from `lib/decisions.ts` (`"affirm" | "reverse" | "vacate_remand" | "other"`).
- Produces:
  - `type ForecastForScoring = { votes: Record<string, Vote>; confidence: Record<string, number>; author: string | null }`
  - `type OutcomeForScoring = { judgment: Judgment; votes: Record<string, Vote>; author: string | null }`
  - `type JusticeScore = { slug: string; predicted: Vote | null; actual: Vote; confidence: number | null; voteRight: boolean; majorityRight: boolean }`
  - `type ForecastScore = { outcomeCorrect: boolean; votesCorrect: number; votesTotal: number; majorityCorrect: number; authorCorrect: boolean | null; justices: JusticeScore[] }`
  - `scoreForecast(f: ForecastForScoring, o: OutcomeForScoring, seniority: Seniority): ForecastScore`
  - `predictedJudgmentSide(votes: Record<string, Vote>, seniority: Seniority): "affirm" | "set_aside"`
  - `lockedBeforeDecision(lockedAtIso: string, decidedAt: string): boolean`
  - `countingForecasts<T extends { caseId: string; origin: string; lockedAt: string }>(fs: T[]): T[]`
  - `type CalibrationBand = { lo: number; hi: number; n: number; stated: number; observed: number }`; `calibration(votes: { confidence: number; voteRight: boolean }[]): CalibrationBand[]`; `CALIBRATION_MIN_VOTES = 20`

- [ ] **Step 1: Write the failing tests**

Create `lib/scoring.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Seniority, Vote } from "./clerk-rules";
import { calibration, countingForecasts, lockedBeforeDecision, scoreForecast } from "./scoring";

const S: Seniority = { roberts: 1, thomas: 2, alito: 3, sotomayor: 4, kagan: 5, gorsuch: 6, kavanaugh: 7, barrett: 8, jackson: 9 };
const ALL = Object.keys(S);
const votes = (rev: string[], aff: string[], v: Vote = "reverse") =>
  Object.fromEntries([...rev.map((s) => [s, v]), ...aff.map((s) => [s, "affirm"])]) as Record<string, Vote>;
const conf = (slugs: string[], c = 0.8) => Object.fromEntries(slugs.map((s) => [s, c]));

// FCC v. Consumers' Research: 6–3 to reverse, Kagan writing; Gorsuch, Thomas, Alito dissenting.
const FCC_REV = ["roberts", "sotomayor", "kagan", "kavanaugh", "barrett", "jackson"];
const FCC_AFF = ["thomas", "alito", "gorsuch"];

describe("scoreForecast", () => {
  it("scores an exact forecast as all right", () => {
    const s = scoreForecast(
      { votes: votes(FCC_REV, FCC_AFF), confidence: conf(ALL), author: "kagan" },
      { judgment: "reverse", votes: votes(FCC_REV, FCC_AFF), author: "kagan" }, S);
    assert.deepEqual([s.outcomeCorrect, s.votesCorrect, s.votesTotal, s.majorityCorrect, s.authorCorrect], [true, 9, 9, 9, true]);
  });
  it("counts reverse and vacate as the same side", () => {
    const s = scoreForecast(
      { votes: votes(FCC_REV, FCC_AFF, "reverse"), confidence: conf(ALL), author: "kagan" },
      { judgment: "vacate_remand", votes: votes(FCC_REV, FCC_AFF, "vacate_remand"), author: "roberts" }, S);
    assert.equal(s.outcomeCorrect, true);
    assert.equal(s.votesCorrect, 9);
    assert.equal(s.authorCorrect, false);
  });
  it("separates votes from majority membership when the outcome is wrong", () => {
    // Forecast 5–4 to reverse with Barrett reversing; Court 5–4 to affirm with Barrett affirming.
    const f = votes(["roberts", "thomas", "alito", "gorsuch", "barrett"], ["sotomayor", "kagan", "kavanaugh", "jackson"]);
    const o = votes(["roberts", "thomas", "alito", "gorsuch"], ["sotomayor", "kagan", "kavanaugh", "jackson", "barrett"]);
    const s = scoreForecast({ votes: f, confidence: conf(ALL), author: null }, { judgment: "affirm", votes: o, author: "kagan" }, S);
    assert.equal(s.outcomeCorrect, false);
    assert.equal(s.votesCorrect, 8, "only Barrett's vote missed");
    assert.equal(s.majorityCorrect, 1, "only Barrett is placed right relative to the judgment");
    assert.equal(s.authorCorrect, null, "no predicted author");
  });
  it("treats a predicted 4–4 as affirm", () => {
    const f = votes(["roberts", "thomas", "kavanaugh", "barrett"], ["sotomayor", "kagan", "gorsuch", "jackson"]);
    const o = votes(["roberts", "thomas", "kavanaugh"], ["sotomayor", "kagan", "gorsuch", "jackson", "barrett"]);
    const s = scoreForecast({ votes: f, confidence: conf(Object.keys(f)), author: null }, { judgment: "affirm", votes: o, author: "kagan" }, S);
    assert.equal(s.outcomeCorrect, true);
    assert.equal(s.votesTotal, 8);
  });
  it("counts a justice we treated as recused but who sat as wrong; drops one who really recused", () => {
    const f = votes(FCC_REV.filter((x) => x !== "kagan"), FCC_AFF.filter((x) => x !== "alito"));
    const o = votes(FCC_REV, FCC_AFF.filter((x) => x !== "gorsuch"));
    const s = scoreForecast({ votes: f, confidence: conf(Object.keys(f)), author: null }, { judgment: "reverse", votes: o, author: "kagan" }, S);
    assert.equal(s.votesTotal, 8, "Gorsuch really recused, so 8 sat");
    assert.equal(s.justices.find((j) => j.slug === "kagan")?.voteRight, false);
    assert.equal(s.justices.find((j) => j.slug === "kagan")?.predicted, null);
    assert.equal(s.votesCorrect, 7);
  });
});

describe("lockedBeforeDecision", () => {
  it("compares Eastern calendar dates", () => {
    assert.equal(lockedBeforeDecision("2026-11-03T03:30:00Z", "2026-11-03"), true, "Nov 2, 10:30 PM ET");
    assert.equal(lockedBeforeDecision("2026-11-03T15:00:00Z", "2026-11-03"), false, "decision day");
    assert.equal(lockedBeforeDecision("2026-11-04T01:00:00Z", "2026-11-03"), false);
  });
});

describe("countingForecasts", () => {
  it("keeps one forecast per case: the docket one, else the earliest", () => {
    const fs = [
      { id: "a", caseId: "c1", origin: "invite", lockedAt: "2026-10-10T23:49:00Z" },
      { id: "b", caseId: "c1", origin: "docket", lockedAt: "2026-10-11T02:00:00Z" },
      { id: "c", caseId: "c2", origin: "invite", lockedAt: "2026-10-12T02:00:00Z" },
      { id: "d", caseId: "c2", origin: "owner", lockedAt: "2026-10-11T02:00:00Z" },
    ];
    assert.deepEqual(countingForecasts(fs).map((f) => f.id).sort(), ["b", "d"]);
  });
});

describe("calibration", () => {
  it("bands stated confidence and reports the hit rate", () => {
    const vs = [
      { confidence: 0.55, voteRight: true }, { confidence: 0.58, voteRight: false },
      { confidence: 0.92, voteRight: true }, { confidence: 1, voteRight: true }, { confidence: 0.45, voteRight: false },
    ];
    const b = calibration(vs);
    assert.deepEqual(b.map((x) => [x.lo, x.n, x.observed]), [[0.5, 3, 1 / 3], [0.9, 2, 1]]);
    assert.ok(Math.abs(b[0].stated - (0.55 + 0.58 + 0.45) / 3) < 1e-9);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx tsx --test lib/scoring.test.ts`
Expected: FAIL — cannot find module `./scoring`.

- [ ] **Step 3: Implement `lib/scoring.ts`**

```ts
// Scoring a locked forecast against the Court's decision (spec §3). Pure functions; lib/outcomes.ts stores
// the results and lib/scorecard.ts reuses them for the page.
import { sideOf, tallyVotes, type Seniority, type Vote } from "./clerk-rules";
import type { Judgment } from "./decisions";

export type ForecastForScoring = { votes: Record<string, Vote>; confidence: Record<string, number>; author: string | null };
export type OutcomeForScoring = { judgment: Judgment; votes: Record<string, Vote>; author: string | null };
export type JusticeScore = { slug: string; predicted: Vote | null; actual: Vote; confidence: number | null; voteRight: boolean; majorityRight: boolean };
export type ForecastScore = {
  outcomeCorrect: boolean; votesCorrect: number; votesTotal: number; majorityCorrect: number; authorCorrect: boolean | null;
  justices: JusticeScore[];
};

type Side = "affirm" | "set_aside" | "other";
const voteSide = (v: Vote): Side => sideOf(v) ?? "other";
const judgmentSide = (j: Judgment): Side => (j === "affirm" ? "affirm" : j === "other" ? "other" : "set_aside");

// The side a forecast's votes come down on; an even split leaves the judgment below in place.
export function predictedJudgmentSide(votes: Record<string, Vote>, seniority: Seniority): "affirm" | "set_aside" {
  const t = tallyVotes(Object.entries(votes).map(([justice, vote]) => ({ justice, vote, role: "majority" as const, confidence: 0.5 })), seniority);
  return t.tie || !t.winningSide ? "affirm" : t.winningSide;
}

export function scoreForecast(f: ForecastForScoring, o: OutcomeForScoring, seniority: Seniority): ForecastScore {
  const predSide = predictedJudgmentSide(f.votes, seniority);
  const actSide = judgmentSide(o.judgment);
  const justices: JusticeScore[] = Object.entries(o.votes)
    .sort(([a], [b]) => (seniority[a] ?? 99) - (seniority[b] ?? 99))
    .map(([slug, actual]) => {
      const predicted = f.votes[slug] ?? null;
      if (!predicted) return { slug, predicted: null, actual, confidence: null, voteRight: false, majorityRight: false };
      return {
        slug, predicted, actual, confidence: f.confidence[slug] ?? null,
        voteRight: voteSide(predicted) === voteSide(actual),
        majorityRight: (voteSide(predicted) === predSide) === (voteSide(actual) === actSide),
      };
    });
  return {
    outcomeCorrect: predSide === actSide,
    votesCorrect: justices.filter((j) => j.voteRight).length,
    votesTotal: justices.length,
    majorityCorrect: justices.filter((j) => j.majorityRight).length,
    authorCorrect: f.author && o.author ? f.author === o.author : null,
    justices,
  };
}

const etDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// Locked on an Eastern calendar day before the decision day.
export const lockedBeforeDecision = (lockedAtIso: string, decidedAt: string) => etDate(lockedAtIso) < decidedAt;

// One forecast per case for the term totals: the docket forecast if there is one, else the earliest locked.
export function countingForecasts<T extends { caseId: string; origin: string; lockedAt: string }>(fs: T[]): T[] {
  const best = new Map<string, T>();
  for (const f of fs) {
    const cur = best.get(f.caseId);
    const better = !cur
      || (f.origin === "docket" && cur.origin !== "docket")
      || (f.origin === cur.origin && f.lockedAt < cur.lockedAt)
      || (cur.origin !== "docket" && f.origin !== "docket" && f.lockedAt < cur.lockedAt);
    if (better) best.set(f.caseId, f);
  }
  return [...best.values()];
}

export const CALIBRATION_MIN_VOTES = 20;
export type CalibrationBand = { lo: number; hi: number; n: number; stated: number; observed: number };
const BANDS: [number, number][] = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1]];

export function calibration(votes: { confidence: number; voteRight: boolean }[]): CalibrationBand[] {
  return BANDS.map(([lo, hi], i) => {
    const b = votes.filter((v) => (i === 0 ? v.confidence < hi : i === BANDS.length - 1 ? v.confidence >= lo : v.confidence >= lo && v.confidence < hi));
    return {
      lo, hi, n: b.length,
      stated: b.reduce((s, v) => s + v.confidence, 0) / (b.length || 1),
      observed: b.filter((v) => v.voteRight).length / (b.length || 1),
    };
  }).filter((b) => b.n > 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx tsx --test lib/scoring.test.ts` → all pass; `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add web/lib/scoring.ts web/lib/scoring.test.ts
git commit -m "Scoring rules: sides, votes, majority membership, author, calibration"
```

---

### Task 5: Storing outcomes, the daily Inngest job and the outcomes script

**Files:**
- Create: `lib/fetch-court.ts`, `lib/outcomes.ts`, `inngest/readDecisions.ts`, `inngest/functions.ts`, `scripts/admin/prod-inngest.ts`, `scripts/admin/outcomes.ts`
- Modify: `app/api/inngest/route.ts`, `package.json`

**Interfaces:**
- Consumes: `parseSlipListing`, `normalizeDocket`, `currentTerm`, `COURT`, `COURT_HEADERS` (Task 2); `readDecision`, `type Reading`, `type Judgment` (Task 3); `scoreForecast`, `lockedBeforeDecision` (Task 4); `opinionPages` from `scripts/ingest/pdf-text.ts`; `serviceClient()`; `justices` from `lib/court.ts`.
- Produces:
  - `lib/fetch-court.ts`: `courtText(url): Promise<string>`, `courtPdf(url): Promise<Uint8Array>`, `syllabusText(pdfUrl): Promise<string>`
  - `lib/outcomes.ts`: `awaitingOutcome(db, term: number): Promise<{ caseId: string; docket: string }[]>`, `saveOutcome(db, caseId, reading: Reading, decidedAt: string, sourceUrl: string | null): Promise<void>`, `scoreCase(db, caseId): Promise<number>` (rows written), `SCORED_TERM = "October Term 2026"`
  - Inngest: function `read-decisions`; event `decisions/read.requested` `{ term?: number; dryRun?: boolean }`
  - `scripts/admin/prod-inngest.ts`: `prodInngest(): Inngest`
  - `npm run outcomes -- review | confirm <docket> | set <docket> … | run [--term N] [--dry-run]`

- [ ] **Step 1: `lib/fetch-court.ts`**

```ts
// Fetching from the Court's site, for the decision job and the owner scripts (no disk cache: runs on Vercel too).
import { COURT_HEADERS } from "./court-site";
import { opinionPages } from "../scripts/ingest/pdf-text";

export async function courtText(url: string): Promise<string> {
  const res = await fetch(url, { headers: COURT_HEADERS });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

export async function courtPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: COURT_HEADERS });
  if (!res.ok || !/pdf/i.test(res.headers.get("content-type") ?? "")) throw new Error(`${res.status} fetching PDF ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// The opening pages of a slip opinion (syllabus first), footnotes dropped, as one string. The line-up ends
// the syllabus within the first few pages; the opinion body's "JUSTICE X delivered…" form doesn't match
// readDecision's "X, J., delivered…", so the extra pages do no harm.
export async function syllabusText(pdfUrl: string): Promise<string> {
  return (await opinionPages(await courtPdf(pdfUrl))).slice(0, 12).join("\n");
}
```

- [ ] **Step 2: `lib/outcomes.ts`**

```ts
// Outcomes and scores in the database. The reading and scoring logic is pure (lib/decisions.ts, lib/scoring.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vote } from "./clerk-rules";
import { justices } from "./court";
import { normalizeDocket } from "./court-site";
import type { Judgment, Reading } from "./decisions";
import { lockedBeforeDecision, scoreForecast } from "./scoring";

export const SCORED_TERM = "October Term 2026";
const SENIORITY = Object.fromEntries(justices.map((j) => [j.slug, j.seniority]));
const ok = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

// Cases in the term with a locked forecast and no outcome yet.
export async function awaitingOutcome(db: SupabaseClient, term: number) {
  const cases = ok(await db.from("cases").select("id, docket, predictions!inner(status), outcomes(case_id)")
    .eq("term", `October Term ${term}`).eq("predictions.status", "locked")) as { id: string; docket: string | null; outcomes: unknown }[];
  return cases
    .filter((c) => c.docket && !(Array.isArray(c.outcomes) ? c.outcomes.length : c.outcomes))
    .map((c) => ({ caseId: c.id, docket: normalizeDocket(c.docket!) }))
    .filter((c) => c.docket);
}

export async function saveOutcome(db: SupabaseClient, caseId: string, r: Reading, decidedAt: string, sourceUrl: string | null) {
  ok(await db.from("outcomes").upsert({
    case_id: caseId, decided_at: decidedAt, outcome: r.outcome, votes: r.votes, author: r.author,
    status: r.clean ? "scored" : "needs_review", source_url: sourceUrl, notes: r.reasons.join("; ") || null,
  }));
}

const JUDGMENT_OF = (outcome: string): Judgment =>
  /^affirmed/i.test(outcome) ? "affirm" : /^reversed/i.test(outcome) ? "reverse" : /^vacated/i.test(outcome) ? "vacate_remand" : "other";

// Scores every eligible forecast on the case; upserts, so a corrected outcome rescores. Returns rows written.
export async function scoreCase(db: SupabaseClient, caseId: string): Promise<number> {
  const outcome = ok(await db.from("outcomes").select("decided_at, outcome, votes, author, status").eq("case_id", caseId).single()) as
    { decided_at: string; outcome: string; votes: Record<string, Vote>; author: string | null; status: string };
  if (outcome.status !== "scored") return 0;
  const c = ok(await db.from("cases").select("term, decided_before_cutoff").eq("id", caseId).single()) as { term: string; decided_before_cutoff: boolean };
  if (c.term !== SCORED_TERM || c.decided_before_cutoff) return 0;
  const preds = (ok(await db.from("predictions").select("id, locked_at, author_pred").eq("case_id", caseId).eq("status", "locked")) as
    { id: string; locked_at: string; author_pred: string | null }[]).filter((p) => lockedBeforeDecision(p.locked_at, outcome.decided_at));
  let written = 0;
  for (const p of preds) {
    const rows = ok(await db.from("justice_votes").select("justice, vote, confidence").eq("prediction_id", p.id)) as { justice: string; vote: Vote; confidence: number }[];
    const s = scoreForecast(
      { votes: Object.fromEntries(rows.map((r) => [r.justice, r.vote])), confidence: Object.fromEntries(rows.map((r) => [r.justice, Number(r.confidence)])), author: p.author_pred },
      { judgment: JUDGMENT_OF(outcome.outcome), votes: outcome.votes, author: outcome.author }, SENIORITY);
    ok(await db.from("scores").upsert({
      prediction_id: p.id, outcome_correct: s.outcomeCorrect, votes_correct: s.votesCorrect, votes_total: s.votesTotal,
      majority_correct: s.majorityCorrect, author_correct: s.authorCorrect,
    }));
    written++;
  }
  return written;
}
```

- [ ] **Step 3: The Inngest function and registration**

Create `inngest/readDecisions.ts`:

```ts
// Reads the Court's new decisions once a day (6 PM Eastern) and scores the matching forecasts (spec §2).
// Also runs on demand: event "decisions/read.requested" { term?, dryRun? }.
import { inngest } from "./client";
import { COURT, currentTerm, normalizeDocket, parseSlipListing } from "@/lib/court-site";
import { readDecision } from "@/lib/decisions";
import { courtText, syllabusText } from "@/lib/fetch-court";
import { awaitingOutcome, saveOutcome, scoreCase } from "@/lib/outcomes";
import { serviceClient } from "@/lib/supabase";

export const readDecisions = inngest.createFunction(
  {
    id: "read-decisions",
    triggers: [{ cron: "TZ=America/New_York 0 18 * * *" }, { event: "decisions/read.requested" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as { term?: number; dryRun?: boolean };
    const term = Number(data.term ?? currentTerm());
    const dryRun = !!data.dryRun;
    const yy = String(term % 100).padStart(2, "0");

    const listed = await step.run("list", async () => parseSlipListing(await courtText(`${COURT}/opinions/slipopinion/${yy}`), term));
    const waiting = await step.run("match", () => awaitingOutcome(serviceClient(), term));
    const byDocket = new Map(waiting.map((w) => [w.docket, w.caseId]));
    const matches = listed.filter((o) => byDocket.has(normalizeDocket(o.docket)));

    const results = [];
    for (const o of matches) {
      const docket = normalizeDocket(o.docket);
      results.push(await step.run(`read-${docket}`, async () => {
        const reading = readDecision(await syllabusText(o.url));
        if (dryRun) return { docket, decided: o.date, reading };
        const db = serviceClient();
        const caseId = byDocket.get(docket)!;
        await saveOutcome(db, caseId, reading, o.date, o.url);
        const scored = reading.clean ? await scoreCase(db, caseId) : 0;
        return { docket, decided: o.date, clean: reading.clean, reasons: reading.reasons, scored };
      }));
    }
    return { term, dryRun, listed: listed.length, waiting: waiting.length, results };
  },
);
```

Create `inngest/functions.ts`:

```ts
// Every Inngest function the app serves.
import { functions as predict } from "./predictCase";
import { readDecisions } from "./readDecisions";

export const functions = [...predict, readDecisions];
```

In `app/api/inngest/route.ts`, change `import { functions } from "@/inngest/predictCase";` to `import { functions } from "@/inngest/functions";`.

- [ ] **Step 4: Production Inngest client for scripts**

Create `scripts/admin/prod-inngest.ts`:

```ts
// An Inngest client that always sends to Inngest Cloud, for owner scripts that start production work.
// The app's own client (inngest/client.ts) follows INNGEST_DEV and stays pointed at the local dev server.
import { Inngest } from "inngest";

export function prodInngest() {
  const eventKey = process.env.INNGEST_PROD_EVENT_KEY;
  if (!eventKey) {
    throw new Error("INNGEST_PROD_EVENT_KEY is not set. Add it to web/.env.local (Inngest dashboard → your app's production environment → Event keys) so this runs on production, not the local dev server.");
  }
  return new Inngest({ id: "bench-forecast", eventKey, isDev: false });
}
```

- [ ] **Step 5: The outcomes script**

Create `scripts/admin/outcomes.ts`:

```ts
// The decision review queue and manual runs of the decision job (spec §2).
//   npm run outcomes -- review
//   npm run outcomes -- confirm 25-170
//   npm run outcomes -- set 25-170 --judgment reversed --majority roberts,thomas,… --dissent kagan,… [--author roberts] [--recused alito]
//   npm run outcomes -- run [--term 24] [--dry-run]
import type { Vote } from "../../lib/clerk-rules";
import { justices } from "../../lib/court";
import { currentTerm, normalizeDocket } from "../../lib/court-site";
import { scoreCase } from "../../lib/outcomes";
import { serviceClient } from "../../lib/supabase";
import { prodInngest } from "./prod-inngest";

const db = serviceClient();
const SLUGS = new Set(justices.map((j) => j.slug));
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

async function caseFor(docket: string) {
  const d = normalizeDocket(docket);
  if (!d) throw new Error(`"${docket}" is not a docket number.`);
  const { data, error } = await db.from("cases").select("id, title").eq("docket", d).eq("term", "October Term 2026");
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error(`No October Term 2026 case with docket ${d}.`);
  return data;
}

async function main() {
  const [cmd, docketArg] = process.argv.slice(2);
  switch (cmd) {
    case "review": {
      const { data, error } = await db.from("outcomes").select("decided_at, outcome, votes, author, notes, source_url, cases(docket, title)").eq("status", "needs_review");
      if (error) throw new Error(error.message);
      if (!data.length) return console.log("Nothing waiting for review.");
      for (const o of data as unknown as { decided_at: string; outcome: string; votes: Record<string, Vote>; author: string | null; notes: string | null; source_url: string | null; cases: { docket: string; title: string } }[]) {
        console.log(`\n${o.cases.docket}  ${o.cases.title}  (decided ${o.decided_at})`);
        console.log(`  best guess: ${o.outcome}; author ${o.author ?? "none"}`);
        console.log(`  votes: ${Object.entries(o.votes).map(([s, v]) => `${s}:${v}`).join(", ") || "none read"}`);
        console.log(`  why held: ${o.notes ?? "—"}`);
        console.log(`  opinion: ${o.source_url ?? "—"}`);
      }
      return;
    }
    case "confirm": {
      for (const c of await caseFor(docketArg)) {
        const { data, error } = await db.from("outcomes").select("votes").eq("case_id", c.id).single();
        if (error) throw new Error(`No outcome stored for ${docketArg} yet.`);
        if (Object.keys(data.votes ?? {}).length < 7) throw new Error("The stored guess is missing votes; use `set` to enter the result.");
        await db.from("outcomes").update({ status: "scored", notes: "confirmed by owner" }).eq("case_id", c.id);
        console.log(`${docketArg}: confirmed; ${await scoreCase(db, c.id)} forecast(s) scored.`);
      }
      return;
    }
    case "set": {
      const judgment = arg("judgment");
      const vote: Vote | undefined = judgment === "affirmed" ? "affirm" : judgment === "reversed" ? "reverse" : judgment === "vacated" ? "vacate_remand" : undefined;
      if (!vote) throw new Error("--judgment must be affirmed, reversed or vacated.");
      const against: Vote = vote === "affirm" ? "reverse" : "affirm";
      const majority = list(arg("majority")), dissent = list(arg("dissent")), recused = list(arg("recused"));
      const author = arg("author") ?? null;
      for (const s of [...majority, ...dissent, ...recused, ...(author ? [author] : [])]) if (!SLUGS.has(s)) throw new Error(`Unknown justice "${s}".`);
      const named = [...majority, ...dissent, ...recused];
      if (new Set(named).size !== named.length || named.length !== SLUGS.size) throw new Error("Name every justice exactly once across --majority, --dissent and --recused.");
      if (author && !majority.includes(author)) throw new Error("The author must be in the majority.");
      const votes = Object.fromEntries([...majority.map((s) => [s, vote]), ...dissent.map((s) => [s, against])]);
      const outcome = { affirm: "Affirmed", reverse: "Reversed", vacate_remand: "Vacated and remanded" }[vote as "affirm" | "reverse" | "vacate_remand"];
      for (const c of await caseFor(docketArg)) {
        const { data: existing } = await db.from("outcomes").select("decided_at, source_url").eq("case_id", c.id).maybeSingle();
        const decided = arg("decided") ?? existing?.decided_at;
        if (!decided) throw new Error("No stored decision date; pass --decided YYYY-MM-DD.");
        const { error } = await db.from("outcomes").upsert({ case_id: c.id, decided_at: decided, outcome, votes, author, status: "scored", source_url: existing?.source_url ?? null, notes: "entered by owner" });
        if (error) throw new Error(error.message);
        console.log(`${docketArg}: ${outcome}, ${majority.length}–${dissent.length}; ${await scoreCase(db, c.id)} forecast(s) scored.`);
      }
      return;
    }
    case "run": {
      const term = Number(arg("term") ?? currentTerm());
      const dryRun = process.argv.includes("--dry-run");
      await prodInngest().send({ name: "decisions/read.requested", data: { term, dryRun } });
      console.log(`Sent: read decisions for OT${term}${dryRun ? " (dry run, nothing written)" : ""}. Watch it in the Inngest dashboard (read-decisions).`);
      return;
    }
    default:
      throw new Error("Usage: npm run outcomes -- review | confirm <docket> | set <docket> --judgment … --majority … --dissent … [--author …] [--recused …] [--decided YYYY-MM-DD] | run [--term N] [--dry-run]");
  }
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
```

In `package.json` `scripts`, add:

```json
    "outcomes": "tsx --env-file=.env.local scripts/admin/outcomes.ts",
```

- [ ] **Step 6: Verify against the database and a past term (no model spend)**

Run: `cd web && npx tsc --noEmit && npm run -s lint` → clean.
Upsert check (Review Focus 4) — with a throwaway OT2026 case and locked prediction:
```bash
npx tsx --env-file=.env.local scripts/db/sql.ts -c "insert into cases (id, title, docket, term, input_mode, description) values ('00000000-0000-0000-0000-0000000000a7','Outcome check v. Test','99-9001','October Term 2026','description','outcome-check'); insert into predictions (id, case_id, phase, status, locked_at, outcome, majority_count, minority_count, author_pred, origin) values ('00000000-0000-0000-0000-0000000000b7','00000000-0000-0000-0000-0000000000a7','after_argument','locked','2026-10-11T02:00:00Z','Reversed',6,3,'kagan','owner'); insert into justice_votes (prediction_id, justice, vote, confidence, role, brief_reason, detailed_reason, citations, flagged) select '00000000-0000-0000-0000-0000000000b7', slug, case when slug in ('thomas','alito','gorsuch') then 'affirm' else 'reverse' end, 0.8, case when slug in ('thomas','alito','gorsuch') then 'dissent' else 'majority' end, 'x', 'x', '[]', false from justices where active"
npm run -s outcomes -- set 99-9001 --judgment reversed --majority roberts,sotomayor,kagan,kavanaugh,barrett,jackson --dissent thomas,alito,gorsuch --author kagan --decided 2026-11-04
npm run -s outcomes -- set 99-9001 --judgment affirmed --majority thomas,alito,gorsuch,roberts,kavanaugh --dissent sotomayor,kagan,barrett,jackson --author thomas --decided 2026-11-04
npx tsx --env-file=.env.local scripts/db/sql.ts -c "select count(*) rows, bool_and(outcome_correct) correct, max(votes_correct) votes from scores where prediction_id = '00000000-0000-0000-0000-0000000000b7'"
npx tsx --env-file=.env.local scripts/db/sql.ts -c "delete from cases where id = '00000000-0000-0000-0000-0000000000a7'"
```
Expected: first `set` → "Reversed, 6–3; 1 forecast(s) scored."; second → "Affirmed, 5–4; 1 forecast(s) scored."; the select shows `rows 1`, `correct false`, `votes 7` (one row, rescored, not duplicated: the forecast's FCC-style 6–3 split gets every vote right except Roberts and Kavanaugh, who flipped).

Dry run on OT2024 through the function handler locally (needs `npm run dev` and `npm run inngest:dev`): open http://localhost:8288, Functions → `read-decisions` → Invoke with `{ "data": { "term": 2024, "dryRun": true } }`. Expected: the run's output lists `waiting` ≥ 1 and a result for `24-354` with `reading.clean = true`, `reading.outcome = "Reversed and remanded"`, `reading.author = "kagan"`, nine votes. Nothing is written (check `select count(*) from outcomes` is unchanged).

- [ ] **Step 7: Commit**

```bash
git add web/lib/fetch-court.ts web/lib/outcomes.ts web/inngest/readDecisions.ts web/inngest/functions.ts web/app/api/inngest/route.ts web/scripts/admin/prod-inngest.ts web/scripts/admin/outcomes.ts web/package.json
git commit -m "Daily decision reader (Inngest), outcome storage and scoring, outcomes review script"
```

---

### Task 6: The docket script and docket runs

**Files:**
- Create: `lib/docket.ts`, `lib/docket.test.ts`, `scripts/admin/docket.ts`
- Modify: `inngest/predictCase.ts`, `scripts/admin/invite.ts`, `package.json`

**Interfaces:**
- Consumes: Task 2 parsers; `courtText`, `courtPdf` (Task 5); `prodInngest` (Task 5); `storedName`, `HOLD_USD` from `lib/filing.ts`; `serviceClient()`.
- Produces:
  - `type DocketCase = { docket: string; title: string; argued: string; consolidatedWith: string[]; transcript: string | null; petitioner: DocketDoc | null; respondent: DocketDoc | null; recused: string[] }`
  - `assembleCase(h: HearingCase, transcripts: Record<string, string>, docketHtml: string, extraRecusals: string[]): DocketCase` (pure)
  - `missing(c: DocketCase): string[]` — reasons a case can't be filed (pure)
  - `caseLimit(maxSpend: number): number` = ⌊maxSpend ÷ HOLD_USD⌋ (pure)
  - Inngest: function `predict-docket-case` on event `case/predict.docket` `{ predictionId }`, `concurrency: [{ limit: 9 }]` (steps), same handler as `predict-case`.
  - `npm run docket -- list | forecast --max-spend N [--cases a,b] [--recuse docket:slug] [--dry-run] [--force]`

- [ ] **Step 1: Write the failing tests**

Create `lib/docket.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assembleCase, caseLimit, missing } from "./docket";
import { parseTranscriptLinks } from "./court-site";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", "court", n), "utf8");
const SUNCOR = { docket: "25-170", title: "Suncor Energy (U.S.A.) Inc. v. County Commissioners of Boulder County", argued: "2026-10-05", consolidatedWith: [] };

describe("assembleCase", () => {
  it("brings together the briefs, the transcript and recusals", () => {
    const c = assembleCase(SUNCOR, parseTranscriptLinks(fx("transcripts-2026.html")), fx("docket-25-170.html"), ["alito"]);
    assert.ok(c.petitioner && c.respondent && c.transcript);
    assert.deepEqual(c.recused, ["alito"]);
    assert.deepEqual(missing(c), []);
  });
  it("names what is missing, so the case is skipped", () => {
    const c = assembleCase({ ...SUNCOR, docket: "25-9999" }, {}, "<html></html>", []);
    assert.deepEqual(missing(c), ["no transcript yet", "petitioners' merits brief not found", "respondents' merits brief not found"]);
  });
  it("rejects an unknown justice in a recusal override", () => {
    assert.throws(() => assembleCase(SUNCOR, {}, "", ["scalia"]), /Unknown justice/);
  });
});

describe("caseLimit", () => {
  it("starts at most max-spend ÷ $2.50 cases", () => {
    assert.equal(caseLimit(30), 12);
    assert.equal(caseLimit(2), 0);
    assert.equal(caseLimit(2.5), 1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx tsx --test lib/docket.test.ts` → FAIL, cannot find module `./docket`.

- [ ] **Step 3: Implement `lib/docket.ts`**

```ts
// Assembling an argued case for a docket forecast from the Court's site (spec §1). Pure; the script fetches.
import { justices } from "./court";
import { parseDocketPage, type DocketDoc, type HearingCase } from "./court-site";
import { HOLD_USD } from "./filing";

export type DocketCase = HearingCase & { transcript: string | null; petitioner: DocketDoc | null; respondent: DocketDoc | null; recused: string[] };

const SLUGS = new Set(justices.map((j) => j.slug));

export function assembleCase(h: HearingCase, transcripts: Record<string, string>, docketHtml: string, extraRecusals: string[]): DocketCase {
  for (const s of extraRecusals) if (!SLUGS.has(s)) throw new Error(`Unknown justice "${s}" in --recuse.`);
  const page = parseDocketPage(docketHtml);
  return { ...h, transcript: transcripts[h.docket] ?? null, petitioner: page.petitioner, respondent: page.respondent, recused: [...new Set([...page.recused, ...extraRecusals])] };
}

export function missing(c: DocketCase): string[] {
  const out: string[] = [];
  if (!c.transcript) out.push("no transcript yet");
  if (!c.petitioner) out.push("petitioners' merits brief not found");
  if (!c.respondent) out.push("respondents' merits brief not found");
  return out;
}

export const caseLimit = (maxSpend: number) => Math.floor(maxSpend / HOLD_USD + 1e-9);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx tsx --test lib/docket.test.ts` → pass.

- [ ] **Step 5: Docket twin of the forecast function**

In `inngest/predictCase.ts`, wrap the existing `createFunction` call in a factory so the same options and handler register twice; the handler body and the `onFailure` body are not edited. The file currently reads:

```ts
export const predictCase = inngest.createFunction(
  {
    id: "predict-case",
    triggers: [{ event: "case/predict.requested" }],
    retries: 2, // per step; agent steps are expensive, so keep this low
    onFailure: async ({ event, error }) => { …unchanged… },
  },
  async ({ event, step }) => { …unchanged… },
);

export const functions = [predictCase];
```

Change it to:

```ts
// The forecast pipeline, registered twice: public and owner runs, and docket batches (scripts/admin/docket.ts).
// Docket runs get their own concurrency limit, counted in steps: about one run's nine-justice fan-out at a
// time, so a batch never slows public filings.
function makePredict(id: string, trigger: string, concurrency?: { limit: number }[]) {
  return inngest.createFunction(
    {
      id,
      triggers: [{ event: trigger }],
      retries: 2, // per step; agent steps are expensive, so keep this low
      ...(concurrency ? { concurrency } : {}),
      onFailure: async ({ event, error }) => { …unchanged… },
    },
    async ({ event, step }) => { …unchanged… },
  );
}

export const predictCase = makePredict("predict-case", "case/predict.requested");
export const predictDocketCase = makePredict("predict-docket-case", "case/predict.docket", [{ limit: 9 }]);

export const functions = [predictCase, predictDocketCase];
```

The factory's parameter is `trigger`, not `event`, so it doesn't shadow the handler's `event`.

Run: `npx tsc --noEmit && npm test` → pass.

- [ ] **Step 6: The docket script**

Create `scripts/admin/docket.ts`:

```ts
// Forecast every argued October Term 2026 case after argument (spec §1). Runs go to production through
// Inngest Cloud (INNGEST_PROD_EVENT_KEY) and count against --max-spend, not the public cap.
//   npm run docket -- list
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

async function hearingCases(): Promise<HearingCase[]> {
  const out: HearingCase[] = [];
  for (const [i, m] of MONTHS.entries()) {
    const year = i < 3 ? TERM : TERM + 1;
    let bytes: Uint8Array;
    try { bytes = await courtPdf(`${COURT}/oral_arguments/hearinglists/HearingList-${m}${year}.pdf`); } catch { break; }
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    out.push(...parseHearingList(String(text)));
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return out.filter((c) => c.argued && c.argued <= today);
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
  await prodInngest().send({ name: "case/predict.docket", data: { predictionId: p.data.id } });
  return p.data.id as string;
}

async function main() {
  const cmd = process.argv[2];
  const done = await alreadyForecast();
  const only = list(arg("cases"));
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
  if (cmd !== "forecast") throw new Error("Usage: npm run docket -- list | forecast --max-spend N [--cases a,b] [--recuse docket:slug] [--dry-run] [--force]");

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
    const id = await file(c);
    console.log(`filed ${c.docket} ${c.title} → https://bench-forecast.vercel.app/runs/${id}`);
    started++;
  }
  console.log(`${dry ? "Would start" : "Started"} ${started} forecast(s), about $${(started * HOLD_USD).toFixed(2)}.`);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
```

In `package.json` `scripts`, add `"docket": "tsx --env-file=.env.local scripts/admin/docket.ts",`.

- [ ] **Step 7: Spend line for docket and owner runs**

In `scripts/admin/invite.ts`, in the `spend` case, after the "Filing is open/paused" line, add:

```ts
      const byOrigin = await db.rpc("spend_today_by_origin");
      if (byOrigin.error) throw new Error(byOrigin.error.message);
      const rows = (byOrigin.data ?? []) as { origin: string; usd: number }[];
      const other = rows.filter((r) => r.origin !== "invite").map((r) => `${r.origin} ${usd(Number(r.usd))}`);
      console.log(`Not counted against the cap today: ${other.length ? other.join(" · ") : "nothing"}`);
```

- [ ] **Step 8: Verify without spending**

Run: `cd web && npx tsc --noEmit && npm run -s lint && npm test` → pass.
Run: `npm run -s docket -- list` → the October cases with argued dates; 25-170 shows "forecast exists"; others "ready" or what is missing.
Run: `INNGEST_PROD_EVENT_KEY=unused npm run -s docket -- forecast --max-spend 5 --dry-run` → "would file …" for at most 2 cases, never 25-170, and "Would start N forecast(s)". Nothing created (`select count(*) from cases` unchanged).
Run: `npm run -s invite -- spend` → includes the "Not counted against the cap today" line.

- [ ] **Step 9: Commit**

```bash
git add web/lib/docket.ts web/lib/docket.test.ts web/scripts/admin/docket.ts web/inngest/predictCase.ts web/scripts/admin/invite.ts web/package.json
git commit -m "Docket script: forecast argued OT2026 cases after argument under their own spend limit"
```

---

### Task 7: Scorecard data

**Files:**
- Create: `lib/scorecard.ts`, `lib/scorecard.test.ts`, `lib/scorecard-data.ts`

**Interfaces:**
- Consumes: `scoreForecast`, `countingForecasts`, `lockedBeforeDecision`, `calibration` (Task 4); `justices`, `benchOrder` from `lib/court.ts`; `serviceClient()`.
- Produces (`lib/scorecard.ts`, pure, also used by the sample season):
  - `type Disposition = "Affirm" | "Reverse" | "Vacate" | "Other"`
  - `type ScoredVote = { slug: string; confidence: number; voteRight: boolean; majorityRight: boolean }`
  - `type ScoredCase = { id: string | null; docket: string; title: string; phase: "Before argument" | "After argument"; locked: string; decided: string; predicted: { disposition: Disposition; tally: [number, number]; author: string | null; votes: Record<string, { side: Disposition; confidence: number }> }; actual: { disposition: Disposition; tally: [number, number]; author: string | null }; outcomeRight: boolean; authorRight: boolean | null; votes: ScoredVote[] }`
  - `dispositionOf(text: string): Disposition`
  - `buildScoredCase(input: ScoredInput): ScoredCase` with `ScoredInput = { id: string; docket: string; title: string; phase: string; lockedAt: string; predictedOutcome: string; tally: [number, number]; author: string | null; votes: { justice: string; vote: string; confidence: number }[]; decidedAt: string; outcome: string; actualVotes: Record<string, string>; actualAuthor: string | null }`
  - `seasonRecord(cases: ScoredCase[]): { n: number; outcomeRight: number; votes: number; voteRight: number; majorityRight: number; authorN: number; authorRight: number }`
  - `perJustice(cases: ScoredCase[]): Record<string, { right: number; n: number }>`
  - `byPhase(cases: ScoredCase[]): { phase: "Before argument" | "After argument"; n: number; outcomeRight: number; votes: number; voteRight: number }[]`
- Produces (`lib/scorecard-data.ts`, server): `loadScorecard(): Promise<{ counted: ScoredCase[]; all: ScoredCase[]; waiting: WaitingRow[] }>` with `WaitingRow = { id: string; docket: string | null; title: string; phase: string; lockedAt: string | null; outcome: string | null; tally: [number, number]; review: boolean }`.

- [ ] **Step 1: Write the failing tests**

Create `lib/scorecard.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildScoredCase, byPhase, dispositionOf, perJustice, seasonRecord, type ScoredInput } from "./scorecard";

const REV = ["roberts", "sotomayor", "kagan", "kavanaugh", "barrett", "jackson"];
const AFF = ["thomas", "alito", "gorsuch"];
const base: ScoredInput = {
  id: "p1", docket: "24-354", title: "FCC v. Consumers' Research", phase: "after_argument",
  lockedAt: "2026-10-10T21:21:00Z", predictedOutcome: "Reversed", tally: [6, 3], author: "kagan",
  votes: [...REV.map((j) => ({ justice: j, vote: "reverse", confidence: 0.8 })), ...AFF.map((j) => ({ justice: j, vote: "affirm", confidence: 0.7 }))],
  decidedAt: "2026-11-04", outcome: "Reversed and remanded",
  actualVotes: Object.fromEntries([...REV.map((j) => [j, "reverse"]), ...AFF.map((j) => [j, "affirm"])]), actualAuthor: "kagan",
};

describe("dispositionOf", () => {
  it("reads the judgment wording", () => {
    assert.equal(dispositionOf("Reversed and remanded"), "Reverse");
    assert.equal(dispositionOf("Affirmed by an equally divided Court"), "Affirm");
    assert.equal(dispositionOf("Vacated and remanded"), "Vacate");
    assert.equal(dispositionOf("Dismissed as improvidently granted"), "Other");
  });
});

describe("buildScoredCase", () => {
  it("shapes a scored forecast for the page", () => {
    const c = buildScoredCase(base);
    assert.equal(c.phase, "After argument");
    assert.deepEqual([c.predicted.disposition, c.predicted.tally, c.actual.disposition, c.actual.tally], ["Reverse", [6, 3], "Reverse", [6, 3]]);
    assert.equal(c.outcomeRight, true);
    assert.equal(c.authorRight, true);
    assert.equal(c.votes.length, 9);
    assert.equal(c.locked, "Oct 10");
    assert.equal(c.decided, "Nov 4");
    assert.equal(c.predicted.votes.thomas.side, "Affirm");
  });
});

describe("aggregations", () => {
  const right = buildScoredCase(base);
  const wrong = buildScoredCase({ ...base, id: "p2", docket: "25-1", phase: "before_argument", outcome: "Affirmed", actualVotes: Object.fromEntries([...REV.slice(0, 2).map((j) => [j, "reverse"]), ...[...REV.slice(2), ...AFF].map((j) => [j, "affirm"])]), actualAuthor: null });
  it("totals the season", () => {
    const r = seasonRecord([right, wrong]);
    assert.deepEqual(r, { n: 2, outcomeRight: 1, votes: 18, voteRight: 9 + 5, majorityRight: 9 + 4, authorN: 1, authorRight: 1 });
  });
  it("counts each justice's votes", () => {
    assert.deepEqual(perJustice([right, wrong]).kagan, { right: 1, n: 2 });
    assert.deepEqual(perJustice([right, wrong]).thomas, { right: 2, n: 2 });
  });
  it("splits by phase", () => {
    assert.deepEqual(byPhase([right, wrong]).map((p) => [p.phase, p.n, p.outcomeRight]), [["Before argument", 1, 0], ["After argument", 1, 1]]);
  });
});
```

How "totals the season" gets its numbers (checked by hand against spec §3). In `wrong` the forecast is 6–3 to reverse and the Court affirms 7–2, with only Roberts and Sotomayor reversing.
- Votes right: Roberts, Sotomayor, Thomas, Alito, Gorsuch (5 of 9).
- Placed right relative to the judgment: Kagan, Kavanaugh, Barrett, Jackson, who were forecast with the (reversing) judgment and really were with the (affirming) one (4 of 9).
- Author: the Court's author is null, so only `right` counts toward the author total.

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx tsx --test lib/scorecard.test.ts` → FAIL, cannot find module `./scorecard`.

- [ ] **Step 3: Implement `lib/scorecard.ts`**

```ts
// The scorecard's data shape and arithmetic (spec §4). Pure: lib/scorecard-data.ts loads real cases into it,
// lib/sample-season.ts builds the synthetic preview in the same shape.
import type { Vote } from "./clerk-rules";
import { justices } from "./court";
import type { Judgment } from "./decisions";
import { scoreForecast } from "./scoring";

export type Disposition = "Affirm" | "Reverse" | "Vacate" | "Other";
export type ScoredVote = { slug: string; confidence: number; voteRight: boolean; majorityRight: boolean };
export type ScoredCase = {
  id: string | null; docket: string; title: string; phase: "Before argument" | "After argument"; locked: string; decided: string;
  predicted: { disposition: Disposition; tally: [number, number]; author: string | null; votes: Record<string, { side: Disposition; confidence: number }> };
  actual: { disposition: Disposition; tally: [number, number]; author: string | null };
  outcomeRight: boolean; authorRight: boolean | null; votes: ScoredVote[];
};
export type ScoredInput = {
  id: string; docket: string; title: string; phase: string; lockedAt: string; predictedOutcome: string; tally: [number, number];
  author: string | null; votes: { justice: string; vote: string; confidence: number }[];
  decidedAt: string; outcome: string; actualVotes: Record<string, string>; actualAuthor: string | null;
};

const SENIORITY = Object.fromEntries(justices.map((j) => [j.slug, j.seniority]));
const VOTE_DISPOSITION: Record<string, Disposition> = { affirm: "Affirm", reverse: "Reverse", vacate_remand: "Vacate", other: "Other" };
const JUDGMENT: Record<Disposition, Judgment> = { Affirm: "affirm", Reverse: "reverse", Vacate: "vacate_remand", Other: "other" };

export const dispositionOf = (text: string): Disposition =>
  /^affirmed/i.test(text) ? "Affirm" : /^reversed/i.test(text) ? "Reverse" : /^vacated/i.test(text) ? "Vacate" : "Other";

const shortDate = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });

export function buildScoredCase(i: ScoredInput): ScoredCase {
  const predVotes = Object.fromEntries(i.votes.map((v) => [v.justice, v.vote as Vote]));
  const confidence = Object.fromEntries(i.votes.map((v) => [v.justice, Number(v.confidence)]));
  const actualDisposition = dispositionOf(i.outcome);
  const s = scoreForecast({ votes: predVotes, confidence, author: i.author },
    { judgment: JUDGMENT[actualDisposition], votes: i.actualVotes as Record<string, Vote>, author: i.actualAuthor }, SENIORITY);
  const withJudgment = Object.values(i.actualVotes).filter((v) => (v === "affirm") === (actualDisposition === "Affirm")).length;
  return {
    id: i.id, docket: i.docket, title: i.title,
    phase: i.phase === "after_argument" ? "After argument" : "Before argument",
    locked: shortDate(i.lockedAt, "America/New_York"), decided: shortDate(`${i.decidedAt}T12:00:00Z`, "UTC"),
    predicted: {
      disposition: dispositionOf(i.predictedOutcome), tally: i.tally, author: i.author,
      votes: Object.fromEntries(i.votes.map((v) => [v.justice, { side: VOTE_DISPOSITION[v.vote] ?? "Other", confidence: Number(v.confidence) }])),
    },
    actual: { disposition: actualDisposition, tally: [withJudgment, Object.keys(i.actualVotes).length - withJudgment], author: i.actualAuthor },
    outcomeRight: s.outcomeCorrect, authorRight: s.authorCorrect,
    votes: s.justices.map((j) => ({ slug: j.slug, confidence: j.confidence ?? 0, voteRight: j.voteRight, majorityRight: j.majorityRight })),
  };
}

export function seasonRecord(cases: ScoredCase[]) {
  const votes = cases.flatMap((c) => c.votes);
  const authored = cases.filter((c) => c.authorRight !== null);
  return {
    n: cases.length, outcomeRight: cases.filter((c) => c.outcomeRight).length,
    votes: votes.length, voteRight: votes.filter((v) => v.voteRight).length, majorityRight: votes.filter((v) => v.majorityRight).length,
    authorN: authored.length, authorRight: authored.filter((c) => c.authorRight).length,
  };
}

export function perJustice(cases: ScoredCase[]) {
  const out: Record<string, { right: number; n: number }> = {};
  for (const v of cases.flatMap((c) => c.votes)) {
    out[v.slug] ??= { right: 0, n: 0 };
    out[v.slug].n++;
    if (v.voteRight) out[v.slug].right++;
  }
  return out;
}

export function byPhase(cases: ScoredCase[]) {
  return (["Before argument", "After argument"] as const).map((phase) => {
    const cs = cases.filter((c) => c.phase === phase);
    const vs = cs.flatMap((c) => c.votes);
    return { phase, n: cs.length, outcomeRight: cs.filter((c) => c.outcomeRight).length, votes: vs.length, voteRight: vs.filter((v) => v.voteRight).length };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx tsx --test lib/scorecard.test.ts` → pass (adjust only hand-checked literals per the note in Step 1). `npm test` → pass.

- [ ] **Step 5: `lib/scorecard-data.ts`**

```ts
// Loads the scorecard from the database (spec §3–4): scored OT2026 forecasts and the waiting list.
import { cache } from "react";
import { buildScoredCase, type ScoredCase } from "./scorecard";
import { countingForecasts, lockedBeforeDecision } from "./scoring";
import { SCORED_TERM } from "./outcomes";
import { serviceClient } from "./supabase";
import { formatEt } from "./views";

export type WaitingRow = { id: string; docket: string | null; title: string; phase: string; lockedAt: string | null; outcome: string | null; tally: [number, number]; review: boolean };

type Row = {
  id: string; case_id: string; phase: string; origin: string; locked_at: string; outcome: string; majority_count: number; minority_count: number; author_pred: string | null;
  cases: { title: string; docket: string | null; term: string; decided_before_cutoff: boolean; outcomes: { decided_at: string; outcome: string; votes: Record<string, string>; author: string | null; status: string } | null };
  justice_votes: { justice: string; vote: string; confidence: number }[];
};

export const loadScorecard = cache(async (): Promise<{ counted: ScoredCase[]; all: ScoredCase[]; waiting: WaitingRow[] }> => {
  const { data, error } = await serviceClient()
    .from("predictions")
    .select("id, case_id, phase, origin, locked_at, outcome, majority_count, minority_count, author_pred, cases!inner(title, docket, term, decided_before_cutoff, outcomes(decided_at, outcome, votes, author, status)), justice_votes(justice, vote, confidence)")
    .eq("status", "locked").eq("cases.term", SCORED_TERM).eq("cases.decided_before_cutoff", false)
    .order("locked_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  const scoredRows = rows.filter((r) => r.cases.outcomes?.status === "scored" && lockedBeforeDecision(r.locked_at, r.cases.outcomes.decided_at));
  const toCase = (r: Row) => buildScoredCase({
    id: r.id, docket: r.cases.docket ?? "—", title: r.cases.title, phase: r.phase, lockedAt: r.locked_at,
    predictedOutcome: r.outcome, tally: [r.majority_count, r.minority_count], author: r.author_pred, votes: r.justice_votes,
    decidedAt: r.cases.outcomes!.decided_at, outcome: r.cases.outcomes!.outcome, actualVotes: r.cases.outcomes!.votes, actualAuthor: r.cases.outcomes!.author,
  });
  const all = scoredRows.map(toCase);
  const countedIds = new Set(countingForecasts(scoredRows.map((r) => ({ id: r.id, caseId: r.case_id, origin: r.origin, lockedAt: r.locked_at }))).map((f) => f.id));
  const counted = all.filter((c) => countedIds.has(c.id!));

  const waiting = rows.filter((r) => r.cases.outcomes?.status !== "scored").map((r) => ({
    id: r.id, docket: r.cases.docket, title: r.cases.title, phase: r.phase === "after_argument" ? "After argument" : "Before argument",
    lockedAt: formatEt(r.locked_at), outcome: r.outcome, tally: [r.majority_count, r.minority_count] as [number, number],
    review: r.cases.outcomes?.status === "needs_review",
  }));
  return { counted, all, waiting };
});
```

Run: `npx tsc --noEmit` → clean. (If supabase-js returns `outcomes` as an array for the one-to-one relation, normalise with `Array.isArray(x) ? x[0] ?? null : x` where `r.cases.outcomes` is read; check by logging one row in Step 6 of Task 8.)

- [ ] **Step 6: Commit**

```bash
git add web/lib/scorecard.ts web/lib/scorecard.test.ts web/lib/scorecard-data.ts
git commit -m "Scorecard data: scored cases, season record, per justice, by phase"
```

---

### Task 8: The scorecard page and the sample season

**Files:**
- Create: `lib/sample-season.ts`, `components/ScorecardView.tsx`
- Modify: `app/scorecard/page.tsx`

**Interfaces:**
- Consumes: `ScoredCase`, `seasonRecord`, `perJustice`, `byPhase` (Task 7); `calibration`, `CALIBRATION_MIN_VOTES` (Task 4); `loadScorecard`, `WaitingRow` (Task 7); `Bench` (`components/Bench.tsx`), `ArrowRight` (`components/Icons.tsx`), `justices`, `benchOrder`, `byslug` (`lib/court.ts`).
- Produces: `sampleSeason: ScoredCase[]`; `<ScorecardView counted all waiting />` client component.

- [ ] **Step 1: Port the sample season**

Create `lib/sample-season.ts` as a TypeScript port of `web-1/src/sampleSeason.js`, unchanged in logic (same seed `20261008`, same `TITLES`, `LOCKED`, `DECIDED`, `mulberry32`, `sigmoid`, `buildCase`), with these differences:
- The prototype's `justices` carry an `ideology` number that `lib/court.ts` doesn't have. Add a local constant used only by the generator, copied from `web-1/src/data.js` (one value per slug), with the comment `// Illustrative leanings for the synthetic generator only; never shown.`
- Replace the final `score(c)` with a function that returns a `ScoredCase` (from `lib/scorecard.ts`): `id: null`, `phase` as in the prototype, `locked`/`decided` as in the prototype, `predicted: { disposition, tally, author, votes }` where `votes[slug] = { side, confidence }`, `actual: { disposition, tally, author }`, `outcomeRight`, `authorRight` (boolean), and `votes: ScoredVote[]` computed exactly as the prototype's `score()` does.
- Export `export const sampleSeason: ScoredCase[]`.

Add to `lib/scorecard.test.ts`:

```ts
import { sampleSeason } from "./sample-season";
describe("sampleSeason", () => {
  it("is sixteen stable synthetic cases in the live shape", () => {
    assert.equal(sampleSeason.length, 16);
    assert.equal(sampleSeason[0].title, "Mercer v. Ohio");
    assert.equal(sampleSeason[0].id, null);
    assert.ok(sampleSeason.every((c) => c.votes.length === 9));
    assert.deepEqual(seasonRecord(sampleSeason), seasonRecord(sampleSeason)); // deterministic
  });
});
```

Run: `npx tsx --test lib/scorecard.test.ts` → fails before the port exists, passes after.

- [ ] **Step 2: Port the page component**

Create `components/ScorecardView.tsx` (`"use client"`) as a TypeScript port of `web-1/src/pages/Scorecard.jsx` — `CaseMarks`, `RatioScale`, `RecordLine`, `Calibration`, `LedgerHead`, `MarksKey`, `Ledger`, `PendingLedger` and the default component — with these changes:
- Props: `{ counted: ScoredCase[]; all: ScoredCase[]; waiting: WaitingRow[] }`. The `source` toggle stays (`"live"` default, `"sample"`); `cases = sample ? sampleSeason : counted`; the before/after section uses `sample ? sampleSeason : all` with `byPhase`; per-justice uses `perJustice(cases)` (not always the sample, as the prototype does); the season sentences use `seasonRecord(cases)`; the "Opinion author" sentence reads "Named the author in {authorRight} of {authorN} cases" and hides its dots when `authorN` is 0.
- `Calibration` takes `votes` and draws `calibration(votes)` from `lib/scoring.ts` instead of its own bucketing; when `votes.length < CALIBRATION_MIN_VOTES` render `<p className="muted">Calibration needs {CALIBRATION_MIN_VOTES} scored votes; {votes.length} so far.</p>` instead of the chart.
- `Ledger`: replace the hard-coded `/9` with `/{c.votes.length}`; wrap the case title in `<Link href={`/runs/${c.id}`}>` when `c.id` is not null.
- `PendingLedger({ rows })`: render `waiting` rows like the current `app/scorecard/page.tsx` list (title linking to `/runs/{id}`, phase and lock time), and in the Court column show `Decided · scoring after review` (class `awaiting`) when `row.review`, else `Not yet decided`.
- Imports: `Bench` from `@/components/Bench`, `ArrowRight` from `@/components/Icons`, `byslug` from `@/lib/court`, `Link` from `next/link`. Keep the prototype's class names; they already exist in `app/globals.css`.
- The intro line under the title keeps the current page's sentence with the `/method#fairtest` link; the bottom keeps "How forecasts are scored" linking to `/method#scoring`.

- [ ] **Step 3: Wire the page**

Replace the body of `app/scorecard/page.tsx` with:

```tsx
import type { Metadata } from "next";
import ScorecardView from "@/components/ScorecardView";
import { loadScorecard } from "@/lib/scorecard-data";

export const metadata: Metadata = { title: "Scorecard · Bench Forecast" };
export const dynamic = "force-dynamic";

export default async function ScorecardPage() {
  const { counted, all, waiting } = await loadScorecard();
  return <ScorecardView counted={counted} all={all} waiting={waiting} />;
}
```

Run: `npx tsc --noEmit && npm run -s lint && npm test` → pass.

- [ ] **Step 4: Browser pass with seeded outcomes**

Seed a scored outcome for the Suncor case so the live view has one decided case (removed afterwards):

```bash
cd web
npx tsx --env-file=.env.local scripts/db/sql.ts -c "insert into outcomes (case_id, decided_at, outcome, votes, author, status, notes) select id, '2026-12-01', 'Reversed and remanded', '{\"roberts\":\"reverse\",\"thomas\":\"reverse\",\"kavanaugh\":\"reverse\",\"barrett\":\"reverse\",\"gorsuch\":\"reverse\",\"sotomayor\":\"affirm\",\"kagan\":\"affirm\",\"jackson\":\"affirm\"}'::jsonb, 'kavanaugh', 'scored', 'browser-check seed' from cases where docket = '25-170'"
```

With `npm run dev` running, open `http://localhost:3000/scorecard` and check:
1. Season record: "Right in 0 of 1 decided cases" (the forecast was 4–4 = affirm; the seeded Court reversed), votes "7 of 8", author sentence with 0 of 0 (the forecast had no author) and no dots.
2. Accuracy by justice: eight seats with captions "1 of 1" or "0 of 1"; Alito with no case.
3. Before vs after: "Before argument" says no scored cases; "After argument" shows 1 case.
4. Calibration: "needs 20 scored votes; 8 so far".
5. Every scored case: one row, 25-170, linking to the Suncor run; Forecast "Affirm 4–4", Court "Reverse 5–3".
6. Toggle "Preview a sample season": the sample flag shows, sixteen cases, calibration chart draws; toggle back to live.
7. No console errors.

Then remove the seed and confirm the empty state returns:

```bash
npx tsx --env-file=.env.local scripts/db/sql.ts -c "delete from outcomes where notes = 'browser-check seed'"
```

- [ ] **Step 5: Build check**

Run `next build` in a scratch copy so the running dev server's `.next` isn't touched:

```bash
B=$(mktemp -d) && rsync -a --exclude node_modules --exclude .next --exclude 'data/' ./ "$B/" && ln -s "$PWD/node_modules" "$B/node_modules" && (cd "$B" && npx next build > build.log 2>&1; echo "build exit $?"; grep -m1 Compiled build.log); rm -rf "$B"
```
Expected: `build exit 0`.

- [ ] **Step 6: Commit**

```bash
git add web/lib/sample-season.ts web/lib/scorecard.test.ts web/components/ScorecardView.tsx web/app/scorecard/page.tsx
git commit -m "Scorecard page on real data, with the labelled sample-season preview"
```

---

### Task 9: Owner runbook, handoff and decision record

**Files:**
- Create: `docs/scorecard-ops.md`
- Modify: `PROGRESS.md`, `decisions.md`

- [ ] **Step 1: Write `docs/scorecard-ops.md`**

```markdown
# Running the OT2026 scorecard

## One-time setup
Add `INNGEST_PROD_EVENT_KEY=<key>` to `web/.env.local` (Inngest dashboard → production environment → Manage → Event keys). Only the docket and outcomes scripts read it; the app keeps using the local dev server.

## Forecasting argued cases (after each argument week)
    cd web
    npm run docket -- list                          # what's argued, what's ready, what exists
    npm run docket -- forecast --max-spend 30 --dry-run
    npm run docket -- forecast --max-spend 30       # starts up to 12 forecasts on production
Recusals the docket page doesn't show: `--recuse 25-170:alito`. Runs appear at bench-forecast.vercel.app as they lock; a batch takes about an hour. Spend: `npm run invite -- spend`.

## Decisions (automatic, 6 PM Eastern daily)
Clean decisions are scored automatically. Check the queue after decision days:
    npm run outcomes -- review
    npm run outcomes -- confirm 25-170
    npm run outcomes -- set 25-170 --judgment reversed --majority roberts,… --dissent kagan,… --author roberts [--recused alito]
Re-run by hand: `npm run outcomes -- run` (or `--term 24 --dry-run` to test against last term).
```

- [ ] **Step 2: Record the decision and the handoff**

Append to `decisions.md`:

```markdown

## Q27 — How the OT2026 scorecard is fed (2026-10-11)
- **Options:** owner files cases · owner-run docket script · unattended forecasting; decisions automatic · automatic with review · owner confirms each
- **Decision:** An owner-run script forecasts every argued case after argument, with its own `--max-spend` (docket runs don't count against the public $10/day). A daily Inngest job reads the Court's slip opinions and scores clean decisions; anything ambiguous waits in a review queue. Totals count one forecast per case (the docket one if any).
- **Why:** A full term (~55–60 cases, ~$130–140) makes the scorecard meaningful while spending stays the owner's call; automatic scoring keeps "scored in public" true without letting a parsing slip publish a wrong score.
```

In `PROGRESS.md`, replace the line `- ⏭ Next: phase 7 (OT2026 case list, outcomes cron, scorecard); owner reviews the nine profiles.` with a "Phase 7" block in the Phase 6 block's style summarising: migration 10 (origins, invite-only budget, review columns); `lib/court-site.ts`, `lib/decisions.ts`, `lib/scoring.ts`, `lib/scorecard.ts` (pure, tested); `read-decisions` Inngest cron (6 PM ET) and `predict-docket-case` (concurrency 9 steps); `npm run docket` / `npm run outcomes`; scorecard page with sample preview; runbook `docs/scorecard-ops.md`; and "⏭ Next: owner sets INNGEST_PROD_EVENT_KEY and runs the first docket batch; owner reviews the nine profiles."

- [ ] **Step 3: Commit**

```bash
git add docs/scorecard-ops.md PROGRESS.md decisions.md
git commit -m "Phase 7 runbook, handoff notes and decision Q27"
```
