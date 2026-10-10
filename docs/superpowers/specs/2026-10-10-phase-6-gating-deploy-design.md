# Phase 6: invite codes, daily cap, deploy — design

Date: 2026-10-10. Status: approved in conversation; awaiting review of this written spec.
Sources: spec.md §2, §3.1, §6, §8 (phase 6); decisions.md Q18 (invite codes plus a daily cap), Q26 (Vercel Hobby).

## Goal

Open filing in production without risking more than the owner chooses to spend. Anyone can browse; only someone with an invite code can file a case, and all filing stops once the day's budget is spent. Then deploy the app to Vercel.

## Decisions made with the owner

- Daily cap: **$10** (about 4 forecasts at ~$2.30), across all codes, resetting at midnight America/New_York. Set by `DAILY_SPEND_CAP_USD`; `0` pauses filing.
- Codes are managed with a **command-line script**, not an admin page.
- Deploy by **importing the GitHub repo in the Vercel dashboard** (auto-deploys from `main`, default `*.vercel.app` address). The owner has a Vercel account.
- Enforcement: **one Postgres function that checks and claims in a single transaction** (Approach 1), so concurrent filings cannot overrun a code or the cap.

## 1. Database (migration 8)

Table changes:
- `invite_codes`: add `note text` (who it is for) and `created_at timestamptz not null default now()`.
- `predictions`: add `invite_code text references invite_codes (code)` (null for owner-started runs such as backtests) and `refunded_at timestamptz`.

Constants: `HOLD_USD = 2.50` (held per in-flight run) lives in `lib/filing.ts` and is passed to the functions; the cap comes from `env.dailySpendCapUsd()`.

`filing_budget(cap, hold)` → `numeric` remaining room. Shared by the other functions.
- `spent` = sum of `spend_ledger.cost_usd` with `created_at >= today's midnight America/New_York`.
- `held` = `hold` × count of predictions with `status in ('queued','running')` and `created_at > now() - interval '2 hours'`. The 2-hour window keeps a stuck run from blocking the budget forever; a normal run takes about 4 minutes. In-flight runs that have already billed some calls are counted twice in part; that errs on the side of stopping early.
- room = `cap - spent - held`.

`filing_status(code, cap, hold)` → one of `ok`, `unknown`, `inactive`, `used_up`, `cap`, plus the code's `max_runs` (for the message). Read-only; uses no run. Code checks come first, then the budget (`room < hold` → `cap`). With a null code it checks the budget only (used by the `/new` page).

`claim_filing(code, case_id, phase, cap, hold)` → reason, and the new prediction id when `ok`. In one transaction:
1. `pg_advisory_xact_lock` on a fixed key, so claims are serialized (fine at this volume).
2. `select … for update` the code row; `unknown` / `inactive` / `used_up` (`used_runs >= max_runs`).
3. If `filing_budget(cap, hold) < hold` → `cap`.
4. `used_runs += 1`; insert the prediction (`case_id`, `phase`, `invite_code`) and return its id.

The prediction is inserted inside the claim so the next claim sees its hold; claiming first and inserting later would leave a gap.

`refund_filing(prediction_id)`: if the prediction has an `invite_code`, `status = 'failed'` and `refunded_at is null`, set `refunded_at = now()` and decrement that code's `used_runs`. Idempotent.

All four functions: `security invoker`, `execute` revoked from `anon` and `authenticated` (service role only), matching how `invite_codes` and `spend_ledger` are already server-only.

## 2. Routes and form

`lib/filing.ts`:
- Remove `filingOpen()` and `FILING_OPEN`.
- Add `HOLD_USD`, `normalizeCode(input)` (upper-case, strip spaces, insert missing dashes into `BF-XXXX-XXXX`), `CODE_RE`, and `reasonMessage(reason, maxRuns)`.

`lib/env.ts`: the cap's fallback changes from 25 to 10.

`/new` (server component): calls `filing_status(null, …)`. If the budget has no room, the form renders closed with the `cap` message and a disabled submit button.

`POST /api/filings/uploads` (step 1): body gains `code`. Calls `filing_status(code, …)`; anything but `ok` returns 403 with the message, before any signed upload URL is issued.

`POST /api/filings` (step 2): body gains `code`.
1. Validate as today; insert the case.
2. Call `claim_filing`. If refused: delete the case row and its uploaded objects under `briefs/<caseId>/`, return 403 with the message.
3. If `ok`: send `case/predict.requested`. If the send throws: set the prediction to `failed` with an error, call `refund_filing`, return 502.

`inngest/predictCase.ts` `onFailure`: after marking the run failed, call `refund_filing`.

Messages:

| Reason | Message |
|---|---|
| `unknown` | That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD. |
| `inactive` | That invite code has been turned off. |
| `used_up` | That invite code has used all {max_runs} of its runs. |
| `cap` | Today's forecasting budget is spent. Filing reopens at midnight Eastern. |
| bad format (client) | Invite codes look like BF-7Q2K-M4XD. Check for a missing dash. |

`NewCaseForm`: an "Invite code" field marked Required (from the `web-1` prototype), normalized as typed, needed in both briefs and description modes; an "Invite code" row in the "Your filing" checklist; the server's reason shown on the field.

Not included: rate limiting code guesses (about 1.1 trillion codes from the 32-character alphabet; each has a few runs; the cap bounds any loss).

## 3. Invite script

`web/scripts/admin/invite.ts`, run as `npm run invite -- <command>`, using the service key from `.env.local` (it acts on the one shared database).

| Command | Effect |
|---|---|
| `new [--runs N] [--note "…"]` | Create and print a code (default 3 runs). |
| `list` | Every code: note, used/max runs, on or off, created date. |
| `off CODE` / `on CODE` | Turn a code off or on; runs already started are unaffected. |
| `runs CODE N` | Change a code's run limit. |
| `spend` | Today's spend, held amount, room left against the cap, runs in flight. |

Codes use `crypto.randomInt` over `A–Z 2–9` without `0 O 1 I`; a collision retries. The generator and argument parsing live in `lib/invite.ts` so they can be unit-tested.

## 4. Deploy

Owner, in the Vercel dashboard (Claude provides a checklist with the values):
1. Import `bcalford/bench_forecast`, root directory `web`.
2. Settings → Functions: Fluid compute on.
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `DAILY_SPEND_CAP_USD=10`. Not `INNGEST_DEV`, `DATABASE_URL` or `COURTLISTENER_TOKEN`.
4. Install the Inngest Vercel integration, which sets `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` and syncs `/api/inngest` on each deploy.

Claude: applies migration 8; updates the Method page's guardrails text if it no longer matches; updates PROGRESS.md and the wiki.

There is one Supabase project. Local development and production share codes, spend and the cap.

## 5. Verification

Local, no model spend:
- Unit tests: code generator (alphabet, format, length), `normalizeCode`, `reasonMessage`, argument parsing.
- `scripts/try/gate-check.ts` against the database, cleaning up after itself: unknown, off and used-up codes refused; the cap refused after inserting test ledger rows; two concurrent claims on a one-run code, exactly one wins; refund applies once; a stuck run older than 2 hours no longer holds budget.
- `tsc`, lint, `npm test`, `next build`.
- Browser pass on `/new`: bad format, unknown code, used-up code, spent budget (form closed), successful hand-off up to the claim.

Production:
- Every route loads; a filing with a wrong code is refused.
- One real filing (~$2.30) only with the owner's go-ahead. It is the only way to confirm the Inngest Cloud connection end to end.

## Out of scope

An admin web page; user accounts; per-code spending limits; rate limiting; a custom domain; the scorecard and outcomes cron (phase 7).
