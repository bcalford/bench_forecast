-- Phase 7: which runs are which, a public budget that counts only invite runs, and the outcome review queue
-- (docs/superpowers/specs/2026-10-10-phase-7-scorecard-design.md §1–2).

alter table predictions
  add column origin text not null default 'owner' check (origin in ('invite', 'docket', 'owner'));
update predictions p set origin = 'invite' where exists (select 1 from filing_claims fc where fc.prediction_id = p.id);

-- The public cap counts invite runs only: the owner's docket batches and backtests have their own limits.
create or replace function filing_budget(p_cap numeric, p_hold numeric) returns numeric
language sql stable security invoker as $$
  select p_cap
    - coalesce((select sum(s.cost_usd) from spend_ledger s join predictions p on p.id = s.prediction_id
                where p.origin = 'invite'
                  and s.created_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')), 0)
    - p_hold * (select count(*) from predictions
                where origin = 'invite' and status in ('queued', 'running') and created_at > now() - interval '2 hours');
$$;

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
  insert into predictions (case_id, phase, origin) values (p_case_id, p_phase, 'invite') returning id into new_id;
  insert into filing_claims (prediction_id, invite_code) values (new_id, p_code);
  return query select 'ok'::text, c.max_runs, new_id;
end $$;

-- Today's spend (midnight America/New_York onward) by origin, for `npm run invite -- spend`.
create function spend_today_by_origin() returns table (origin text, usd numeric)
language sql stable security invoker as $$
  select coalesce(p.origin, 'none'), sum(s.cost_usd)
    from spend_ledger s left join predictions p on p.id = s.prediction_id
   where s.created_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')
   group by 1;
$$;
revoke execute on function spend_today_by_origin() from public, anon, authenticated;
grant execute on function spend_today_by_origin() to service_role;

-- The outcome review queue.
alter table outcomes
  add column status text not null default 'scored' check (status in ('scored', 'needs_review')),
  add column source_url text,
  add column notes text;
