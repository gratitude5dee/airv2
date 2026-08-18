-- V5: Computer ▸ Browser — standing social-automation rules, the browser
-- passthrough mini-app, and the wave's new decision kinds (§7).
--
-- automation_rules is the control-plane side of C22: likes/reactions may run
-- under a standing rule, but the counter that enforces the daily cap lives
-- HERE (not in box memory) so it survives box restarts. No content columns —
-- what was liked/posted stays in the box; Postgres holds the count.
create table automation_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  playbook      text not null,                 -- 'social-engage', ...
  platform      text not null,
  enabled       boolean not null default false,
  daily_cap     int not null default 25,
  used_today    int not null default 0,
  last_reset_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, playbook, platform)
);
create index on automation_rules (user_id);

alter table automation_rules enable row level security;
-- Default deny: no policies. The control plane's service role bypasses RLS.

-- The browser mini-app: iMessage twin of the Browser subtab's live view,
-- riding the same desktop-stream redirect machinery as `computer` (C15/C16).
insert into mini_apps (slug, route, kind, scopes, backing_tool) values
  ('browser', '/mini/browser', 'passthrough', '{browser:view}', 'browser_exec');

-- Site-grant flips are audited like every other vault action (value-free:
-- item id + hostname in context).
alter table vault_events drop constraint vault_events_action_check;
alter table vault_events add constraint vault_events_action_check
  check (action in
         ('create','update','delete','reveal','fill_requested','fill_approved',
          'fill_denied','env_injected','manager_enabled','manager_disabled',
          'grant_site','revoke_site'));

-- Decision kinds for the vault/browser wave (§7): social_post (V5),
-- vault_fill/vault_reveal, and purchase_review (V6 consumes it).
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review'));

-- Browser-dispatched runs record which tool family they used (value-free
-- short name like 'browser_navigate') so the Activity panel can apply the
-- same isComputerTool prefix heuristic Chat uses. Never content.
alter table agent_runs add column label text;
