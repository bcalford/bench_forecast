# Bench Forecast: app and pipeline

Next.js (App Router, TypeScript), Supabase (Postgres + pgvector, Storage, Realtime) and Inngest, per `../spec.md`.
The visual design reference is the Vite prototype in `../web-1/`; its pages are ported here in phase 5.

## Setup

1. `npm install`
2. Create a Supabase project at supabase.com. Copy `.env.example` to `.env.local` and fill in the three Supabase values
   (Project Settings → API). `.env.local` is git-ignored.
3. Apply the schema and roster: run `supabase/migrations/20261008000001_init.sql`, then `supabase/seed.sql`,
   in the Supabase SQL editor (or with the Supabase CLI: `supabase link` then `supabase db push`).
4. `npm run dev`, then open http://localhost:3000/api/health. Expect `{"ok":true,"justices":9}`.
5. In a second terminal, `npm run inngest:dev` starts the Inngest dev server against `/api/inngest`.

## Layout

| Path | What |
|---|---|
| `app/api/inngest/route.ts` | Inngest handler |
| `app/api/health/route.ts` | Supabase connectivity and roster check |
| `inngest/predictCase.ts` | The prediction job: extract → summarize → fan-out → clerk → persist and lock (steps stubbed until phase 4) |
| `lib/supabase.ts` | Public (anon) and server-only (service-role) clients |
| `lib/env.ts` | Required environment variables, with clear errors |
| `supabase/migrations/` | Schema, row-level security, Realtime, `match_passages()` |
| `data/justices/<slug>/roster.json` | Roster source of truth; `npm run seed:build` regenerates `supabase/seed.sql` |

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `seed:build`, `inngest:dev`
