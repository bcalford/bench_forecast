-- Keep invite codes off the public predictions table. Visitors read predictions with the anon key and
-- receive whole rows over Realtime, so migration 8's predictions.invite_code exposed every code that had
-- filed. The claim (which code paid for a run, and whether it was refunded) now lives in a server-only table.

create table filing_claims (
  prediction_id uuid primary key references predictions (id) on delete cascade,
  invite_code   text not null references invite_codes (code),
  refunded_at   timestamptz,                -- set once a failed run's use is returned to its code
  created_at    timestamptz not null default now()
);
alter table filing_claims enable row level security; -- no policy: server only, like invite_codes
revoke all on filing_claims from anon, authenticated;

insert into filing_claims (prediction_id, invite_code, refunded_at)
select id, invite_code, refunded_at from predictions where invite_code is not null;

alter table predictions drop column invite_code, drop column refunded_at;

create or replace function claim_filing(p_code text, p_case_id uuid, p_phase text, p_cap numeric, p_hold numeric)
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
  insert into predictions (case_id, phase) values (p_case_id, p_phase) returning id into new_id;
  insert into filing_claims (prediction_id, invite_code) values (new_id, p_code);
  return query select 'ok'::text, c.max_runs, new_id;
end $$;

create or replace function refund_filing(p_prediction_id uuid) returns boolean
language plpgsql volatile security invoker as $$
declare
  v_code text;
begin
  update filing_claims fc set refunded_at = now()
    from predictions p
   where fc.prediction_id = p_prediction_id and p.id = fc.prediction_id
     and p.status = 'failed' and fc.refunded_at is null
  returning fc.invite_code into v_code;
  if v_code is null then return false; end if;
  update invite_codes set used_runs = greatest(used_runs - 1, 0) where code = v_code;
  return true;
end $$;
