-- Per-user mini-app theme (design.md): a theme id from THEMES, chosen in the
-- Settings mini-app and applied to every first-party mini-app surface. The
-- id is data — renderers only ever see token values, so new themes are new
-- rows in the check list plus a THEMES entry.
alter table users
  add column miniapp_theme text not null default 'atmosphere'
    check (miniapp_theme in ('atmosphere','pixel'));
