# Running the OT2026 scorecard

## One-time setup
Add `INNGEST_PROD_EVENT_KEY=<key>` to `web/.env.local` (Inngest dashboard → production environment → Manage → Event keys). Only the docket and outcomes scripts read it; the app keeps using the local dev server.

## Forecasting argued cases (after each argument week)
    cd web
    npm run docket -- list                          # what's argued, what's ready, what exists
    npm run docket -- schedule                      # every case on the published hearing lists, upcoming too
    npm run docket -- forecast --max-spend 30 --dry-run
    npm run docket -- forecast --max-spend 30       # starts up to 12 forecasts on production
Recusals the docket page doesn't show: `--recuse 25-170:alito`. Runs appear at bench-forecast.vercel.app as they lock. Docket runs share 3 of the Inngest plan's 5 concurrent steps: 3 cases took about 45 minutes, a full batch of 12 takes about 2–3 hours. Spend: `npm run invite -- spend`.

## Decisions (automatic, 6 PM Eastern daily)
Clean decisions are scored automatically. Check the queue after decision days:
    npm run outcomes -- review
    npm run outcomes -- confirm 25-170 [--recused alito]
    npm run outcomes -- set 25-170 --judgment reversed --majority roberts,… --dissent kagan,… --author roberts [--recused alito]
`confirm` accepts the reader's guess only if it has a vote for every justice not named in `--recused` and a single, whole judgment; otherwise it says why, and you use `set`. Correcting an outcome rescores the case and clears scores that no longer apply.
Re-run by hand: `npm run outcomes -- run` (or `--term 24 --dry-run` to test against last term).
