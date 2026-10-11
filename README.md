# Bench Forecast

Forecasts how each Supreme Court justice will vote in a case, then scores those forecasts in public once the Court decides.

**Live site:** https://bench-forecast.vercel.app

## What it does

Nine AI agents, one per justice, read a case's briefs and argument transcript. Each agent searches that justice's own past opinions and a reviewed profile, then predicts the justice's vote, how confident it is, and why, citing the passages it relied on. A clerk agent combines the nine votes into the predicted outcome, the vote split and the likely author of the majority opinion.

Every forecast is locked before the Court rules. When the decision comes out, the site reads it, scores the forecast and adds it to the public scorecard: outcome, individual votes, majority membership, opinion author, and whether the stated confidence holds up.

The project keeps itself honest:

- Only forecasts locked before their decision count.
- Cases decided before the models' knowledge cutoff are excluded, because the models may already know the answer.
- No accuracy figures are invented. The scorecard's preview season is synthetic and labelled as such.
- What a justice wrote is paraphrased and labelled, never presented as a quote it isn't.

The October 2026 term is the first scored season.

## How to use it

- **Forecasts** (home page): every forecast so far. Open one to see each justice's vote, confidence and reasoning.
- **Scorecard**: the season's record once decisions arrive, and the forecasts still waiting to be scored. "Preview a sample season" shows how it reads with results.
- **Method**: how the forecasts are made and scored.
- **Forecast a case**: upload the merits briefs (and the argument transcript, if argued) to start a new forecast. Filing needs an invite code, and a daily spending cap applies.

## Running it locally

The app lives in `web/` (Next.js, TypeScript). It uses Supabase (Postgres with pgvector, Storage, Realtime), Inngest for the forecast jobs, Claude for the agents and Voyage for embeddings.

```bash
cd web
npm install
cp .env.example .env.local     # fill in the Supabase, Inngest, Anthropic and Voyage keys
```

1. Apply the database schema: `supabase link`, then `supabase db push` (or run the files in `web/supabase/migrations/` in order in the Supabase SQL editor), then `web/supabase/seed.sql`.
2. Start the app with `npm run dev`. Check http://localhost:3000/api/health, which should return `{"ok":true,"justices":9}`.
3. In a second terminal, start the job runner with `npm run inngest:dev`.
4. Run the tests with `npm test`.

Forecasts also need the justices' writings loaded and embedded; the scripts for that are in `web/scripts/ingest/`.

## Project layout

| Path | What |
|---|---|
| `web/` | The app: pages, agents, forecast pipeline, scoring and admin scripts |
| `web-1/` | The original design prototype (React + Vite) |
| `docs/` | Deployment and scorecard runbooks |
| `spec.md`, `decisions.md`, `DESIGN.md`, `PRODUCT.md` | Specification, design decisions and design system |

## License

[MIT](LICENSE)
