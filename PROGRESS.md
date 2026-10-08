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

## Later
- Backend per `spec.md`: Next.js, Supabase (pgvector), Inngest, Voyage, Claude Opus/Sonnet.
