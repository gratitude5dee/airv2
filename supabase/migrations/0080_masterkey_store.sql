-- MasterKey: x402 service catalog reachable from every box (via the
-- /api/mcp/masterkey proxy) and from the Store mini-app. MasterKey pays
-- providers from a per-user Sponge agent wallet; airv2 keeps identity, the
-- approval gate and the spend cap. No token is stored here — the connections
-- row is status only, and masterkey_runs is the per-user receipt ledger.
--
-- Was 0077_masterkey_store.sql: it shared its version with
-- 0077_vault_items_reconcile.sql, which Supabase branching rejects (one
-- schema_migrations row per version), and it never applied to production
-- because masterkey_runs already existed there. Every statement is
-- idempotent so it converges on both a fresh database and one that already
-- has the table.

-- ─── Store mini-app registry row ─────────────────────────────────────────────
insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description,
   visibility, access, status)
values
  ('masterkey', '/mini/masterkey', 'render', '{masterkey:run}', null,
   'Store', 'Browse ~2,000 pay-per-use AI services and run them from your wallet.',
   'private', 'single', 'published')
on conflict (slug) do update set
  route = excluded.route,
  kind = excluded.kind,
  scopes = excluded.scopes,
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  access = excluded.access,
  status = excluded.status,
  updated_at = now();

-- ─── per-run receipts ────────────────────────────────────────────────────────
create table if not exists masterkey_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  service_id    text not null,
  service_name  text,
  operation     text,
  -- Store-filed input (owner-typed JSON); proxy-side runs store none (C4).
  input         jsonb,
  source        text not null check (source in ('mcp','store')),
  status        text not null default 'pending'
                check (status in ('pending','approved','succeeded','failed','denied','unknown')),
  estimate_usd  numeric(12,6),
  cost_usd      numeric(12,6),
  result_text   text,
  error_code    text,
  latency_ms    int,
  decision_id   uuid references decisions(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists masterkey_runs_user_idx on masterkey_runs (user_id, created_at desc);

alter table masterkey_runs enable row level security;
drop policy if exists own_masterkey_runs on masterkey_runs;
create policy own_masterkey_runs on masterkey_runs
  for select using (user_id = auth.uid());

-- Box-originated MCP tool calls are metered like every other surface.
alter table agent_runs drop constraint if exists agent_runs_trigger_check;
alter table agent_runs add constraint agent_runs_trigger_check
  check (trigger in ('imessage','voice','web','desktop','email','cron','mcp'));
