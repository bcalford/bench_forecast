-- Exact nearest-neighbour search per justice, replacing the approximate (HNSW) index.
-- Each search covers one justice's passages (at most ~20k rows), so ranking them exactly is fast once the
-- planner uses passages_justice_idx instead of scanning the whole table, and it is more accurate than an
-- approximate index. The HNSW build did not fit this instance's memory (1GB failed outright; 256MB fell back
-- to an on-disk build that ran for hours).

-- 1. Stop the slow index build if it is still running (no rows returned = nothing to stop).
select pg_cancel_backend(pid) from pg_stat_activity
where query ilike '%create index%passages_embedding_idx%' and pid <> pg_backend_pid();

-- 2. Remove the index if any part of it exists.
drop index if exists passages_embedding_idx;

-- 3. Search one justice's passages exactly. enable_seqscan = off steers the planner to the justice index.
create or replace function match_passages(query_embedding vector(1024), for_justice text, match_count int default 12)
returns table (id uuid, document_id uuid, text text, similarity float)
language sql stable
set enable_seqscan = off
as $$
  select p.id, p.document_id, p.text, 1 - (p.embedding <=> query_embedding) as similarity
  from passages p
  where p.justice = for_justice and p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
