-- IDT v2.3 persistent research runs and jobs (Full 100 queue).
create table if not exists research_runs (
  id               text primary key,
  universe_id      text,
  type             text not null default 'INITIAL_BATCH',
  status           text not null default 'QUEUED',
  total_jobs       integer not null default 0,
  completed_jobs   integer not null default 0,
  failed_jobs      integer not null default 0,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  model_versions   jsonb not null default '{}'::jsonb,
  payload          jsonb not null default '{}'::jsonb
);

create table if not exists research_jobs (
  id             text primary key,
  universe_id    text,
  company_id     text,
  ticker         text not null,
  run_id         text references research_runs(id) on delete cascade,
  status         text not null default 'NOT_RESEARCHED',
  attempt_count  integer not null default 0,
  failure_class  text,
  provider       text,
  last_error     text,
  created_at     timestamptz not null default now(),
  queued_at      timestamptz,
  started_at     timestamptz,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  payload        jsonb not null default '{}'::jsonb
);
create index if not exists research_jobs_run_status_idx on research_jobs (run_id, status);
create unique index if not exists research_jobs_run_ticker_idx on research_jobs (run_id, ticker);
