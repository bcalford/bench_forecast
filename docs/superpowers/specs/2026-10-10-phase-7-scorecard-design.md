# Phase 7: docket forecasts, decisions and the scorecard — design

Date: 2026-10-10. Status: approved in conversation; awaiting review of this written spec.
Sources: spec.md §3.6–3.7, §8 (phase 7), §9; decisions.md Q15 (how scoring works), Q18, Q26; phase 6 spec (`2026-10-10-phase-6-gating-deploy-design.md`).

## Goal

Score Bench Forecast honestly on the October 2026 term: forecast every argued case after argument, read the Court's real decisions as they come down, score the forecasts, and publish the record on `/scorecard`.

## Decisions made with the owner

- **Which cases:** a script the owner runs forecasts every argued OT2026 case (about 55–60 cases, about $130–140 for the term). Not fully automatic.
- **Budget:** docket runs have their own cap (`--max-spend`), separate from the public $10/day cap, which counts only invite-code runs.
- **When:** after argument only, with the argument transcript.
- **Decisions:** read automatically every day; anything that doesn't parse cleanly waits in a review queue for the owner.
- **Where the daily job runs:** an Inngest scheduled function (not Vercel Cron, not a manual script).
- **Scorecard:** port the `web-1` prototype design onto real data, including its clearly labelled sample-season preview.

## 1. Docket forecasts and their cap

### Data
Migration 10 adds `predictions.origin text not null default 'owner' check (origin in ('invite', 'docket', 'owner'))`.
- Existing rows: `invite` where a `filing_claims` row exists; otherwise `owner`.
- `claim_filing` inserts `origin = 'invite'`.
- `filing_budget` counts only `invite` runs: ledger rows whose prediction has `origin = 'invite'`, and holds for in-flight `invite` predictions. Owner and docket spend no longer closes public filing.

### `npm run docket -- list`
Reads the OT2026 hearing lists (`https://www.supremecourt.gov/oral_arguments/hearinglists/HearingList-<Month>2026.pdf`, October 2026 onward, stopping at the first month not yet published) and prints, per argued case: docket number, argument date, transcript posted (from `https://www.supremecourt.gov/oral_arguments/argument_transcript/2026`), petitioners' and respondents' merits briefs found (from the docket page `https://www.supremecourt.gov/docket/docketfiles/html/public/<docket>.html`), recusals found, and whether a locked after-argument forecast already exists. No spending.

### `npm run docket -- forecast --max-spend N [--cases a,b] [--recuse docket:slug] [--dry-run] [--force]`
For each argued case without a locked after-argument forecast (any origin; `--force` overrides), up to ⌊N ÷ $2.50⌋ cases:
1. From the docket page: the caption (case title), the "Main Document" of the 2026 "Brief of petitioner(s) …" and "Brief of respondent(s) …" entries (not replies, not amici, not briefs in opposition), and recusals from "took no part" entries. `--recuse` adds recusals.
2. The transcript PDF from the transcripts page.
3. Upload to the `briefs` bucket with the existing stored names (`01-Brief for the Petitioner.pdf`, `02-Brief for the Respondent.pdf`, `argument-transcript.pdf`), create the case (`term = October Term 2026`, `input_mode = briefs`, docket number set) and the prediction (`phase = after_argument`, `origin = docket`), send `case/predict.requested` with `lane: "docket"`.

A case missing any of the three documents is skipped with the reason; nothing is uploaded or created for it. Consolidated cases are forecast once under the lead docket number, with the others noted. `--dry-run` prints what would be filed. The script prints what it started and the estimated spend.

### Concurrency
The `predict-case` function gets `concurrency: [{ key: "event.data.lane", limit: 2 }]`. Events without a lane (invite and owner runs) share the default key, also limited to 2. A batch of 12 docket runs takes about 30 minutes.

### Spend report
`npm run invite -- spend` adds a line: docket and owner spend today (not counted against the public cap).

## 2. Reading the Court's decisions

### The daily job
Inngest function `read-decisions`, trigger `cron: "TZ=America/New_York 0 18 * * *"`, also invocable by event `decisions/read.requested` with `{ term, dryRun }` for manual runs. Steps:
1. **List** the slip opinions for the term (`https://www.supremecourt.gov/opinions/slipopinion/<yy>`): date, docket number, case name, PDF URL.
2. **Match** decisions whose normalized docket number (digits and dash, e.g. `25-170`) equals the docket of a case with a locked forecast and no `outcomes` row.
3. **Read** each: fetch the PDF, extract the syllabus text, call `readDecision(text)`.
4. **Store** the outcome; if clean, score it (section 3) in the same step.

### `readDecision(syllabusText, sittingCourt) → { judgment, votes, author, recused, clean, reasons }`
A pure function in `lib/decisions.ts`, using the same justice-name matching as the library's opinion splitter. It reads:
- the judgment from the syllabus's closing disposition ("…is affirmed", "reversed and remanded", "vacated and remanded");
- the opinion line: "<NAME>, J./C.J., delivered the opinion of the Court, in which … joined.";
- separate writings: "filed a concurring opinion" and "concurring in the judgment" vote with the judgment; "filed a dissenting opinion" votes against it; joinders ("in which X joined") follow their opinion;
- recusals: "took no part in the consideration or decision of the case."

`clean` is false, with a reason, for: a per curiam or no author line; "concurring in part and dissenting in part"; a plurality ("announced the judgment"); dismissed as improvidently granted; votes that don't account for every sitting justice exactly once; an unmatched name.

### Data
Migration 10 adds to `outcomes`: `status text not null default 'scored' check (status in ('scored', 'needs_review'))`, `source_url text`, `notes text`. `votes` stays `{ slug: "affirm" | "reverse" | "vacate_remand" | "other" }`; recused justices are absent. `outcome` holds the judgment wording; `author` may be null.

### Review queue
`npm run outcomes -- review` lists `needs_review` outcomes with the best guess, reasons and PDF link.
`npm run outcomes -- confirm <docket>` accepts the guess.
`npm run outcomes -- set <docket> --judgment affirmed|reversed|vacated --majority a,b,… --dissent c,… [--author slug] [--recused d]` writes the outcome.
`npm run outcomes -- run [--term 24] [--dry-run]` sends `decisions/read.requested`.
Confirm and set mark the outcome `scored` and score the case at once.

## 3. Scoring

### Which forecasts are scored
Every locked forecast whose case has `term = 'October Term 2026'`, `decided_before_cutoff = false`, and `locked_at` before the start (America/New_York) of `outcomes.decided_at`. All origins. Each gets a `scores` row.

### Which forecast counts in the totals
One per case: the `docket` forecast if there is one, otherwise the earliest locked qualifying forecast. The before/after-argument comparison uses all scored forecasts, by phase.

### `scoreForecast(prediction, outcome) → scores row`
A pure function in `lib/scoring.ts`. Sides: `affirm` vs set aside (`reverse`, `vacate_remand`); `other` matches only `other`. An equally divided Court counts as affirm.
- `outcome_correct`: predicted side of the judgment equals the real side.
- `votes_correct` / `votes_total`: over justices who sat in the real decision; a justice the forecast treated as recused counts as wrong; a justice who really recused is excluded.
- `majority_correct`: over the same justices, placed correctly with or against the judgment.
- `author_correct`: equality; null if either has no author.

Scoring upserts on `prediction_id`, so a corrected outcome rescores.

### Calibration
Computed on the page from scored forecasts' votes: confidence bands 50–59, 60–69, 70–79, 80–89, 90–100%, each with stated mean confidence, observed hit rate and count. Shown once there are at least 20 scored votes.

## 4. The scorecard page

`lib/scorecard.ts` gathers the scored forecasts, outcomes and votes and computes, as pure tested functions, the season record, per-justice accuracy, before/after, calibration, the scored ledger and the waiting list. `app/scorecard/page.tsx` renders the prototype's components (`web-1/src/pages/Scorecard.jsx`, DESIGN.md "Right / Missed Dots", "Record" type, scorecard ledger rules), ported to TypeScript:

1. **Season record** on the green field: outcome, votes, majority membership, author, each a sentence with right/missed dots; "Awaiting the first decision" until there is one.
2. **Accuracy by justice:** the hairline-ring bench, arc and caption = share of that justice's votes called right ("8 of 10"); a seat filters the ledger.
3. **Before vs after argument:** outcome and vote accuracy per phase with case counts; "No scored cases yet" where empty.
4. **Calibration:** the prototype chart and its data-table disclosure; below 20 scored votes, a sentence saying how many more are needed.
5. **Every scored case:** the ledger (docket, case, locked and decided dates, phase, forecast and Court tallies, score dots), each row linking to its forecast.
6. **Locked, waiting to be scored:** as now; `needs_review` cases appear here as "Decided · scoring after review".
7. **Sample-season preview:** the prototype's toggle and sixteen synthetic cases, labelled "Sample data, not real results"; the live view always opens first.

Not included: trends over time, issue-area breakdowns.

## 5. Verification

- Unit tests: `readDecision` on real syllabi (FCC v. Consumers' Research; a 5–4; a per curiam; a partial dissent; a recusal); `scoreForecast` (exact hit, wrong side, vacate vs reverse, tie, recusal mismatches, missing author); `lib/scorecard.ts` (totals with one forecast per case, per-justice, before/after, calibration bands); docket page and hearing-list parsers on saved fixtures.
- Database: migration 10 check script — `filing_budget` ignores docket/owner spend and holds; `claim_filing` sets `origin = 'invite'`.
- Decisions dry run against OT2024 (`--term 24 --dry-run`) finds and reads FCC v. Consumers' Research without writing.
- `docket -- list` and `docket -- forecast --dry-run` against the live Court site, no spending.
- Browser pass on `/scorecard` with seeded test outcomes for the two existing forecasts, removed afterwards; sample preview toggle; no console errors.
- `tsc`, lint, `npm test`, `next build`.
- Spending on real docket forecasts happens only when the owner runs the script.

## Out of scope

Before-argument docket forecasts; amicus briefs in docket runs; automatic (unattended) forecasting; issue-area or time-series charts; changing the forecast pipeline itself.
