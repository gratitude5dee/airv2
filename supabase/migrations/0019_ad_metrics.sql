-- M14 task 5: one normalized daily-metrics table both providers land in.
-- OpenAI rows arrive by control-plane pull (cron, per-account API key);
-- Meta rows are pushed by the user's box (gateway_token-authenticated) and
-- validated as hostile input (C9). The unique key makes every ingest an
-- idempotent upsert.
create table ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  account_id uuid not null references ad_accounts(id) on delete cascade,
  provider text not null check (provider in ('meta','openai')),
  level text not null check (level in ('account','campaign','ad_group','ad')),
  entity_ref text not null,
  metric_date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend_cents integer not null default 0,
  conversions integer not null default 0,
  conversion_value_cents integer not null default 0,
  fetched_at timestamptz not null default now(),
  unique (account_id, level, entity_ref, metric_date)
);
create index on ad_metrics_daily (user_id, metric_date);
alter table ad_metrics_daily enable row level security;
create policy own_ad_metrics on ad_metrics_daily for select using (user_id = auth.uid());
