-- CM6: spend-gated ad adapters. Ad writes are proposals — every mutating
-- call lands in the "Needs you" queue as an 'ad_write' decision carrying the
-- exposure math (account, campaign, daily budget, 30-day exposure, the exact
-- requested changes). The control-plane spend ceiling is independent of any
-- platform-side limit; breaching it pauses campaigns and raises a
-- 'spend_ceiling' decision.

alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling'));
-- Structured approval-card fields (budget, exposure, changes). Routing
-- metadata only — never creative bodies (C4).
alter table decisions add column payload jsonb;

-- One row per connected ad account. Provider credentials never reach a
-- browser: the OpenAI Ads API key is sealed at rest (AES-256-GCM under
-- BOX_DASHBOARD_AUTH_KEY) and only ever ingested through the operator admin
-- route; Meta needs no stored credential — OAuth lives in the box's Meta Ads
-- MCP registration.
create table ad_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  provider         text not null check (provider in ('meta','openai')),
  account_ref      text not null,
  label            text,
  api_key_sealed   text,
  conversion_token text not null,
  status           text not null default 'active'
                   check (status in ('active','disconnected')),
  created_at       timestamptz not null default now(),
  unique (user_id, provider, account_ref)
);
create index on ad_accounts (user_id);
alter table ad_accounts enable row level security;

-- Mirror of campaign spend commitments the agent created/changed through us.
-- daily_budget_cents drives the committed-exposure math for the ceiling.
create table ad_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  account_id         uuid not null references ad_accounts(id) on delete cascade,
  campaign_ref       text not null,
  name               text,
  daily_budget_cents bigint not null default 0,
  status             text not null default 'active'
                     check (status in ('active','paused')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (account_id, campaign_ref)
);
create index on ad_campaigns (user_id, status);
alter table ad_campaigns enable row level security;

-- The durable record of a proposed write; the decision references it by id.
-- Nothing executes from state 'pending' — approval flips it to 'approved',
-- execution to 'executed'.
create table ad_writes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  account_id    uuid not null references ad_accounts(id) on delete cascade,
  kind          text not null check (kind in
                ('create_campaign','update_budget','set_status')),
  campaign_ref  text,
  args          jsonb not null default '{}',
  daily_budget_cents bigint,
  exposure_30d_cents bigint,
  status        text not null default 'pending' check (status in
                ('pending','approved','executed','failed','dismissed')),
  error         text,
  result        jsonb,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index on ad_writes (user_id, status);
alter table ad_writes enable row level security;

-- Hard control-plane spend ceiling per user. Fail closed: no row (or a zero
-- ceiling) means no ad write can be approved into spend.
create table ad_settings (
  user_id             uuid primary key references users(id) on delete cascade,
  spend_ceiling_cents bigint not null default 0,
  updated_at          timestamptz not null default now()
);
alter table ad_settings enable row level security;

-- Inbound conversion events, attributed to a creative ref so a conversion
-- shows up against the right creative in reporting.
create table ad_conversions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  account_id   uuid not null references ad_accounts(id) on delete cascade,
  creative_ref text not null,
  event        text not null,
  value_cents  bigint,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index on ad_conversions (user_id, creative_ref);
alter table ad_conversions enable row level security;
