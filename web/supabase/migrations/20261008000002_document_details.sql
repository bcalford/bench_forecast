-- Per-opinion details the justice agents and citations need (phase 2).
alter table documents
  add column role        text check (role in ('majority', 'plurality', 'concurrence', 'concurrence_judgment',
                                              'dissent', 'concur_dissent', 'statement', 'argument', 'lower_court')),
  add column label       text,          -- running head as printed, e.g. "KAGAN, J., dissenting"
  add column docket      text,
  add column term        text,          -- e.g. "OT2024"
  add column page_start  integer,
  add column page_end    integer,
  add column source      text;          -- 'supremecourt.gov', 'courtlistener'

alter table passages
  add column ordinal integer not null default 0;  -- position within the document, for neighbouring context

create index documents_justice_kind_idx on documents (justice, kind);
