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
