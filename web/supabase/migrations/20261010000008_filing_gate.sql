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
