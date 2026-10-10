-- State the prediction job writes as it runs (phase 4 wiring), plus storage for the uploaded briefs.

alter table predictions
  add column stage text not null default 'queued'
    check (stage in ('queued', 'reading', 'summarizing', 'retrieving', 'deliberating', 'clerk', 'locked', 'failed')),
  add column as_of date,          -- leakage guard: only library documents dated before this are retrieved
  add column error text;          -- why a run failed, for the run page and for debugging

alter table cases
  add column argued_on date;      -- set when known; a forecast "after argument" uses the transcript in oa_transcript_path

-- Briefs and transcripts are uploaded here by the filing form (server-side, service-role key only).
insert into storage.buckets (id, name, public)
values ('briefs', 'briefs', false)
on conflict (id) do nothing;
