-- IDT v2.1 domain model. JSON payloads keep engine results lossless.
create table if not exists companies (
  id           text primary key,
  ticker       text not null,
  exchange     text not null default '',
  company_name text not null default '',
  country      text not null default '',
  sector       text not null default '',
  industry     text not null default '',
  cohort       text,
  sample       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  payload      jsonb not null default '{}'::jsonb
);
create unique index if not exists companies_ticker_idx on companies (upper(ticker));

create table if not exists analyses (
  id               text primary key,
  company_id       text not null references companies(id) on delete cascade,
  as_of            timestamptz not null,
  created_at       timestamptz not null default now(),
  research_run_id  text,
  model_versions   jsonb not null default '{}'::jsonb,
  payload          jsonb not null
);
create index if not exists analyses_company_asof_idx on analyses (company_id, as_of desc);
create index if not exists analyses_created_idx on analyses (created_at);

create table if not exists evidences (
  id            text primary key,
  company_id    text,
  analysis_id   text,
  ticker        text,
  title         text,
  statement     text not null default '',
  evidence_type text not null default 'REPORTED',
  source_tier   text not null default 'TIER_3',
  source_type   text,
  source_name   text,
  source_url    text,
  published_at  text,
  retrieved_at  text,
  as_of_date    text,
  numeric_value double precision,
  unit          text,
  period        text,
  confidence    double precision,
  factor_targets jsonb,
  engine_targets jsonb,
  status        text not null default 'ACTIVE',
  payload       jsonb not null default '{}'::jsonb
);
create index if not exists evidences_company_idx on evidences (company_id);
create index if not exists evidences_analysis_idx on evidences (analysis_id);

create table if not exists universes (
  id         text primary key,
  name       text not null,
  version    integer not null default 1,
  market     text not null default 'GLOBAL',
  status     text not null default 'open',
  created_at timestamptz not null default now(),
  locked_at  timestamptz,
  payload    jsonb not null default '{}'::jsonb
);

create table if not exists universe_members (
  universe_id text not null references universes(id) on delete cascade,
  ticker      text not null,
  name        text,
  primary key (universe_id, ticker)
);

create table if not exists analysis_change_logs (
  id            text primary key,
  engine        text,
  model_version text,
  factor_id     text,
  snapshot_id   text,
  old_value     double precision,
  new_value     double precision,
  reason        text,
  user_override boolean not null default false,
  timestamp     timestamptz not null default now(),
  payload       jsonb not null default '{}'::jsonb
);

create table if not exists watchlist (
  company_id text primary key
);

create table if not exists app_kv (
  key   text primary key,
  value jsonb not null
);
