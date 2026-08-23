-- Per-user mini-app backdrop: a background id from BACKGROUNDS (React Bits
-- ports served from /creator-os/bg), chosen in the Settings mini-app next to
-- the theme. 'theme' keeps the theme's own backdrop. Validated app-side
-- (isBackgroundId) so adding an effect is a code change, not a migration.
alter table users
  add column miniapp_background text not null default 'theme';
