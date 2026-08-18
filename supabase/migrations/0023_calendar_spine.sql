-- V3: calendar sources + control-plane scheduled jobs (goal spec §7).
-- Metadata only (C4): no event titles, no ICS URLs, no tokens ever land here.
-- Event content lives in the box at ~/.hermes/calendar/events.json.

create table calendar_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  provider      text not null check (provider in ('google','apple_ics','calcom','email')),
  label         text,
  -- Composio account id / vault item id / calcom id. NEVER a URL with a secret.
  external_ref  text,
  -- calcom only; AES-256-GCM via lib/crypto/secretbox
  webhook_secret_sealed text,
  status        text not null default 'active' check (status in ('pending','active','error','revoked')),
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, provider, external_ref)
);
alter table calendar_accounts enable row level security;

-- User-visible scheduled jobs (§V3 rationale): control-plane fired, never
-- box cron — C12 gives box cron no path to the user's channels.
create table agent_schedules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  name          text not null,
  -- 5-field cron, evaluated in the user's timezone
  cron          text not null,
  timezone      text not null,
  -- box path .hermes/schedules/<id>.md — content stays in the box (C4)
  prompt_ref    text not null,
  deliver       text not null default 'imessage' check (deliver in ('imessage','email','none')),
  source        text not null default 'calendar' check (source in ('calendar','chat','bots')),
  status        text not null default 'active' check (status in ('active','paused','failed','deleted')),
  next_run_at   timestamptz not null,
  last_run_at   timestamptz,
  -- auto-pause at 5 consecutive failures, surface in Needs you
  failure_count int not null default 0,
  created_at    timestamptz not null default now()
);
create index on agent_schedules (next_run_at) where status = 'active';
alter table agent_schedules enable row level security;
