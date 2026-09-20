-- Air × Muse (V13).
--
-- This is metadata-only. In particular, no table below may grow a column for
-- a Muse command, notification body, prompt, raw phone number, or credential.

create table muse_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  client_id    text not null,
  client_name  text,
  scopes       text[] not null default '{}',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index muse_grants_user_active_idx on muse_grants (user_id, created_at desc)
  where revoked_at is null;
-- There is one product-level Muse link per owner even if a client later
-- changes its toolkit label. Individual OAuth clients remain separate grants.
create unique index connections_one_muse_link_per_user_idx on connections (user_id)
  where provider = 'muse';
alter table muse_grants enable row level security;
create policy own_muse_grants on muse_grants for select using (user_id = auth.uid());

create table muse_events (
  id           bigserial primary key,
  user_id      uuid not null references users(id) on delete cascade,
  kind         text not null check (kind in ('notify','reply','pull','run','decision','grant','key','nudge')),
  agent        text,
  chars        integer,
  status       text,
  created_at   timestamptz not null default now(),
  check (agent is null or char_length(agent) <= 32),
  check (chars is null or chars >= 0),
  check (status is null or char_length(status) <= 48)
);
create index muse_events_user_created_idx on muse_events (user_id, created_at desc);
alter table muse_events enable row level security;
create policy own_muse_events on muse_events for select using (user_id = auth.uid());

alter table users
  add column muse_mode_until timestamptz,
  add column muse_settings jsonb not null default '{}'::jsonb;

alter table agent_schedules drop constraint agent_schedules_source_check;
alter table agent_schedules add constraint agent_schedules_source_check
  check (source in ('calendar','chat','bots','computer','muse'));

-- One row represents the product link; grants are the individual clients
-- allowed under it. The existing connection tuple enforces this uniqueness.
insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values
  ('muse', '/mini/muse', 'input', '{muse:read,muse:write}', null,
   'Muse', 'Connect and control Muse from your Air line.',
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

alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout','watch','muse'));

alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout','watch','muse'));

alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'crm_update','miniapp_publish','miniapp_backend',
                  'payment_request','shop_publish',
                  'trade_order','trade_cancel','trade_settings','muse_action'));
