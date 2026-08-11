-- CM7: personas are calendar sources on one spine. Moments become proposed
-- slots plus a 'content_plan' decision — the agent fills the calendar, the
-- human approves (CM7 task 4). Refs and status only (CC2): briefs live in
-- the decision payload, creative content stays in the box.

-- 'proposed' slots are invisible to the publish worker (it selects
-- 'scheduled'); approval of the plan flips them.
alter table content_slots drop constraint content_slots_status_check;
alter table content_slots add constraint content_slots_status_check
  check (status in ('proposed','scheduled','publishing','published','parked','cancelled'));

alter table content_slots add column source_id  text;
alter table content_slots add column moment_key text;

alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence'));

-- One row per moment a source has already proposed: the dedupe key that
-- keeps a replayed sweep from proposing the same launch twice.
create table calendar_moments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  source_id    text not null,
  moment_key   text not null,
  kind         text not null,
  occurs_at    timestamptz not null,
  decision_id  uuid references decisions(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (user_id, source_id, moment_key)
);
create index on calendar_moments (user_id, occurs_at);
alter table calendar_moments enable row level security;

-- Structured tour data the touring source reads (CM7 task 2). Each show is
-- city-scoped: the creative names the venue, the ad targets the metro.
create table tour_dates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  artist      text not null,
  venue       text not null,
  city        text not null,
  metro       text,
  country     text,
  event_at    timestamptz not null,
  on_sale_at  timestamptz,
  timezone    text not null,
  status      text not null default 'announced'
              check (status in ('announced','on_sale','played','cancelled')),
  created_at  timestamptz not null default now()
);
create index on tour_dates (user_id, event_at);
alter table tour_dates enable row level security;

-- ─── CM8 hardening ───────────────────────────────────────────────────────────

-- Per-user publish kill switch (the global one is PUBLISH_KILL_SWITCH in the
-- server env). Pausing skips the user's slots in the sweep without touching
-- them — flipping back resumes exactly where the calendar left off.
alter table users add column publish_paused boolean not null default false;

-- Platform-reported spend, one row per campaign per day: the reconciliation
-- ledger the control-plane exposure math is checked against (CM8 task 3).
create table spend_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  account_id   uuid not null references ad_accounts(id) on delete cascade,
  campaign_ref text not null,
  report_date  date not null,
  spend_cents  bigint not null,
  created_at   timestamptz not null default now(),
  unique (account_id, campaign_ref, report_date)
);
create index on spend_reports (user_id, report_date);
alter table spend_reports enable row level security;

-- Creative cost ledger rows (render spend observed from completed box jobs;
-- ad/storage are computed from their own tables) for the cost dashboard.
create table cost_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  kind         text not null check (kind in ('render','storage','ad')),
  amount_cents bigint not null,
  ref          text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index on cost_events (user_id, occurred_at);
alter table cost_events enable row level security;
