-- MA2: payments + plugin sign-in support tables.

-- Device-code sign-in (goal.md §MA2.4): a plugin (Codex / Claude Code) posts
-- /api/plugin/auth/start and gets {user_code, verification_uri, device_code};
-- the owner approves the user_code in Settings; the plugin polls
-- /api/plugin/auth/token with the device_code until a plugin_tokens bearer is
-- minted. Rows are short-lived and single-use.
create table plugin_device_codes (
  id uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique,
  user_code text not null unique,
  tool text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','denied','consumed')),
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz
);

create index plugin_device_codes_user_code_idx on plugin_device_codes (user_code);

alter table plugin_device_codes enable row level security;

-- Stripe webhook idempotency by event.id (goal.md §MA2.3) — same discipline
-- as inbound_events but keyed by the Stripe event id.
create table stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table stripe_events enable row level security;
