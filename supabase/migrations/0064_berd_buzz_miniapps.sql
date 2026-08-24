-- Berd and Buzz become first-party mini-apps: owner-only control surfaces over
-- the user's own Berd desktop (berd.goal.md) and Buzz community (buzz.goal.md).
-- Both are private/single/render rows with plugin_signin_enabled so the view
-- can run the "draw from existing auth OR re-sign-in" flow; the pairing and
-- binding tables land with their own milestones (§MA-B2 / §MA-Z2). No agent,
-- project, channel, message, or key material is stored here — everything the
-- views render lives box-side in .hermes/miniapps/{berd,buzz}/ (C4, C18).
-- Forward-only and idempotent.

insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description,
   visibility, access, status, plugin_signin_enabled)
values
  ('berd', '/mini/berd', 'render', '{berd:manage}', null,
   'Berd', 'Manage your Berd agents, projects, and skills.',
   'private', 'single', 'published', true),
  ('buzz', '/mini/buzz', 'render', '{buzz:manage}', null,
   'Buzz', 'Manage your Buzz community, channels, and agents.',
   'private', 'single', 'published', true)
on conflict (slug) do update set
  route = excluded.route,
  kind = excluded.kind,
  scopes = excluded.scopes,
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  access = excluded.access,
  status = excluded.status,
  plugin_signin_enabled = excluded.plugin_signin_enabled,
  updated_at = now();
