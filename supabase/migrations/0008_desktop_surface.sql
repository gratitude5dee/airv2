-- Desktop surface (§7.4 Tier 1): a third client on the same `air-main` session.
-- The dashboard (9119) hosted route was already registered at provision time
-- but never persisted, so nothing server-side could reach it after a resume.
-- Both columns are SECRET, like hosted_url/hosted_token — boxes has no
-- user-facing RLS policy, service role only (C3).
alter table boxes add column dashboard_url text;    -- https://<sub>-9119.on.ascii.dev
alter table boxes add column dashboard_token text;  -- the ?_token= bearer. SECRET.

-- A paired desktop client. The pairing token is minted by the authenticated
-- owner and redeemed exactly once (pairing_jti unique); the row is the durable
-- half of the credential, so revoked_at kills every token issued to a device
-- without rotating DESKTOP_SIGNING_KEY.
create table desktop_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  pairing_jti  text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);
create index on desktop_devices (user_id) where revoked_at is null;

alter table desktop_devices enable row level security;
-- Default-deny; service role is the sole reader/writer.

-- Desktop-initiated runs are metered like every other surface.
alter table agent_runs drop constraint agent_runs_trigger_check;
alter table agent_runs add constraint agent_runs_trigger_check
  check (trigger in ('imessage','voice','web','desktop','email','cron'));
