-- Home becomes a first-party mini-app (owner-only launcher rendered by
-- lib/miniapps/apps/home.tsx), so "open the home mini-app" sends a card
-- instead of pasting the app.wzrd.tech/home URL into chat. Forward-only.

insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values
  ('home', '/mini/home', 'render', '{home:read}', null,
   'Home', 'Your dashboard — every app, one tap away.',
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
    'settings','ads','home'
  ));

alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home'
  ));
