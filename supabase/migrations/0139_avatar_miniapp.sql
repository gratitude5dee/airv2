-- Avatar becomes a first-party mini-app: the FYE elemental casting stage
-- (avatar.wzrd.tech — Three.js stage + on-device MediaPipe hand tracking)
-- embedded full-bleed by lib/miniapps/apps/avatar.tsx, which delegates
-- camera/mic to the frame's origin so Hand mode works on every surface.
-- Public/single/published so it lists in the store (MA7) while staying
-- owner-only, matching the other first-party rows. No box-side state —
-- the stage keeps its own preferences on its own origin (C4, C17).
-- Forward-only and idempotent.

insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description,
   visibility, access, status, listed_at)
values
  ('avatar', '/mini/avatar', 'render', '{avatar:view}', null,
   'Avatar', 'The FYE elemental casting stage — draw a path, pinch to cast, or drive the caster with on-device hand tracking.',
   'public', 'single', 'published', now())
on conflict (slug) do update set
  route = excluded.route,
  kind = excluded.kind,
  scopes = excluded.scopes,
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  access = excluded.access,
  status = excluded.status,
  listed_at = coalesce(mini_apps.listed_at, excluded.listed_at),
  updated_at = now();
