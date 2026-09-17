-- Air Create (V12) dev channel — docs/goal-create-v12.md §6, §14.2 item 2
-- (CR17/CR23).
--
-- A dev release is one version the owner promoted to
-- link.wzrd.tech/<u>/<a>, served by the `<slug>-dev` Worker: unlisted,
-- time-boxed, revocable. Postgres holds the pointer and its timestamps only
-- — the bundle lives on the app origin, the source in the Box. A Functions
-- app on dev gets its own D1/KV pair so dev traffic never touches
-- production data (§6.4); the ids here are vendor ids, never contents.

alter table mini_apps
  add column if not exists dev_version text,
  add column if not exists dev_released_at timestamptz,
  add column if not exists dev_expires_at timestamptz;
comment on column mini_apps.dev_version is
  'V12 CR17: the version served on link.wzrd.tech/<u>/<a> via <slug>-dev; null = no dev release.';
comment on column mini_apps.dev_expires_at is
  'V12 CR17: dev release expiry (released_at + CREATE_DEV_TTL_DAYS); the loader 404s past it.';

alter table miniapp_functions
  add column if not exists dev_script_name text unique,
  add column if not exists dev_d1_database_id text,
  add column if not exists dev_kv_namespace_id text;
comment on column miniapp_functions.dev_d1_database_id is
  'V12 §6.4: the dev channel''s own D1 (vendor id or pending marker); never the live database.';

-- ops_events kinds: intake/plan state changes (§8.1), dev release lifecycle
-- (§6.3) and the mirror commit (§10). Refs are slugs; no content.
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt','pay_link_checkout',
  'build','build_failed','deploy_fn','fn_capped','rollback','import',
  'create.drop','create.push','create.build','create.turn','create.qa',
  'fn_request','fn_secret','fn_rotate','fn_kill','fn_backend',
  'intake','plan','dev_release','dev_revoke','mirror'
));

-- The expiry sweep (lib/create/release.ts expireDevReleases) scans live dev
-- pointers by expiry; card_sends / miniapp_card_sessions kind checks are
-- unchanged (the `app` kind already exists).
create index if not exists mini_apps_dev_expires_idx
  on mini_apps (dev_expires_at) where dev_version is not null;
