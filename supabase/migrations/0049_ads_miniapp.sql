-- Phase 3 (redesign spec §4): Ads becomes a first-party mini-app. Owner-only
-- registry row (private visibility, single access) rendered by
-- lib/miniapps/apps/ads.tsx — the same decision-gated ad_writes flow: the
-- surface only proposes; approvals stay in Needs You. Forward-only.

insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values
  ('ads', '/mini/ads', 'render', '{ads:read,ads:write}', 'ad_write',
   'Ads', 'Your ad accounts and campaigns — every change is a proposal you approve first.',
   'private', 'single', 'published')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  access = excluded.access,
  status = excluded.status,
  updated_at = now();
