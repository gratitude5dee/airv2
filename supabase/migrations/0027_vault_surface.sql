-- V2: Vault surface. The vault mini-app row (C15/C17 harness applies) and the
-- bring-your-own-manager status mirror. Manager rows hold PARSED SUMMARIES
-- ONLY (C23) — bootstrap tokens (BWS_ACCESS_TOKEN, OP_SERVICE_ACCOUNT_TOKEN,
-- command-helper text) live solely in the box .env / config; Postgres gets
-- status labels, counts, and timestamps.

insert into mini_apps (slug, route, kind, scopes, backing_tool) values
  ('vault', '/mini/vault', 'input', '{vault:read,vault:write}', null);

create table vault_managers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  manager       text not null check (manager in ('bitwarden','onepassword','command')),
  enabled       boolean not null default false,
  -- Value-free parsed status: 'off' | 'configured' | 'error'
  status        text not null default 'off' check (status in ('off','configured','error')),
  -- Count of provenance rows the source contributed at last fetch, if parsed.
  provenance_count int,
  -- Scrubbed, truncated warning/conflict lines from the latest apply report.
  warnings      text,
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, manager)
);

alter table vault_managers enable row level security;
create policy own_vault_managers on vault_managers for select using (user_id = auth.uid());
