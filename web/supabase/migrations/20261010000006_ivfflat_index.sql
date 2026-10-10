-- Approximate search with an IVFFlat index. Exact search (migration 5) reads each vector out of TOAST storage
-- and took 6.3 s for Jackson's 4,804 passages on this instance; an index scan reads the copies stored in the index
-- pages instead. IVFFlat builds in little memory (the HNSW build did not fit, migration 4).
-- lists ≈ sqrt(rows); probes searched per query trades speed for recall; iterative scan keeps scanning lists
-- until enough rows pass the one-justice filter.
set statement_timeout = 0;
set maintenance_work_mem = '128MB';
set max_parallel_maintenance_workers = 0;

drop index if exists passages_embedding_idx;
create index passages_embedding_ivf on passages using ivfflat (embedding vector_cosine_ops) with (lists = 280);
analyze passages;

create or replace function match_passages(query_embedding vector(1024), for_justice text, match_count int default 12)
returns table (id uuid, document_id uuid, text text, similarity float)
language sql stable
set ivfflat.probes = 20
set ivfflat.iterative_scan = 'relaxed_order'
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
