# Deploying Bench Forecast (Vercel Hobby; decisions.md Q26)

1. Vercel → Add New → Project → import `bcalford/bench_forecast`.
   - Root Directory: `web`. Framework: Next.js (detected). Build and install commands: defaults.
2. Before the first deploy, Environment Variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (copy from `web/.env.local`)
   - `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` (copy from `web/.env.local`)
   - `DAILY_SPEND_CAP_USD` = `10`
   - Do not add `INNGEST_DEV`, `DATABASE_URL` or `COURTLISTENER_TOKEN`.
3. Deploy. Then Settings → Functions: confirm **Fluid compute** is on (the job's 300 s per step depends on it). Redeploy if you changed it.
4. Inngest: install the Inngest integration from the Vercel Marketplace and connect this project. It adds `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` and syncs `https://<your-app>.vercel.app/api/inngest` on each deploy. Redeploy once so the keys are picked up, then check the Inngest dashboard lists the `predict-case` function.
5. Create invite codes from your Mac: `cd web && npm run invite -- new --note "who it's for"`.

Changing the cap: edit `DAILY_SPEND_CAP_USD` in Vercel (and `web/.env.local` so `npm run invite -- spend` agrees), then redeploy. `0` pauses filing.
