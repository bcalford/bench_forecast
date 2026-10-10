# Phase 6: Invite Codes, Daily Cap, Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let invited people file cases in production while all filing stops once $10 has been spent in the day, then deploy to Vercel.

**Architecture:** Four Postgres functions (migration 8) check an invite code and the day's budget, and claim a run, in one serialized transaction; the claim creates the prediction so the next claim sees its $2.50 hold. The Next.js filing routes call them through a thin `lib/gate.ts`; the form adds an invite-code field; a command-line script manages codes. Deploy is a Vercel dashboard import with the Inngest Vercel integration.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase (Postgres, Storage, `supabase-js` RPC), Inngest, `pg` for scripts, `node:test` via `tsx --test`, zod.

**Spec:** `docs/superpowers/specs/2026-10-10-phase-6-gating-deploy-design.md`

All paths below are relative to `web/` unless they start with `docs/`, `PROGRESS.md` or `decisions.md`.

## Global Constraints

- Daily cap $10 across all codes, resetting at midnight `America/New_York`; read from `DAILY_SPEND_CAP_USD`; `0` pauses filing.
- Hold per in-flight run: `HOLD_USD = 2.5`; only runs with `status in ('queued','running')` created in the last 2 hours hold budget.
- Code format `BF-XXXX-XXXX` (`^BF-[A-Z0-9]{4}-[A-Z0-9]{4}$`, the existing table check). New codes use the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0, O, 1, I). Default 3 runs.
- The gate functions are callable by the service role only; `anon` and `authenticated` cannot execute them.
- Messages, verbatim:
  - unknown: `That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD.`
  - inactive: `That invite code has been turned off.`
  - used_up: `That invite code has used all {max_runs} of its runs.`
  - cap: `Today's forecasting budget is spent. Filing reopens at midnight Eastern.`
  - bad format: `Invite codes look like BF-7Q2K-M4XD. Check for a missing dash.`
- One Supabase project: local development and production share codes, spend and the cap.
- Commits: no Claude attribution of any kind (owner's rule). Never push without the owner's say-so.
- Product rules (PRODUCT.md): no scoreboard/betting look, no partisan colors; keep the existing form styles (`field`, `field-label`, `req`, `text-input`, `code-input`, `field-error`, `warn-note`).

## Review Focus

1. A cap or code refusal at the final step, after briefs have uploaded → the case row and its uploaded PDFs are removed and the user sees the reason (Task 3, Step 6).
2. A code typed in lowercase, with spaces or without dashes → accepted as the same code (Task 2 tests; Task 4 sends the normalized code).
3. `DAILY_SPEND_CAP_USD` missing, empty, non-numeric or negative in production → never lifts the cap: missing means $10, unreadable means $0 (closed) (Task 2 tests).
4. A run that fails after its claim, or whose Inngest event can't be sent → its run goes back to the code exactly once, even if the failure handler runs twice (Task 1 gate-check; Task 3, Step 6).
5. A run stuck in `queued` → stops holding budget after 2 hours, so it can't close filing for the rest of the day (Task 1 gate-check).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20261010000008_filing_gate.sql` | create | columns + `filing_budget`, `filing_status`, `claim_filing`, `refund_filing` |
| `scripts/try/gate-check.ts` | create | runs the functions against the database and cleans up |
| `lib/env.ts` | modify | `parseCap`, `DEFAULT_DAILY_CAP_USD = 10` |
| `lib/env.test.ts` | create | `parseCap` tests |
| `lib/filing.ts` | modify | remove `filingOpen`; add `GateReason`, `HOLD_USD`, `CODE_RE`, `normalizeCode`, `reasonMessage`, `isCodeReason`, `CODE_FORMAT_MESSAGE`; `Filing.code` |
| `lib/filing.test.ts` | create | tests for the above |
| `lib/gate.ts` | create | server wrappers for the RPCs |
| `app/api/filings/uploads/route.ts` | modify | checks the code before issuing upload URLs |
| `app/api/filings/route.ts` | modify | claims, cleans up on refusal, refunds on send failure |
| `inngest/predictCase.ts` | modify | `onFailure` refunds |
| `app/new/page.tsx` | modify | form open only if the budget has room |
| `components/NewCaseForm.tsx` | modify | invite-code field, checklist row, reason handling |
| `lib/invite.ts` | create | `newCode`, `parseArgs`, `USAGE` |
| `lib/invite.test.ts` | create | tests |
| `scripts/admin/invite.ts` | create | the `npm run invite` command |
| `package.json` | modify | `invite` script |
| `.env.example` | modify | cap default 10 |
| `PROGRESS.md`, `docs/deploy.md` | modify / create | handoff and the owner's deploy checklist |

---

### Task 1: Migration 8 and the gate functions

**Files:**
- Create: `supabase/migrations/20261010000008_filing_gate.sql`
- Create: `scripts/try/gate-check.ts`

**Interfaces:**
- Produces (SQL, all `security invoker`, service role only):
  - `filing_budget(p_cap numeric, p_hold numeric) returns numeric` — room left today.
  - `filing_status(p_code text, p_cap numeric, p_hold numeric) returns table (reason text, max_runs integer)` — read-only; `p_code` may be null (budget only).
  - `claim_filing(p_code text, p_case_id uuid, p_phase text, p_cap numeric, p_hold numeric) returns table (reason text, max_runs integer, prediction_id uuid)`.
  - `refund_filing(p_prediction_id uuid) returns boolean` — true if a run was returned.
  - Columns: `invite_codes.note text`, `invite_codes.created_at timestamptz`, `predictions.invite_code text`, `predictions.refunded_at timestamptz`.
  - `reason` values: `ok`, `unknown`, `inactive`, `used_up`, `cap`.

- [ ] **Step 1: Write the check script (the failing test)**

Create `scripts/try/gate-check.ts`:

```ts
// Checks the filing gate's database functions (migration 8) against the real database, then removes what it made.
//   npx tsx --env-file=.env.local scripts/try/gate-check.ts
// Uses huge or zero caps so today's real spending doesn't affect the result. A real run starting
// mid-check can shift the hold check by $2.50; rerun if that one assertion fails.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const HOLD = 2.5;
const BIG = 100000;
const CODES = { ok: "BF-TST2-0001", off: "BF-TST2-0002", one: "BF-TST2-0003" };

function client() {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  return new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
}

async function main() {
  const a = client();
  const b = client();
  await a.connect();
  await b.connect();
  const caseIds: string[] = [];
  const newCase = async () => {
    const id = randomUUID();
    caseIds.push(id);
    await a.query(
      "insert into cases (id, title, term, input_mode, description) values ($1, 'Gate check v. Test', 'October Term 2026', 'description', 'gate-check')",
      [id],
    );
    return id;
  };
  const status = async (code: string | null, cap = BIG) =>
    (await a.query("select * from filing_status($1, $2, $3)", [code, cap, HOLD])).rows[0];
  const claim = async (c: pg.Client, code: string, caseId: string, cap = BIG) =>
    (await c.query("select * from claim_filing($1, $2, 'before_argument', $3, $4)", [code, caseId, cap, HOLD])).rows[0];
  const used = async (code: string) => (await a.query("select used_runs from invite_codes where code = $1", [code])).rows[0].used_runs;
  const room = async () => Number((await a.query("select filing_budget($1, $2) as r", [BIG, HOLD])).rows[0].r);
  const refund = async (id: string) => (await a.query("select refund_filing($1) as r", [id])).rows[0].r;

  try {
    await a.query(
      "insert into invite_codes (code, max_runs, active, note) values ($1, 2, true, 'gate-check'), ($2, 3, false, 'gate-check'), ($3, 1, true, 'gate-check')",
      [CODES.ok, CODES.off, CODES.one],
    );

    // Code checks
    assert.equal((await status("BF-NONE-0000")).reason, "unknown");
    assert.equal((await status(CODES.off)).reason, "inactive");
    assert.equal((await status(CODES.ok)).reason, "ok");
    assert.equal((await status(null)).reason, "ok");

    // The cap, and a refused claim uses no run
    assert.equal((await status(CODES.ok, 0)).reason, "cap");
    assert.equal((await status(null, 0)).reason, "cap");
    assert.equal((await claim(a, CODES.ok, await newCase(), 0)).reason, "cap");
    assert.equal(await used(CODES.ok), 0, "a refused claim uses no run");

    // Two claims at once on a one-run code: exactly one wins
    const c1 = await newCase();
    const c2 = await newCase();
    const [r1, r2] = await Promise.all([claim(a, CODES.one, c1), claim(b, CODES.one, c2)]);
    assert.deepEqual([r1.reason, r2.reason].sort(), ["ok", "used_up"]);
    const won = r1.reason === "ok" ? r1 : r2;
    const lost = r1.reason === "ok" ? r2 : r1;
    assert.equal(lost.max_runs, 1, "used_up carries max_runs for the message");
    assert.ok(won.prediction_id, "ok returns the new prediction");
    assert.equal((await a.query("select invite_code from predictions where id = $1", [won.prediction_id])).rows[0].invite_code, CODES.one);
    assert.equal((await status(CODES.one)).reason, "used_up");

    // Holds: a fresh queued run holds $2.50; one stuck for 3 hours holds nothing
    const before = await room();
    await a.query(
      "insert into predictions (case_id, phase, status, created_at) values ($1, 'before_argument', 'queued', now() - interval '3 hours')",
      [await newCase()],
    );
    assert.equal(await room(), before, "a run stuck for 3 hours holds nothing");
    await a.query("insert into predictions (case_id, phase, status) values ($1, 'before_argument', 'queued')", [await newCase()]);
    assert.equal(await room(), before - HOLD, "a fresh queued run holds $2.50");

    // Refunds: only failed runs, only once
    assert.equal(await refund(won.prediction_id), false, "a queued run isn't refunded");
    await a.query("update predictions set status = 'failed', stage = 'failed' where id = $1", [won.prediction_id]);
    assert.equal(await refund(won.prediction_id), true);
    assert.equal(await refund(won.prediction_id), false, "a second refund does nothing");
    assert.equal(await used(CODES.one), 0);

    // Visitors' roles cannot call the functions
    // (If this fails with "permission denied to set role", the connection's user can't switch roles;
    // check instead with: select has_function_privilege('anon', 'filing_status(text,numeric,numeric)', 'execute') → false.)
    await a.query("begin");
    await a.query("set local role anon");
    await assert.rejects(a.query("select * from filing_status(null, 1, 1)"), /permission denied/);
    await a.query("rollback");

    console.log("gate-check: all checks passed");
  } finally {
    await a.query("rollback").catch(() => {});
    await a.query("delete from cases where id = any($1)", [caseIds]); // cascades to their predictions
    await a.query("delete from invite_codes where note = 'gate-check'");
    await a.end();
    await b.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx tsx --env-file=.env.local scripts/try/gate-check.ts`
Expected: FAIL with `column "note" of relation "invite_codes" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261010000008_filing_gate.sql`:

```sql
-- Phase 6 filing gate: invite codes and the daily budget, enforced in one place (decisions.md Q18;
-- docs/superpowers/specs/2026-10-10-phase-6-gating-deploy-design.md §1).

alter table invite_codes
  add column note       text,                                  -- who the code is for
  add column created_at timestamptz not null default now();

alter table predictions
  add column invite_code text references invite_codes (code),  -- null for runs the owner starts (backtests)
  add column refunded_at timestamptz;                          -- set once a failed run's use is returned to its code

-- Room left in today's budget: the cap, less today's spend (midnight America/New_York onward),
-- less a hold for each run in flight. Runs older than 2 hours stop holding, so a stuck run
-- can't close filing for the day. In-flight runs that have billed some calls count partly twice,
-- which errs toward stopping early.
create function filing_budget(p_cap numeric, p_hold numeric) returns numeric
language sql stable security invoker as $$
  select p_cap
    - coalesce((select sum(cost_usd) from spend_ledger
                where created_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')), 0)
    - p_hold * (select count(*) from predictions
                where status in ('queued', 'running') and created_at > now() - interval '2 hours');
$$;

-- Read-only: would this code be allowed to file now? A null code checks the budget only.
create function filing_status(p_code text, p_cap numeric, p_hold numeric)
returns table (reason text, max_runs integer)
language plpgsql stable security invoker as $$
#variable_conflict use_column
declare
  c invite_codes%rowtype;
begin
  if p_code is not null then
    select * into c from invite_codes where code = p_code;
    if not found then return query select 'unknown'::text, null::integer; return; end if;
    if not c.active then return query select 'inactive'::text, c.max_runs; return; end if;
    if c.used_runs >= c.max_runs then return query select 'used_up'::text, c.max_runs; return; end if;
  end if;
  if filing_budget(p_cap, p_hold) < p_hold then return query select 'cap'::text, c.max_runs; return; end if;
  return query select 'ok'::text, c.max_runs;
end $$;

-- Checks and claims in one transaction, and creates the prediction inside it so the next claim
-- sees this run's hold. Claims are serialized by an advisory lock (a few runs a day).
create function claim_filing(p_code text, p_case_id uuid, p_phase text, p_cap numeric, p_hold numeric)
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
  insert into predictions (case_id, phase, invite_code) values (p_case_id, p_phase, p_code) returning id into new_id;
  return query select 'ok'::text, c.max_runs, new_id;
end $$;

-- Returns a failed run's use to its code, once.
create function refund_filing(p_prediction_id uuid) returns boolean
language plpgsql volatile security invoker as $$
declare
  v_code text;
begin
  update predictions set refunded_at = now()
   where id = p_prediction_id and invite_code is not null and status = 'failed' and refunded_at is null
  returning invite_code into v_code;
  if v_code is null then return false; end if;
  update invite_codes set used_runs = greatest(used_runs - 1, 0) where code = v_code;
  return true;
end $$;

-- Server only, like invite_codes and spend_ledger.
revoke execute on function filing_budget(numeric, numeric) from public, anon, authenticated;
revoke execute on function filing_status(text, numeric, numeric) from public, anon, authenticated;
revoke execute on function claim_filing(text, uuid, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function refund_filing(uuid) from public, anon, authenticated;
grant execute on function filing_budget(numeric, numeric) to service_role;
grant execute on function filing_status(text, numeric, numeric) to service_role;
grant execute on function claim_filing(text, uuid, text, numeric, numeric) to service_role;
grant execute on function refund_filing(uuid) to service_role;
```

- [ ] **Step 4: Apply the migration**

Run: `cd web && npx tsx --env-file=.env.local scripts/db/sql.ts supabase/migrations/20261010000008_filing_gate.sql`
Expected: a series of `ALTER`/`CREATE`/`REVOKE`/`GRANT` lines, then `done in … ms`.

- [ ] **Step 5: Run the check script to verify it passes**

Run: `cd web && npx tsx --env-file=.env.local scripts/try/gate-check.ts`
Expected: `gate-check: all checks passed`.
Then confirm cleanup: `npx tsx --env-file=.env.local scripts/db/sql.ts -c "select count(*) from invite_codes where note = 'gate-check'"` → `0`.

- [ ] **Step 6: Commit**

```bash
git add web/supabase/migrations/20261010000008_filing_gate.sql web/scripts/try/gate-check.ts
git commit -m "Filing gate in the database: invite codes, daily budget, claim and refund"
```

---

### Task 2: Filing rules and the cap setting

**Files:**
- Modify: `lib/env.ts`
- Create: `lib/env.test.ts`
- Modify: `lib/filing.ts`
- Create: `lib/filing.test.ts`
- Modify: `.env.example` (cap default), `.env.local` (set `DAILY_SPEND_CAP_USD=10`; owner's file, change that one value only)

**Interfaces:**
- Produces:
  - `lib/env.ts`: `DEFAULT_DAILY_CAP_USD = 10`; `parseCap(raw: string | undefined): number`; `env.dailySpendCapUsd(): number` (uses `parseCap`).
  - `lib/filing.ts`: `type GateReason = "ok" | "unknown" | "inactive" | "used_up" | "cap"`; `HOLD_USD = 2.5`; `CODE_RE`; `CODE_FORMAT_MESSAGE`; `normalizeCode(input: string): string`; `reasonMessage(reason: Exclude<GateReason, "ok">, maxRuns?: number | null): string`; `isCodeReason(r: unknown): boolean`; `Filing` gains `code: string`. `filingOpen` is removed.

- [ ] **Step 1: Write the failing tests**

Create `lib/env.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCap, DEFAULT_DAILY_CAP_USD } from "./env";

describe("parseCap", () => {
  it("uses the $10 default when the variable is missing or blank", () => {
    assert.equal(DEFAULT_DAILY_CAP_USD, 10);
    assert.equal(parseCap(undefined), 10);
    assert.equal(parseCap("  "), 10);
  });
  it("reads a number", () => {
    assert.equal(parseCap("10"), 10);
    assert.equal(parseCap("12.5"), 12.5);
    assert.equal(parseCap("0"), 0);
  });
  it("closes filing (0) rather than lifting the cap when the value is unreadable or negative", () => {
    assert.equal(parseCap("ten"), 0);
    assert.equal(parseCap("-5"), 0);
    assert.equal(parseCap("Infinity"), 0);
  });
});
```

Create `lib/filing.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CODE_RE, normalizeCode, reasonMessage, isCodeReason, HOLD_USD } from "./filing";

describe("normalizeCode", () => {
  it("accepts lowercase, spaces and missing dashes", () => {
    assert.equal(normalizeCode("bf-7q2k-m4xd"), "BF-7Q2K-M4XD");
    assert.equal(normalizeCode("BF7Q2KM4XD"), "BF-7Q2K-M4XD");
    assert.equal(normalizeCode(" bf 7q2k m4xd "), "BF-7Q2K-M4XD");
    assert.equal(normalizeCode("BF-7Q2KM4XD"), "BF-7Q2K-M4XD");
  });
  it("leaves something that isn't a code alone (upper-cased, trimmed) so the format check can explain", () => {
    assert.equal(normalizeCode(" bf-7q2k "), "BF-7Q2K");
    assert.equal(normalizeCode("hello"), "HELLO");
    assert.equal(normalizeCode(""), "");
  });
  it("produces strings CODE_RE accepts only when complete", () => {
    assert.ok(CODE_RE.test(normalizeCode("bf7q2km4xd")));
    assert.ok(!CODE_RE.test(normalizeCode("bf7q2km4x")));
  });
});

describe("reasonMessage", () => {
  it("words each refusal as the spec says", () => {
    assert.equal(reasonMessage("unknown"), "That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD.");
    assert.equal(reasonMessage("inactive"), "That invite code has been turned off.");
    assert.equal(reasonMessage("used_up", 3), "That invite code has used all 3 of its runs.");
    assert.equal(reasonMessage("used_up", null), "That invite code has used all of its runs.");
    assert.equal(reasonMessage("cap"), "Today's forecasting budget is spent. Filing reopens at midnight Eastern.");
  });
  it("tells code problems from budget problems", () => {
    assert.ok(isCodeReason("unknown") && isCodeReason("inactive") && isCodeReason("used_up"));
    assert.ok(!isCodeReason("cap") && !isCodeReason("ok") && !isCodeReason(undefined));
  });
  it("holds $2.50 per run in flight", () => assert.equal(HOLD_USD, 2.5));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx tsx --test lib/env.test.ts lib/filing.test.ts`
Expected: FAIL — `parseCap` and `normalizeCode` are not exported.

- [ ] **Step 3: Implement**

In `lib/env.ts`, add above `export const env` and change the cap line:

```ts
export const DEFAULT_DAILY_CAP_USD = 10;

// Missing or blank → the default. Unreadable or negative → 0, which closes filing rather than lifting the cap.
export function parseCap(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_CAP_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
```

```ts
  dailySpendCapUsd: () => parseCap(process.env.DAILY_SPEND_CAP_USD),
```

In `lib/filing.ts`: add `code: string;` to the `Filing` type (after `recused`), delete the last two lines (the `filingOpen` comment and export), and append:

```ts
// The filing gate (migration 8). Reasons come back from filing_status and claim_filing.
export type GateReason = "ok" | "unknown" | "inactive" | "used_up" | "cap";
export const HOLD_USD = 2.5; // held from the day's budget for each run in flight
export const CODE_RE = /^BF-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const CODE_FORMAT_MESSAGE = "Invite codes look like BF-7Q2K-M4XD. Check for a missing dash.";

// Accepts lowercase, spaces and missing dashes; anything else comes back trimmed and upper-cased.
export function normalizeCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 10 && raw.startsWith("BF") ? `BF-${raw.slice(2, 6)}-${raw.slice(6)}` : input.trim().toUpperCase();
}

export function reasonMessage(reason: Exclude<GateReason, "ok">, maxRuns: number | null = null): string {
  switch (reason) {
    case "unknown": return "That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD.";
    case "inactive": return "That invite code has been turned off.";
    case "used_up": return maxRuns == null ? "That invite code has used all of its runs." : `That invite code has used all ${maxRuns} of its runs.`;
    case "cap": return "Today's forecasting budget is spent. Filing reopens at midnight Eastern.";
  }
}

export const isCodeReason = (r: unknown) => r === "unknown" || r === "inactive" || r === "used_up";
```

In `.env.example`, change `DAILY_SPEND_CAP_USD=25` to `DAILY_SPEND_CAP_USD=10`. In `.env.local`, set `DAILY_SPEND_CAP_USD=10` (edit only that line).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test`
Expected: all suites pass, including the new `parseCap`, `normalizeCode` and `reasonMessage` tests. (`tsc` will fail until Task 3 removes the `filingOpen` imports; that's expected here.)

- [ ] **Step 5: Commit**

```bash
git add web/lib/env.ts web/lib/env.test.ts web/lib/filing.ts web/lib/filing.test.ts web/.env.example
git commit -m "Filing rules for invite codes and a cap that fails closed"
```

---

### Task 3: The gate in the server: routes, job failure, /new page

**Files:**
- Create: `lib/gate.ts`
- Modify: `app/api/filings/uploads/route.ts`
- Modify: `app/api/filings/route.ts`
- Modify: `inngest/predictCase.ts:23-26`
- Modify: `app/new/page.tsx`

**Interfaces:**
- Consumes: SQL functions from Task 1; `HOLD_USD`, `GateReason`, `normalizeCode`, `reasonMessage` from Task 2; `env.dailySpendCapUsd()`; `setStage(predictionId, stage, extra)` from `lib/pipeline.ts`; `serviceClient()` from `lib/supabase.ts`.
- Produces:
  - `filingStatus(db: SupabaseClient, code: string | null): Promise<{ reason: GateReason; maxRuns: number | null }>`
  - `claimFiling(db, code: string, caseId: string, phase: "before_argument" | "after_argument"): Promise<{ reason: GateReason; maxRuns: number | null; predictionId: string | null }>`
  - `refundFiling(db, predictionId: string): Promise<boolean>`
  - HTTP: both filing routes take `code` in the body; refusals return `403 { error, reason }`; a failed event send returns `502 { error }`.

- [ ] **Step 1: Write `lib/gate.ts`**

```ts
// The filing gate: invite codes and the daily budget, enforced in the database (migration 8; decisions.md Q18).
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { HOLD_USD, type GateReason } from "./filing";

type Row = { reason: GateReason; max_runs: number | null; prediction_id?: string | null };

export async function filingStatus(db: SupabaseClient, code: string | null) {
  const { data, error } = await db
    .rpc("filing_status", { p_code: code, p_cap: env.dailySpendCapUsd(), p_hold: HOLD_USD })
    .single<Row>();
  if (error || !data) throw new Error(`filing_status failed: ${error?.message ?? "no row"}`);
  return { reason: data.reason, maxRuns: data.max_runs };
}

export async function claimFiling(db: SupabaseClient, code: string, caseId: string, phase: "before_argument" | "after_argument") {
  const { data, error } = await db
    .rpc("claim_filing", { p_code: code, p_case_id: caseId, p_phase: phase, p_cap: env.dailySpendCapUsd(), p_hold: HOLD_USD })
    .single<Row>();
  if (error || !data) throw new Error(`claim_filing failed: ${error?.message ?? "no row"}`);
  return { reason: data.reason, maxRuns: data.max_runs, predictionId: data.prediction_id ?? null };
}

export async function refundFiling(db: SupabaseClient, predictionId: string) {
  const { data, error } = await db.rpc("refund_filing", { p_prediction_id: predictionId });
  if (error) throw new Error(`refund_filing failed: ${error.message}`);
  return data === true;
}
```

- [ ] **Step 2: Gate the upload route**

Replace `app/api/filings/uploads/route.ts` with:

```ts
// Step 1 of filing: checks the invite code and the day's budget, then hands the browser signed upload URLs
// so briefs go straight to Storage (Vercel caps request bodies at 4.5 MB; merits briefs are often larger).
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { normalizeCode, reasonMessage, storedName } from "@/lib/filing";
import { filingStatus } from "@/lib/gate";

const Body = z.object({
  code: z.string().max(40),
  files: z.array(z.object({ slot: z.enum(["pet", "resp", "amicus", "transcript"]), name: z.string().max(300) })).min(1).max(30),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const db = serviceClient();
  // Checked before any upload so a bad code or a spent budget fails fast; the run is claimed in step 2.
  const status = await filingStatus(db, normalizeCode(parsed.data.code)).catch(() => null);
  if (!status) return NextResponse.json({ error: "Could not prepare the upload. Try again." }, { status: 502 });
  if (status.reason !== "ok") {
    return NextResponse.json({ error: reasonMessage(status.reason, status.maxRuns), reason: status.reason }, { status: 403 });
  }

  const caseId = randomUUID();
  let amicus = 0;
  const uploads = [];
  for (const f of parsed.data.files) {
    const path = `${caseId}/${storedName(f.slot, f.slot === "amicus" ? amicus++ : 0, f.name)}`;
    const { data, error } = await db.storage.from("briefs").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: "Could not prepare the upload. Try again." }, { status: 502 });
    uploads.push({ slot: f.slot, path, token: data.token });
  }
  return NextResponse.json({ caseId, uploads });
}
```

- [ ] **Step 3: Gate the filing route**

In `app/api/filings/route.ts`:

1. Replace the import line `import { CURRENT_TERM, MIN_DESCRIPTION, filingOpen } from "@/lib/filing";` with:

```ts
import { CURRENT_TERM, MIN_DESCRIPTION, normalizeCode, reasonMessage } from "@/lib/filing";
import { claimFiling, refundFiling } from "@/lib/gate";
import { setStage } from "@/lib/pipeline";
```

2. Add `code: z.string().max(40),` to `Body` (after `recused`).
3. Delete the line `if (!filingOpen()) return NextResponse.json({ error: "Filing opens soon." }, { status: 403 });`.
4. Update the header comment to: `// Step 2 of filing: checks the filing, creates the case, claims a run against the invite code and the day's budget, and starts the Inngest job.`
5. Replace everything from `const { data: prediction, error } = await db` to the end of the function with:

```ts
  // The claim checks the code and the budget and creates the prediction in one transaction (migration 8).
  const phase = f.mode === "briefs" && f.transcriptPath ? "after_argument" : "before_argument";
  const claim = await claimFiling(db, normalizeCode(f.code), f.caseId, phase).catch(() => null);
  if (!claim || claim.reason !== "ok" || !claim.predictionId) {
    // Nothing is left behind for a refused filing: not the case, not its uploaded briefs.
    await db.from("cases").delete().eq("id", f.caseId);
    if (paths.length) await db.storage.from("briefs").remove(paths);
    if (!claim || claim.reason === "ok") return NextResponse.json({ error: "Could not file the case. Try again." }, { status: 500 });
    return NextResponse.json({ error: reasonMessage(claim.reason, claim.maxRuns), reason: claim.reason }, { status: 403 });
  }

  try {
    await inngest.send({ name: "case/predict.requested", data: { predictionId: claim.predictionId } });
  } catch {
    await setStage(claim.predictionId, "failed", { error: "The forecast couldn't be started." });
    await refundFiling(db, claim.predictionId);
    return NextResponse.json({ error: "The forecast couldn't be started, and your invite code wasn't charged. Try again." }, { status: 502 });
  }
  return NextResponse.json({ predictionId: claim.predictionId });
}
```

- [ ] **Step 4: Refund when a run fails**

In `inngest/predictCase.ts`, change the `onFailure` handler to:

```ts
    onFailure: async ({ event, error }) => {
      const predictionId = (event.data.event as Event).data.predictionId;
      await setStage(predictionId, "failed", { error: error.message.slice(0, 500) });
      await refundFiling(serviceClient(), predictionId); // a pipeline error shouldn't cost the filer a run; no-op for owner runs
    },
```

and add the imports `import { refundFiling } from "@/lib/gate";` and `import { serviceClient } from "@/lib/supabase";` (skip either if already imported; match the file's existing import style, relative or `@/`).

- [ ] **Step 5: Close the form when the budget is spent**

Replace `app/new/page.tsx` with:

```tsx
import type { Metadata } from "next";
import NewCaseForm from "@/components/NewCaseForm";
import { filingStatus } from "@/lib/gate";
import { serviceClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Forecast a case · Bench Forecast" };
export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  // If the check itself fails, leave the form open: the routes check again before anything is spent.
  const { reason } = await filingStatus(serviceClient(), null).catch(() => ({ reason: "ok" as const }));
  return <NewCaseForm open={reason === "ok"} />;
}
```

- [ ] **Step 6: Verify the routes against the dev server**

Typecheck first: `cd web && npx tsc --noEmit` — expected: errors only in `components/NewCaseForm.tsx` about `Filing.code` (fixed in Task 4). If other errors appear, fix them.

Make sure the Inngest dev server is **not** running (`lsof -i :8288` prints nothing), so no paid run can start; then start `npm run dev` if it isn't running. Create a test code:

```bash
npx tsx --env-file=.env.local scripts/db/sql.ts -c "insert into invite_codes (code, max_runs, note) values ('BF-TST3-0001', 1, 'route-check')"
```

a) Unknown code at step 1 → 403:
```bash
curl -s -X POST localhost:3000/api/filings/uploads -H 'content-type: application/json' -d '{"code":"bf-none-0000","files":[{"slot":"pet","name":"a.pdf"}]}'
```
Expected: `{"error":"That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD.","reason":"unknown"}`

b) Refused claim leaves no case (Review Focus 1):
```bash
ID=$(uuidgen | tr A-Z a-z)
curl -s -X POST localhost:3000/api/filings -H 'content-type: application/json' -d "{\"caseId\":\"$ID\",\"title\":\"Route check v. Test\",\"docket\":\"\",\"mode\":\"description\",\"briefPaths\":[],\"transcriptPath\":null,\"description\":\"$(printf 'x%.0s' {1..90})\",\"recused\":[],\"code\":\"BF-NONE-0000\"}"
npx tsx --env-file=.env.local scripts/db/sql.ts -c "select count(*) from cases where id = '$ID'"
```
Expected: the `unknown` 403, then count `0`.

c) Send failure refunds (Review Focus 4) — the claim succeeds, `inngest.send` fails because no dev server is listening:
```bash
ID=$(uuidgen | tr A-Z a-z)
curl -s -X POST localhost:3000/api/filings -H 'content-type: application/json' -d "{\"caseId\":\"$ID\",\"title\":\"Route check v. Test\",\"docket\":\"\",\"mode\":\"description\",\"briefPaths\":[],\"transcriptPath\":null,\"description\":\"$(printf 'x%.0s' {1..90})\",\"recused\":[],\"code\":\"bf tst3 0001\"}"
npx tsx --env-file=.env.local scripts/db/sql.ts -c "select p.status, p.refunded_at is not null as refunded, c.used_runs from predictions p join invite_codes c on c.code = p.invite_code where p.case_id = '$ID'"
```
Expected: `502` body `{"error":"The forecast couldn't be started, and your invite code wasn't charged. Try again."}`; row `failed | true | 0`. (This also proves the lowercase, spaced code was accepted.)
If the send unexpectedly succeeds (an Inngest server is reachable), stop: a paid run may have started. Check `lsof -i :8288` and tell the owner.

d) `/new` with the budget closed: set `DAILY_SPEND_CAP_USD=0` in `.env.local`, restart `npm run dev`, `curl -s localhost:3000/new | grep -c "Today's forecasting budget is spent"` → `1` after Task 4 (before Task 4 just confirm the page returns 200). Restore `DAILY_SPEND_CAP_USD=10` and restart.

Clean up:
```bash
npx tsx --env-file=.env.local scripts/db/sql.ts -c "delete from cases where title = 'Route check v. Test'; delete from invite_codes where note = 'route-check'"
```

- [ ] **Step 7: Commit**

```bash
git add web/lib/gate.ts web/app/api/filings web/inngest/predictCase.ts web/app/new/page.tsx
git commit -m "Gate filing on an invite code and the day's budget; refund failed runs"
```

---

### Task 4: Invite code in the filing form

**Files:**
- Modify: `components/NewCaseForm.tsx`

**Interfaces:**
- Consumes: `CODE_RE`, `CODE_FORMAT_MESSAGE`, `normalizeCode`, `reasonMessage`, `isCodeReason`, `Filing` (with `code`) from `lib/filing.ts`; route responses `{ error, reason }` from Task 3.

- [ ] **Step 1: Add state, validation and error routing**

1. Extend the `@/lib/filing` import with `CODE_RE, CODE_FORMAT_MESSAGE, normalizeCode, reasonMessage, isCodeReason`.
2. `ERROR_TARGETS`: add `code: "code"`.
3. After `const [serverError, …]` add:

```tsx
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null); // the server's verdict on the code, cleared on edit
```

4. In `validate()`, before `return e;`:

```tsx
    const c = normalizeCode(code);
    if (!c) e.code = "Filing a case needs an invite code.";
    else if (!CODE_RE.test(c)) e.code = CODE_FORMAT_MESSAGE;
```

5. Below `fail`, add:

```tsx
  // Code refusals belong on the code field; anything else goes in the summary.
  const refuse = (body: { error?: string; reason?: string }, fallback: string) => {
    if (!isCodeReason(body.reason)) return fail(body.error ?? fallback);
    setProgress(null);
    setCodeError(body.error ?? fallback);
    requestAnimationFrame(() => { summaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); summaryRef.current?.focus({ preventScroll: true }); });
  };
```

6. In `submit`: after `setServerError(null);` add `setCodeError(null);` and `const sendCode = normalizeCode(code);`. In the uploads fetch body use `JSON.stringify({ code: sendCode, files: … })`; replace its `if (!res.ok) return fail(body.error ?? "Could not prepare the upload. Try again.");` with `if (!res.ok) return refuse(body, "Could not prepare the upload. Try again.");`. Add `code: sendCode,` to the `filing` object; replace its `if (!res.ok) return fail(body.error ?? "Could not file the case. Try again.");` with `if (!res.ok) return refuse(body, "Could not file the case. Try again.");`.
7. After `if (serverError) errors.server = serverError;` add `if (codeError && !errors.code) errors.code = codeError;`.
8. In `ready`, add `code: CODE_RE.test(normalizeCode(code)),`.

- [ ] **Step 2: Add the field, the closed-state text and the checklist row**

In the "File it" section, replace the `{open ? (…) : (…)}` block with:

```tsx
            <div className="field">
              <label className="field-label" htmlFor="code">Invite code <span className="req">Required</span></label>
              <input id="code" className="text-input num code-input" value={code} placeholder="BF-0000-0000" maxLength={20}
                autoComplete="off" spellCheck={false} aria-invalid={!!errors.code} aria-describedby={errors.code ? "code-err" : undefined}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(null); }}
                onBlur={() => setCode((c) => normalizeCode(c))} />
              {errors.code && <span id="code-err" className="field-error">{errors.code}</span>}
            </div>
            {open ? (
              <p className="muted fine-line">Each forecast runs nine agents and costs a few dollars, so new filings share a daily budget. Once filed, it locks when the last vote is in and can&apos;t be changed.</p>
            ) : (
              <p className="warn-note" role="status">{reasonMessage("cap")}</p>
            )}
```

In the header paragraph, append ` Filing needs an invite code.` after `watch each vote land.`

In the "Your filing" list, after the briefs `<li>`, add:

```tsx
            <li className={ready.code ? "is-done" : ""}><CheckMark on={ready.code} className="sum-mark" /> Invite code</li>
```

- [ ] **Step 3: Typecheck, lint, test, build**

Run: `cd web && npx tsc --noEmit && npm run lint && npm test && npx next build`
Expected: no type or lint errors; all tests pass; build completes.

- [ ] **Step 4: Browser pass**

With `npm run dev` running and the Inngest dev server **not** running, open `http://localhost:3000/new` and check:
1. Submit with everything empty → the summary lists "Filing a case needs an invite code." and clicking it focuses the code field.
2. Type `bf7q2km4x` and tab out → field shows `BF7Q2KM4X`; submit → `Invite codes look like BF-7Q2K-M4XD. Check for a missing dash.`
3. Type `bf7q2km4xd`, tab out → `BF-7Q2K-M4XD`; checklist row "Invite code" ticks.
4. Description mode, valid title and description, code `BF-NONE-0000` → the field shows the "wasn't recognized" message; summary heading reads "Fix this to file the case".
5. Editing the code clears that message.
6. With `DAILY_SPEND_CAP_USD=0` (restart dev server), the page shows "Today's forecasting budget is spent. Filing reopens at midnight Eastern." and the button is disabled. Restore 10 and restart.
7. No console errors (dev overlay shows no issues).

Clean up any `cases` rows titled with the test titles you used.

- [ ] **Step 5: Commit**

```bash
git add web/components/NewCaseForm.tsx
git commit -m "Invite code field on the filing form"
```

---

### Task 5: The invite script

**Files:**
- Create: `lib/invite.ts`
- Create: `lib/invite.test.ts`
- Create: `scripts/admin/invite.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `CODE_RE`, `normalizeCode`, `HOLD_USD` from `lib/filing.ts`; `serviceClient()`; `env.dailySpendCapUsd()`; SQL `filing_budget`.
- Produces: `CODE_ALPHABET`, `newCode(rand?: (max: number) => number): string`, `type Command`, `parseArgs(argv: string[]): Command`, `USAGE`.

- [ ] **Step 1: Write the failing tests**

Create `lib/invite.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CODE_ALPHABET, newCode, parseArgs } from "./invite";
import { CODE_RE } from "./filing";

describe("newCode", () => {
  it("uses 32 easy-to-read characters: no 0, O, 1 or I", () => {
    assert.equal(CODE_ALPHABET.length, 32);
    assert.equal(new Set(CODE_ALPHABET).size, 32);
    for (const ch of "0O1I") assert.ok(!CODE_ALPHABET.includes(ch));
  });
  it("makes codes in the table's format", () => {
    for (let i = 0; i < 200; i++) assert.ok(CODE_RE.test(newCode()));
  });
  it("draws every character from the alphabet", () => {
    let n = 0;
    assert.equal(newCode(() => n++ % 32), "BF-ABCD-EFGH");
    assert.equal(newCode(() => 31), "BF-9999-9999");
  });
});

describe("parseArgs", () => {
  it("new: defaults to 3 runs and no note", () => {
    assert.deepEqual(parseArgs(["new"]), { kind: "new", runs: 3, note: null });
  });
  it("new: reads --runs and --note in any order", () => {
    assert.deepEqual(parseArgs(["new", "--note", "Sam, law school", "--runs", "5"]), { kind: "new", runs: 5, note: "Sam, law school" });
  });
  it("rejects bad run counts and unknown options", () => {
    assert.throws(() => parseArgs(["new", "--runs", "0"]), /whole number of runs/);
    assert.throws(() => parseArgs(["new", "--runs", "2.5"]), /whole number of runs/);
    assert.throws(() => parseArgs(["new", "--runs"]), /whole number of runs/);
    assert.throws(() => parseArgs(["new", "--colour", "blue"]), /Unknown option/);
  });
  it("on, off and runs take a code, normalized", () => {
    assert.deepEqual(parseArgs(["off", "bf7q2km4xd"]), { kind: "off", code: "BF-7Q2K-M4XD" });
    assert.deepEqual(parseArgs(["on", "BF-7Q2K-M4XD"]), { kind: "on", code: "BF-7Q2K-M4XD" });
    assert.deepEqual(parseArgs(["runs", "BF-7Q2K-M4XD", "6"]), { kind: "runs", code: "BF-7Q2K-M4XD", runs: 6 });
    assert.throws(() => parseArgs(["off"]), /is not an invite code/);
    assert.throws(() => parseArgs(["off", "hello"]), /is not an invite code/);
  });
  it("list and spend take nothing; anything else prints usage", () => {
    assert.deepEqual(parseArgs(["list"]), { kind: "list" });
    assert.deepEqual(parseArgs(["spend"]), { kind: "spend" });
    assert.throws(() => parseArgs([]), /Usage: npm run invite/);
    assert.throws(() => parseArgs(["delete", "BF-7Q2K-M4XD"]), /Usage: npm run invite/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx tsx --test lib/invite.test.ts`
Expected: FAIL — cannot find module `./invite`.

- [ ] **Step 3: Implement `lib/invite.ts`**

```ts
// Invite codes for the owner's script (scripts/admin/invite.ts): generating them and reading the command line.
import { randomInt } from "node:crypto";
import { CODE_RE, normalizeCode } from "./filing";

// 24 letters and 8 digits; 0, O, 1 and I are left out so codes read aloud cleanly.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(rand: (max: number) => number = randomInt): string {
  const four = () => Array.from({ length: 4 }, () => CODE_ALPHABET[rand(CODE_ALPHABET.length)]).join("");
  return `BF-${four()}-${four()}`;
}

export type Command =
  | { kind: "new"; runs: number; note: string | null }
  | { kind: "list" }
  | { kind: "spend" }
  | { kind: "on" | "off"; code: string }
  | { kind: "runs"; code: string; runs: number };

export const USAGE = `Usage: npm run invite -- <command>
  new [--runs N] [--note "who it's for"]   create a code (default 3 runs)
  list                                       every code and how much it has been used
  off CODE | on CODE                         turn a code off or back on
  runs CODE N                                change a code's run limit
  spend                                      today's spending against the cap`;

function runsArg(s: string | undefined): number {
  const n = Number(s);
  if (s === undefined || !Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error(`Expected a whole number of runs from 1 to 100, got "${s ?? ""}".\n\n${USAGE}`);
  }
  return n;
}

function codeArg(s: string | undefined): string {
  const code = normalizeCode(s ?? "");
  if (!CODE_RE.test(code)) throw new Error(`"${s ?? ""}" is not an invite code.\n\n${USAGE}`);
  return code;
}

export function parseArgs(argv: string[]): Command {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "new": {
      let runs = 3;
      let note: string | null = null;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--runs") runs = runsArg(rest[++i]);
        else if (rest[i] === "--note") note = rest[++i]?.trim() || null;
        else throw new Error(`Unknown option "${rest[i]}".\n\n${USAGE}`);
      }
      return { kind: "new", runs, note };
    }
    case "list":
    case "spend":
      return { kind: cmd };
    case "on":
    case "off":
      return { kind: cmd, code: codeArg(rest[0]) };
    case "runs":
      return { kind: "runs", code: codeArg(rest[0]), runs: runsArg(rest[1]) };
    default:
      throw new Error(USAGE);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx tsx --test lib/invite.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the script and the npm command**

Create `scripts/admin/invite.ts`:

```ts
// Manage invite codes and check the day's budget. Acts on the database in .env.local, which production shares.
//   npm run invite -- new --runs 3 --note "Sam, law school"
//   npm run invite -- list | off CODE | on CODE | runs CODE N | spend
import { env } from "../../lib/env";
import { HOLD_USD } from "../../lib/filing";
import { newCode, parseArgs, type Command } from "../../lib/invite";
import { serviceClient } from "../../lib/supabase";

const db = serviceClient();
const usd = (n: number) => `$${n.toFixed(2)}`;

async function run(cmd: Command) {
  switch (cmd.kind) {
    case "new": {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const { error } = await db.from("invite_codes").insert({ code, max_runs: cmd.runs, note: cmd.note });
        if (!error) {
          console.log(`${code}  (${cmd.runs} run${cmd.runs === 1 ? "" : "s"}${cmd.note ? `, ${cmd.note}` : ""})`);
          return;
        }
        if (error.code !== "23505") throw new Error(error.message); // 23505: that code exists already; draw another
      }
      throw new Error("Could not find an unused code after 5 tries.");
    }
    case "list": {
      const { data, error } = await db.from("invite_codes").select("code, note, used_runs, max_runs, active, created_at").order("created_at");
      if (error) throw new Error(error.message);
      if (!data.length) return console.log("No invite codes yet. Create one with: npm run invite -- new");
      console.table(data.map((c) => ({
        code: c.code, note: c.note ?? "", runs: `${c.used_runs} of ${c.max_runs}`, on: c.active ? "yes" : "no", created: String(c.created_at).slice(0, 10),
      })));
      return;
    }
    case "on":
    case "off": {
      const { data, error } = await db.from("invite_codes").update({ active: cmd.kind === "on" }).eq("code", cmd.code).select("code");
      if (error) throw new Error(error.message);
      if (!data.length) throw new Error(`There is no invite code ${cmd.code}.`);
      return console.log(`${cmd.code} is ${cmd.kind}.`);
    }
    case "runs": {
      const { data, error } = await db.from("invite_codes").update({ max_runs: cmd.runs }).eq("code", cmd.code).select("code, used_runs");
      if (error) throw new Error(error.message);
      if (!data.length) throw new Error(`There is no invite code ${cmd.code}.`);
      return console.log(`${cmd.code} now allows ${cmd.runs} run${cmd.runs === 1 ? "" : "s"} (${data[0].used_runs} used).`);
    }
    case "spend": {
      const cap = env.dailySpendCapUsd();
      const afterSpend = await db.rpc("filing_budget", { p_cap: cap, p_hold: 0 });
      const room = await db.rpc("filing_budget", { p_cap: cap, p_hold: HOLD_USD });
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const flight = await db.from("predictions").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]).gt("created_at", since);
      const err = afterSpend.error ?? room.error ?? flight.error;
      if (err) throw new Error(err.message);
      const inFlight = flight.count ?? 0;
      const left = Number(room.data);
      console.log(`Cap ${usd(cap)} (from .env.local; production reads its own DAILY_SPEND_CAP_USD)`);
      console.log(`Spent today ${usd(cap - Number(afterSpend.data))} · held ${usd(inFlight * HOLD_USD)} for ${inFlight} run${inFlight === 1 ? "" : "s"} in progress · room ${usd(left)}`);
      console.log(left >= HOLD_USD ? "Filing is open." : "Filing is paused until midnight Eastern.");
      return;
    }
  }
}

run(parseArgs(process.argv.slice(2))).catch((e) => { console.error((e as Error).message); process.exit(1); });
```

In `package.json` `scripts`, add after `roster:build`:

```json
    "invite": "tsx --env-file=.env.local scripts/admin/invite.ts"
```


- [ ] **Step 6: Try every command against the database**

```bash
cd web
npm run invite -- new --runs 2 --note "invite-script check"     # prints a BF- code; copy it as CODE
npm run invite -- list                                           # shows it: 0 of 2, on
npm run invite -- off CODE && npm run invite -- list             # on: no
npm run invite -- on CODE
npm run invite -- runs CODE 4                                    # "now allows 4 runs (0 used)"
npm run invite -- spend                                          # cap $10.00, spent, held, room, open/paused
npm run invite -- runs BF-NONE-0000 4                            # "There is no invite code BF-NONE-0000." exit 1
npm run invite -- frobnicate                                     # usage, exit 1
npx tsx --env-file=.env.local scripts/db/sql.ts -c "delete from invite_codes where note = 'invite-script check'"
```

Expected: each line behaves as commented. Then run `npm test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add web/lib/invite.ts web/lib/invite.test.ts web/scripts/admin/invite.ts web/package.json
git commit -m "Invite script: create, list, switch off and limit codes; show the day's spend"
```

---

### Task 6: Handoff docs and the deploy

**Files:**
- Create: `docs/deploy.md`
- Modify: `PROGRESS.md`
- Check: `components/MethodView.tsx` guardrails text (around line 231)

- [ ] **Step 1: Check the Method page still matches**

Read the "Cost and guardrails" list in `components/MethodView.tsx`. It should say filing needs an invite code and pauses once the day's budget is spent. If it does, change nothing. If it names a different cap or mechanism, correct it to match the spec.

- [ ] **Step 2: Write the owner's deploy checklist**

Create `docs/deploy.md`:

```markdown
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
```

- [ ] **Step 3: Update PROGRESS.md**

Replace the line `- ⏭ Next: phase 6 (invite codes, daily cap, deploy on Vercel Hobby with Fluid compute on; Q26).` with a "Phase 6" block in the same style as the Phase 5 block above it:

```markdown
Phase 6 — invite codes and the daily cap (2026-10-10):
- Migration 8: `filing_budget`, `filing_status`, `claim_filing` (checks the code and the budget and creates the prediction in one serialized transaction), `refund_filing` (failed runs give their use back, once). Cap $10/day (`DAILY_SPEND_CAP_USD`; missing → $10, unreadable → closed), $2.50 held per run in flight for 2 hours. `scripts/try/gate-check.ts` exercises them.
- Routes take an invite code; refusals clean up the case and its briefs; a failed event send or a failed run refunds. `/new` closes when the budget is spent. `filingOpen()`/`FILING_OPEN` removed.
- `npm run invite -- new|list|off|on|runs|spend`. Deploy checklist: `docs/deploy.md`.
- ⏭ Next: owner deploys per `docs/deploy.md`; then production checks and one real filing (~$2.30) with the owner's go-ahead; then phase 7 (scorecard).
```

- [ ] **Step 4: Commit**

```bash
git add docs/deploy.md PROGRESS.md web/components/MethodView.tsx
git commit -m "Phase 6 handoff: deploy checklist and progress notes"
```

(Omit `MethodView.tsx` from `git add` if Step 1 changed nothing.)

- [ ] **Step 5: Hand the deploy to the owner and wait**

Show the owner `docs/deploy.md`, ask them to push (or ask permission to push) so Vercel builds the latest `main`, and wait until they report the deployment URL. Do not proceed until they do.

- [ ] **Step 6: Production checks (after the owner deploys)**

With the URL they give (`$URL`):
```bash
for p in / /method /scorecard /new /runs/d0a83053-3db0-4bb9-870e-78d4821de419 /runs/d0a83053-3db0-4bb9-870e-78d4821de419/reasoning; do printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$URL$p"; done
curl -s -X POST "$URL/api/filings/uploads" -H 'content-type: application/json' -d '{"code":"BF-NONE-0000","files":[{"slot":"pet","name":"a.pdf"}]}'
curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/inngest"
```
Expected: every page `200`; the upload call returns the `unknown` 403 JSON; `/api/inngest` responds (200 for GET with the signing key set). Open `$URL` and `$URL/new` in the browser and confirm they render with no console errors.

- [ ] **Step 7: First real filing — only with the owner's explicit go-ahead (~$2.30)**

Ask first. If approved: `npm run invite -- new --runs 1 --note "first production filing"`, file a pending OT2026 case (or the owner's choice) on `$URL/new`, watch the run page fill in live, then confirm in the database: the prediction is `locked`, nine `justice_votes`, `spend_ledger` rows for it, and the code shows `1 of 1`.

- [ ] **Step 8: Update the wiki**

Follow the vault's "update the wiki" routine: entry page status (phase 6 done, deployed URL if live), history line, hot-cache next action. Commit and push the vault.
