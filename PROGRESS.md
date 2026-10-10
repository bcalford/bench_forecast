# Bench Forecast — progress and handoff

Last updated: 2026-10-08 (after first push). Read this first when resuming.

## Where things stand
- **`web-1/` is the live prototype** (React 18 + Vite). The old three-clone prototype (`web/`) was deleted on 2026-10-08.
- Visual world: **"The Bench"**. Nine seats in true bench order, vote by shape not hue, brass only for the opinion author and the lock seal, bench-green band, Public Sans + Source Serif 4 (self-hosted via @fontsource).
- Product truth: `PRODUCT.md`. Design rules: `DESIGN.md` + `.impeccable/design.json`. Spec and decisions: `spec.md`, `decisions.md`.
- No backend yet. All data is sample or synthetic and labeled as such.
- **Git:** repo on `main`, pushed to https://github.com/bcalford/bench_forecast (`origin`, tracking). Commits: `4fd7c73` initial, `98fd899` Method page repo link, `ec479b6` PROGRESS update (history rewritten 2026-10-08 to drop Claude co-author trailers). Commit/push only when asked.
- `.gitignore` keeps out `node_modules/`, `dist/`, `.claude/settings.local.json`, the Impeccable engine binary (re-downloaded by the launcher), `.impeccable/review/` screenshots and caches, and `harvey_all.css` (scraped Harvey stylesheet, research only, never commit).

## Pages (hash routes)
| Route | File | Notes |
|---|---|---|
| `#/home` | `src/pages/Home.jsx` | Hero + bench specimen, OT2026 docket (3 rows "Summary only"), method strip, scorecard teaser |
| `#/case` | `src/pages/CaseResult.jsx` | Lead page. Bench, As seated / By vote, Replay, closing lock seal, justice rows, decision panel, briefing |
| `#/run` | `CaseResult.jsx` with `run` prop | Simulated run from `#/new`; recusals recompute tally, author, 4–4 tie rule |
| `#/reader` | `src/pages/Reasoning.jsx` | Per-justice reasoning; brief chips open passages; own-opinion citations (real cases, paraphrased) |
| `#/scorecard` | `src/pages/Scorecard.jsx` | Synthetic sample season (`src/sampleSeason.js`) vs OT2026 live (empty) |
| `#/new` | `src/pages/NewCase.jsx` | Filing form; sample briefs; recusal bench; invite code `BF-XXXX-XXXX`; `DAILY_CAP_REACHED` flag; `#/new/edit` prefills |
| `#/method` | `src/pages/Method.jsx` | Pipeline as designed; `REPO_URL` points at github.com/bcalford/bench_forecast |

Shared: `src/components/Bench.jsx`, `SeatMark.jsx`, `Chrome.jsx` (masthead, logo, LockSeal, footer), `Icons.jsx`; data in `src/data.js`, `src/runDraft.js`; all styles in `src/base.css`.

## Critique fix plan (from `/impeccable critique`, scored 27/40, snapshot in `.impeccable/critique/`)
Running one step at a time, user reviews between steps.
1. ✅ `/impeccable clarify` — own-opinion citations, citation key, "To reverse/To affirm", calibration wording, legend labels
2. ✅ `/impeccable delight` — brief chips open passages with "checked" mark; lock seal closes when the last vote lands
3. ✅ `/impeccable shape method` + build — Method page, nav = Sample forecast · Scorecard · Method · Forecast a case
4. ✅ `/impeccable adapt` — numbers kept on phones, slim seal, contents strips fade/auto-scroll
5. ✅ `/impeccable harden` — single live announcement, calibration chart semantics, AA contrast, "Summary only" rows, Edit/File-another on run, long-title wrapping
6. ✅ `/impeccable distill` — `#/case` briefing cut to Facts + Question presented (history and both sides' arguments stay on `#/reader`); Phase/Decision rows dropped from the facts list; new ruled closing strip restates the lock (time, phase, "Awaiting the Court") and links to `#/reader`
7. ✅ `/impeccable polish` — neutral hairline seats (`neutral` prop on Bench/SeatMark) on scorecard and `#/new`, so a filled seat only ever means majority; checkmarks in the filing checklist (shared `CheckMark` icon); phase shown on the compact `#/reader` seal; ledger column heads on wide screens (row labels kept for phones and screen readers); Right/Missed key under the scorecard record; sample IDs read "Sample 1–16"; Term marked "Set automatically"; light segmented control pressed = ink hairline frame instead of solid black
8. ✅ `/impeccable document` — merged into DESIGN.md (not rewritten): One Meaning per Seat rule (hairline, deliberating, recused states; checkmark for status; Right/Missed key), Caption 12.5px / Micro 11px floors, Code role (system monospace for literal code only), 7 new color tokens (field-line, placeholder, field-white, selection-wash, tip-muted, bench-green-deep/-idle), light segmented control, inputs, file button, closing strip, checkmark; phone layout corrected to match adapt. Sidecar `.impeccable/design.json` regenerated. Detector advisories: 0.
Re-critique 2026-10-08: **29/40** (was 27), snapshot `.impeccable/critique/2026-10-08T13-14-08Z__web-1-src.md`. Detector 0 anti-patterns, 0 advisories.

## Second fix plan (user chose: surface the run first, take on everything) — all done 2026-10-08
1. ✅ onboard — `#/run/sample` starts the sample run in one click (`SAMPLE_DRAFT` in `runDraft.js`); home hero leads with "Watch a forecast run"; `#/case` band offers "Watch it run from the briefs"; `#/new` band: "Run the Hartwell sample" plus "Fill the form with it" (scrolls to and focuses submit, with a status note)
2. ✅ harden — errors tied to fields (`aria-describedby`, `aria-invalid` on file inputs), focused error summary with jump links, focus moves to `<main>` after every in-app navigation
3. ✅ adapt — 44px-tall masthead links, edge-to-edge benches on phones (seats ~43x82), docket line and legend fold on phones, outcome's last word stays with the tally (band still fills most of the first phone screen)
4. ✅ distill — home steps grid and scorecard section replaced by one "Made in the open / Scored in public" pair
5. ✅ polish — disabled field controls at 40% opacity + not-allowed; masthead current = frame + 2px bottom, no fill; Method fan dot no longer brass; reader citation key 58ch; fictional docket numbers (25-2104…) in the sample ledger; docket placeholder 25-0000; legend reworded (Writes a concurrence / Writes the dissent / Writes for the Court); reader contents marks 22px

Re-critique 2026-10-08 (round 3): **29/40** (held), snapshot `.impeccable/critique/2026-10-08T13-26-54Z__web-1-src.md`. Detector clean. Consistency fell to 2, partly from the onboarding pass adding sample labels.

## Third fix plan (user chose: one sample vocabulary first, everything incl. minors, remove dead docket rows) — done 2026-10-08
1. ✅ clarify — sample is "Hartwell sample" / "Watch … run" everywhere; author is "Writes for the Court" everywhere (data role renamed); percent reads "confidence in this vote"; "What the court terms mean" glossary on `#/case`
2. ✅ harden — home docket shows only cases with a page (Hartwell); form errors re-validate live after the first attempt, summary count updates, summary announced by focus (no live re-announce)
3. ✅ distill — `#/case` key down to 4 items; "Watch it run" under the outcome; `#/new` band uses two ghost buttons so submit stays the strongest action
4. ✅ adapt — one-row 56px phone masthead (logo only + short labels); segmented, Choose PDF, text links at 44px; padded hit areas for inline links, cite chips, back link, footer link; contents strips get a chevron cue
5. ✅ polish — pressed toggle stays legible when disabled; checklist only checks what the visitor did; recused dissent writer hands the dissent to the senior dissenter; GitHub link in the footer; By-vote group labels readable by screen readers
- Not fixed: the "double hairline" under the masthead only appears on some loads in headless Chromium and no element draws it; looks like a rendering seam, unconfirmed in a real browser.

Re-critique 2026-10-08 (round 4): **29/40** (third run at 29), snapshot `.impeccable/critique/2026-10-08T13-40-12Z__web-1-src.md`. User chose to stop design rounds: fixed only the P1, then move to the backend.
- ✅ Recusal decision bug: `concurring` now comes from the re-derived roles (a promoted author is never also listed as concurring). Checked Kagan / Roberts+Thomas / Roberts+Kagan.
- ✅ Scorecard opens on "OT2026 (live)"; "Preview a sample season" is the second option; `#/scorecard/sample` (home link) opens the preview.
- ✅ Phone masthead shows the "Bench Forecast" name again (two rows, 95px).
- Left open from round 4 (not scheduled): scorecard seat shapes reuse the arc for accuracy and the dashed ring for "no cases"; Method page's green code panel and boxed callout break the one-field/hairline rules; focus stays on the seat after selecting it; hero buttons stack at 1440; holding drops "remanded".

## Open items and cautions
- Own-opinion citation summaries in `src/data.js` (`ownCitations`) were written from memory; verify against the real opinions before showing to legal experts.
- Not visually verified by hand: brief-chip passage panel, screen-reader announcements, `#/new/edit` prefill.
- `web-1/PRODUCT.md` and `web-1/DESIGN.md` are symlinks to the root files. They were needed before the repo existed; with the git root now at `supreme-court-app/`, Impeccable finds the root files on its own, so the symlinks can be removed if they cause confusion.
- Live mode config: `web-1/.impeccable/live/config.json`. Restart with `/impeccable live`.
- Run locally: `cd web-1 && npm install && npm run dev` (Vite on :5173). `npx vite build` then `npx vite preview` serves `dist/`.

## Backend (started 2026-10-08)
Decisions: Next.js app in `web/` (spec layout inside it); `web-1/` stays as the design reference until phase 5; hosted Supabase project (no local Docker).

Phase 1 (scaffold) — code done, not yet connected:
- `web/`: Next.js 15.5 + React 19, TypeScript, ESLint; deps `@supabase/supabase-js`, `inngest` (v4: triggers go in the options object), `zod`
- `lib/env.ts`, `lib/supabase.ts` (anon + service-role clients), `inngest/client.ts`, `inngest/predictCase.ts` (five stubbed steps), `app/api/inngest`, `app/api/health`
- `supabase/migrations/20261008000001_init.sql`: all ten spec tables, pgvector (1024-d, HNSW cosine), `match_passages()`, RLS (public read on roster/forecasts/outcomes/scores only), Realtime on predictions + justice_votes
- `data/justices/<slug>/roster.json` (9) → `npm run seed:build` → `supabase/seed.sql`
- Verified: typecheck, lint, production build; `/api/health` gives a clear missing-env error; `/api/inngest` registers 1 function in dev mode
- ✅ Connected 2026-10-08: hosted Supabase project; migration + seed applied via the SQL editor; `/api/health` → `{"ok":true,"justices":9}`; RLS verified (anon can read the roster but cannot see invite codes or insert anywhere; code format check enforced); `match_passages()` callable. Keys use Supabase's new names: publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, secret key → `SUPABASE_SERVICE_ROLE_KEY`.
- Fixed: `/api/health` used to report ok with a null count when the table was missing.

Phase 2 (corpus) — done 2026-10-10.
- Opinions OT2011–OT2025 (851 slip/preliminary-print opinions + 513 U.S. Reports cases), all argument transcripts OT2011–OT2025, SCDB voting records (decisions.md Q23). Lower-court opinions deferred to v2 (Q24: CourtListener now allows 125 requests/day).
- Splitter fixes after the profile review flagged misattributions: footnote-free page text (`scripts/ingest/pdf-text.ts`: drops smaller text below the last body line, keeps inline small caps), openers must end at the role ("Justice X, dissenting in part." — not "…dissenting in part, renews a debate"), short-form openers ("Thomas, J., concurring."), syllabus spill skipped. Verified on BNSF, Husted, Hughes, Dimaya, Brnovich, Ruan, Consumers' Research, Obergefell.
- Volume dates: fallback to the "Cite as … (year)" line; fixed in place by `fix-volume-dates.ts`.
- All passages embedded (voyage-law-2). Ingest calls retry transient network/database errors (`lib/retry.ts`).
- Search: IVFFlat index + iterative scan (migration 6, Q25); retrieval check passes for all nine. HNSW and exact search did not work on this instance.
- Direct DB access for migrations: `scripts/db/sql.ts` with `DATABASE_URL` (session pooler) in `.env.local`.
- Profiles regenerated from the cleaned library ($5.55); 4 source notes left (Alito/Waetzig is a false alarm: the PDF says Alito wrote it; Sotomayor/Barr v. AAPC: opener "concurring in the judgment with respect to severability…" not yet matched — fix ROLE_WORDS and re-split vol 591).

First full forecast (phase 4 CLI), 2026-10-10 — FCC v. Consumers' Research, briefs + argument transcript, leakage guards on (own docket excluded; only documents dated before the 2025-03-26 argument):
- Predicted: Reversed 6–3; Roberts, Sotomayor, Kagan, Kavanaugh, Barrett, Jackson in the majority (Kavanaugh and Jackson concurring); Thomas, Gorsuch, Alito dissenting; Kagan writes. Matches the actual decision (June 2025) on every vote, the author and both concurrences.
- Caveat: NOT a fair test — decided before the model's knowledge cutoff, so the model may know the result despite the retrieval guards. The honest test is OT2026 cases locked before decision.
- Cost $2.26 total ($0.27 summary; first agent $0.76 writing the cache, the other eight ~$0.15 each reading 126,815 cached tokens); 200 s. No citations removed or flagged; clerk needed no corrections.
- Retrieval must run one justice at a time (3 searches each) — a 27-search burst timed out (decisions.md Q25).

Step 2 — pipeline wired into Inngest (2026-10-10), verified end to end:
- Migration 7: `predictions.stage` (queued → summarizing → retrieving → deliberating → clerk → locked/failed), `as_of`, `error`; `cases.argued_on`; private Storage bucket `briefs`.
- `inngest/predictCase.ts`: retryable steps (summarize; embed queries; retrieve per justice sequentially; first justice alone to warm the cache, then eight in parallel; clerk-and-lock); each vote saved as it lands (`justice_votes`, citations enriched with case/label/url); every model call in `spend_ledger`; failures set stage `failed` + `error`. `lib/pipeline.ts` holds the DB/storage helpers; `lib/roster.generated.ts` bundles roster, profiles and voting records (`npm run roster:build` after editing a profile). `app/api/inngest` has `maxDuration = 300` (fits Vercel Hobby with Fluid compute, 300 s per step; decisions.md Q26).
- `scripts/try/enqueue.ts` files a case like the form will (upload briefs, create case + prediction, send event). Run with `npm run dev` + `npm run inngest:dev`.
- Test: FCC v. Consumers' Research through the job: locked Reversed 6–3, Kagan writing, same nine sides as the CLI run; 4 min; $2.25 (10 Opus calls incl. clerk, 1 Sonnet); no flagged votes.

Phase 5 — UI ported to Next.js on real data (2026-10-10, uncommitted at time of writing):
- Design CSS (`app/globals.css` from web-1 base.css), fonts, masthead/footer/lock seal (`components/Chrome.tsx`), `Bench`, `SeatMark`, `Icons` in TypeScript. `lib/court.ts` (roster, bench order); `lib/views.ts` shapes DB rows into page data (`loadForecast`, `listForecasts`).
- Routes: `/` (featured forecast + forecasts by term), `/runs/[id]` (live: Realtime on predictions + justice_votes → `router.refresh()`, 8 s poll backup; stage messages; replay of the real arrival order; failed state), `/runs/[id]/reasoning` (summary, each justice's full reasoning, verbatim citations with case/year/opinion label/link), `/new` (filing form: signed-URL uploads straight to Storage via `/api/filings/uploads`, then `/api/filings` creates case + prediction and sends the event), `/method` (facts corrected: local extraction, OT2011+ library, lower courts planned), `/scorecard` (honest empty state + locked-waiting ledger; sample-season preview not ported — comes with phase 7 charts).
- Filing is closed in production (`lib/filing.ts` `filingOpen()`; `FILING_OPEN=1` overrides) until phase 6 adds invite codes and the daily cap.
- `cases.decided_before_cutoff` now drives a "Not a fair test" label (run page, home rows, featured card); set true for the FCC v. Consumers' Research backtest.
- Verified: tsc, lint, `next build`, all routes 200 (unknown run 404), signed upload + missing-upload rejection. Browser pass (2026-10-10) over every route: renders clean. Fixed there: duplicate React keys on the reasoning page (a justice can cite one passage twice; keys are now passage + index) and the decision panel's "Judgment below" label, renamed "Judgment" (it showed the predicted result, not the lower court's). Not yet verified: a live filing through the form watching Realtime (costs ~$2.30).
- ⏭ Next: phase 6 (invite codes, daily cap, deploy on Vercel Hobby with Fluid compute on; Q26).

Phase 4 (pipeline) — written ahead of phase 3; all typecheck; `npm test` 15/15.
- `lib/clerk-rules.ts` (+tests), `lib/schemas.ts` (+citation checker, tests), `lib/models.ts` (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10), `lib/claude.ts` (streamed structured output with `betaZodOutputFormat`, server-side refusal fallbacks, cost per call, stream-started hook), `lib/briefs.ts` (local text extraction; decisions.md Q22), `lib/agents/{summarizer,justice,clerk}.ts`, `lib/retrieval.ts`, `lib/embedding.ts`.
- Summarizer tested on FCC v. Consumers' Research: $0.27, 16 s, neutral, no outcome leak.
- Fan-out: the first justice starts; the other eight start once it streams, so they read the shared briefs+summary cache.
- `scripts/try/forecast.ts` runs one case end to end from the CLI; waiting on embeddings.
