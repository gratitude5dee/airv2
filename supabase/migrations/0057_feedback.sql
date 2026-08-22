-- In-air feedback: bug reports and feature requests submitted from the
-- feedback mini-app on the owner's phone, read by the operator dashboard at
-- admin.wzrd.tech. The title/body are the owner's own words about the product
-- (not agent messages, prompts, or memory — C4 stays intact). Forward-only.

create table feedback_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text check (kind in ('bug','feature')),
  title      text,
  body       text,
  status     text not null default 'open',
  created_at timestamptz not null default now()
);
create index on feedback_items (user_id, created_at desc);
create index on feedback_items (status, created_at desc);

-- Default deny like every other table; the control plane uses the service
-- role and the owner reads their own rows only.
alter table feedback_items enable row level security;
create policy own_feedback on feedback_items
  for select using (user_id = auth.uid());

insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values
  ('feedback', '/mini/feedback', 'render', '{feedback:write}', null,
   'Feedback', 'Report a bug or request a feature.',
   'private', 'single', 'published')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  access = excluded.access,
  status = excluded.status,
  updated_at = now();

alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback'
  ));

alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback'
  ));
