# Bench Forecast — progress and handoff

Last updated: 2026-10-08 (after first push). Read this first when resuming.

## Where things stand
- **`web-1/` is the live prototype** (React 18 + Vite). The old three-clone prototype (`web/`) was deleted on 2026-10-08.
- Visual world: **"The Bench"**. Nine seats in true bench order, vote by shape not hue, brass only for the opinion author and the lock seal, bench-green band, Public Sans + Source Serif 4 (self-hosted via @fontsource).
- Product truth: `PRODUCT.md`. Design rules: `DESIGN.md` + `.impeccable/design.json`. Spec and decisions: `spec.md`, `decisions.md`.
- No backend yet. All data is sample or synthetic and labeled as such.
- **Git:** repo on `main`, pushed to https://github.com/bcalford/bench_forecast (`origin`, tracking). Commits: `25ef4a6` initial, `aa40a91` Method page repo link. Commit/push only when asked.
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
6. ⏭ **Next: `/impeccable distill`** — trim `#/case` briefing to Facts + Question presented; end with a closing strip restating the lock and leading to `#/reader`
7. `/impeccable polish` — seat glyph: outline seats on scorecard, outline/struck on `#/new`, checkmarks in filing checklist; phase on `#/reader` seal; Forecast/Court as column headers; key for author strip; readable sample IDs (S-101); static "Term" field; off-system black segmented toggle
8. `/impeccable document` — record seat-glyph rules, small type sizes (11–12.5px), system monospace for code, newer colors in DESIGN.md (clears detector advisories)
Then re-run `/impeccable critique` to compare against 27/40.

## Open items and cautions
- Own-opinion citation summaries in `src/data.js` (`ownCitations`) were written from memory; verify against the real opinions before showing to legal experts.
- Not visually verified by hand: brief-chip passage panel, screen-reader announcements, `#/new/edit` prefill.
- `web-1/PRODUCT.md` and `web-1/DESIGN.md` are symlinks to the root files. They were needed before the repo existed; with the git root now at `supreme-court-app/`, Impeccable finds the root files on its own, so the symlinks can be removed if they cause confusion.
- Live mode config: `web-1/.impeccable/live/config.json`. Restart with `/impeccable live`.
- Run locally: `cd web-1 && npm install && npm run dev` (Vite on :5173). `npx vite build` then `npx vite preview` serves `dist/`.

## Later
- Backend per `spec.md`: Next.js, Supabase (pgvector), Inngest, Voyage, Claude Opus/Sonnet.
