-- Bench Forecast: initial schema (spec.md §5).
-- Public visitors read forecasts through the anon key; everything else is written
-- server-side with the service-role key, which bypasses row-level security.

create extension if not exists vector;

-- ---------------------------------------------------------------- roster
create table justices (
  slug            text primary key,
  name            text not null,
  last_name       text not null,
  seniority_rank  smallint not null unique,      -- 1 = Chief Justice, then by date of commission
  appointed       date not null,
  active          boolean not null default true
);

-- ---------------------------------------------------------------- corpus
create table documents (
  id          uuid primary key default gen_random_uuid(),
  justice     text not null references justices (slug),
  kind        text not null check (kind in ('scotus_opinion', 'oral_argument', 'lower_court')),
  case_name   text not null,
  date        date,
  url         text not null,
  unique (justice, url)
);

-- voyage-3 family embeddings are 1024-dimensional.
create table passages (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents (id) on delete cascade,
  justice      text not null references justices (slug),
  text         text not null,
  embedding    vector(1024)
);
create index passages_justice_idx on passages (justice);
create index passages_embedding_idx on passages using hnsw (embedding vector_cosine_ops);

-- Nearest passages from one justice's own library, for a justice agent's retrieval.
create function match_passages(query_embedding vector(1024), for_justice text, match_count int default 12)
returns table (id uuid, document_id uuid, text text, similarity float)
language sql stable as $$
  select p.id, p.document_id, p.text, 1 - (p.embedding <=> query_embedding) as similarity
  from passages p
  where p.justice = for_justice and p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------- cases and forecasts
create table cases (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  docket                 text,
  term                   text not null,
  input_mode             text not null check (input_mode in ('briefs', 'description')),
  brief_paths            text[] not null default '{}',   -- Supabase Storage paths
  description            text,
  oa_transcript_path     text,
  recused                text[] not null default '{}',   -- justice slugs sitting out
  decided_before_cutoff  boolean not null default false, -- "not a fair test": kept off the scorecard
  created_at             timestamptz not null default now(),
  check (input_mode = 'briefs' or description is not null)
);

create table predictions (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references cases (id) on delete cascade,
  phase            text not null check (phase in ('before_argument', 'after_argument')),
  status           text not null default 'queued' check (status in ('queued', 'running', 'locked', 'failed')),
  locked_at        timestamptz,
  outcome          text,                       -- e.g. "Reversed and remanded", "Affirmed by an equally divided Court"
  majority_count   smallint,
  minority_count   smallint,
  author_pred      text references justices (slug),
  clerk_rationale  text,
  summary_json     jsonb,
  cost_usd         numeric(10, 4) not null default 0,
  created_at       timestamptz not null default now(),
  check (status <> 'locked' or locked_at is not null)
);
create index predictions_case_idx on predictions (case_id);

create table justice_votes (
  id               uuid primary key default gen_random_uuid(),
  prediction_id    uuid not null references predictions (id) on delete cascade,
  justice          text not null references justices (slug),
  vote             text not null check (vote in ('affirm', 'reverse', 'vacate_remand', 'other')),
  confidence       numeric(4, 3) not null check (confidence between 0 and 1),
  role             text not null check (role in ('majority', 'concur', 'concur_judgment', 'dissent')),
  brief_reason     text not null,
  detailed_reason  text not null,
  citations        jsonb not null default '[]',  -- each must name a passage the agent actually retrieved
  flagged          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (prediction_id, justice)
);

-- ---------------------------------------------------------------- outcomes and scoring
create table outcomes (
  case_id     uuid primary key references cases (id) on delete cascade,
  decided_at  date not null,
  outcome     text not null,
  votes       jsonb not null,                 -- { "<slug>": "affirm" | "reverse" | ... }
  author      text references justices (slug)
);

create table scores (
  prediction_id     uuid primary key references predictions (id) on delete cascade,
  outcome_correct   boolean not null,
  votes_correct     smallint not null,
  votes_total       smallint not null,
  majority_correct  smallint not null,
  author_correct    boolean
);

-- ---------------------------------------------------------------- gating and spend
create table invite_codes (
  code       text primary key check (code ~ '^BF-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  max_runs   integer not null default 3,
  used_runs  integer not null default 0 check (used_runs >= 0),
  active     boolean not null default true
);

create table spend_ledger (
  id             uuid primary key default gen_random_uuid(),
  prediction_id  uuid references predictions (id) on delete set null,
  model          text not null,
  input_tokens   integer not null,
  output_tokens  integer not null,
  cost_usd       numeric(10, 4) not null,
  created_at     timestamptz not null default now()
);
create index spend_ledger_created_idx on spend_ledger (created_at);

-- ---------------------------------------------------------------- row-level security
alter table justices      enable row level security;
alter table documents     enable row level security;
alter table passages      enable row level security;
alter table cases         enable row level security;
alter table predictions   enable row level security;
alter table justice_votes enable row level security;
alter table outcomes      enable row level security;
alter table scores        enable row level security;
alter table invite_codes  enable row level security;
alter table spend_ledger  enable row level security;

-- Visitors can read the roster, forecasts, outcomes and scores. Nothing is writable with the anon key.
-- documents, passages, invite_codes and spend_ledger have no anon policy: server-only.
create policy "public read" on justices      for select using (true);
create policy "public read" on cases         for select using (true);
create policy "public read" on predictions   for select using (true);
create policy "public read" on justice_votes for select using (true);
create policy "public read" on outcomes      for select using (true);
create policy "public read" on scores        for select using (true);

-- The run page fills in live as the job writes votes and locks the forecast.
alter publication supabase_realtime add table predictions, justice_votes;
