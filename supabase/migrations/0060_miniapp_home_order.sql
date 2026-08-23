-- Per-user Home launcher order: app slugs in the user's chosen order, saved
-- from the Home mini-app's press-and-hold rearrange mode. Empty array keeps
-- the default LAUNCH_ORDER. Validated app-side against published slugs.
alter table users
  add column miniapp_home_order jsonb not null default '[]'::jsonb;
