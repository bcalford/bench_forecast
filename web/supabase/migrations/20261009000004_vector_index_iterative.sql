-- Rebuild the vector index after the bulk embedding (it was dropped for the load), and make filtered search
-- complete: an approximate index finds nearest neighbours across all justices before the justice filter applies,
-- so without iterative scans a one-justice query can come back short. pgvector 0.8+ keeps scanning until it has
-- enough rows that pass the filter.
set statement_timeout = 0;                   -- this session only: the build takes several minutes
set maintenance_work_mem = '256MB';          -- fits the instance's shared memory (1GB failed with "No space left on device")
set max_parallel_maintenance_workers = 0;    -- a parallel build reserves shared memory for every worker up front

create index if not exists passages_embedding_idx on passages using hnsw (embedding vector_cosine_ops);

create or replace function match_passages(query_embedding vector(1024), for_justice text, match_count int default 12)
returns table (id uuid, document_id uuid, text text, similarity float)
language sql stable
set hnsw.iterative_scan = 'relaxed_order'
set hnsw.ef_search = 100
as $$
  with nearest as materialized (
    select p.id, p.document_id, p.text, p.embedding <=> query_embedding as distance
    from passages p
    where p.justice = for_justice and p.embedding is not null
    order by p.embedding <=> query_embedding
    limit match_count
  )
  select id, document_id, text, 1 - distance as similarity from nearest order by distance;
$$;
