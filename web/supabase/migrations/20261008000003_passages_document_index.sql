-- Replacing a document's passages (every ingest re-run) and cascading deletes look passages up by document.
-- Without this index each lookup scans the whole table and times out once it holds ~100k rows.
create index if not exists passages_document_idx on passages (document_id);
