-- Air Create (V11) MC1 — docs/goal-create-v11.md §14.2.
--
-- Published apps gain immutable versions, an optional Functions backend, and
-- per-app runtime tokens. mini_apps.slug stays the flat <username>-<appname>
-- registry key (nested URLs are routing only); appname is denormalized so
-- the publisher page and per-app origins never re-split the slug. Content
-- stays out of Postgres (CR14): versions carry digests, sizes, findings and
-- pointers — bundles live in R2 / the vendor, source trees in the Box.
-- Forward-only.

-- 1. mini_apps: draft pointer, lane, backend flag, kit pin, budget.
alter table mini_apps
  add column appname text,
  add column draft_version text,
  add column lane text check (lane in ('drop','vibe','import','push')),
  add column functions_enabled boolean not null default false,
  add column kit_version text,
  add column create_budget_usd numeric(10,2) not null default 5.00
    check (create_budget_usd >= 0);

-- Usernames never contain a hyphen (0034 slug format), so the first hyphen
-- is always the boundary.
update mini_apps
   set appname = substr(slug, position('-' in slug) + 1)
 where owner_user_id is not null
   and appname is null
   and position('-' in slug) > 0;

alter table mini_apps add constraint mini_apps_appname_matches_slug
  check (
    owner_user_id is null
    or appname is null
    or right(slug, length(appname) + 1) = '-' || appname
  );

create unique index mini_apps_publisher_appname_idx
  on mini_apps (publisher_username, appname)
  where owner_user_id is not null;

-- 2. Immutable versions: one row per build, v<epoch>, digests only. Nothing
-- updates a row except published_at, retired_at, qa_score (§13.1) and the
-- purged_at tombstone the retention sweep sets before it deletes artifacts,
-- so a row can never point at storage that is already gone.
create table miniapp_versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  version text not null check (version ~ '^v[0-9]{10,16}$'),
  lane text not null check (lane in ('drop','vibe','import','push')),
  bundle_sha256 text not null check (bundle_sha256 ~ '^[0-9a-f]{64}$'),
  bundle_bytes bigint not null check (bundle_bytes >= 0),
  file_count integer not null check (file_count >= 0),
  worker_sha256 text check (worker_sha256 is null or worker_sha256 ~ '^[0-9a-f]{64}$'),
  kit_version text,
  findings jsonb not null default '[]'::jsonb,
  qa_score smallint check (qa_score is null or (qa_score >= 0 and qa_score <= 100)),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  purged_at timestamptz,
  unique (app_id, version)
);
create index miniapp_versions_app_idx on miniapp_versions (app_id, created_at desc);
create index miniapp_versions_purged_idx on miniapp_versions (purged_at)
  where purged_at is not null;
create index miniapp_versions_user_idx on miniapp_versions (user_id, created_at desc);

-- 3. Functions: one optional backend per app. Holds names and ids, never
-- secret values (CR6, §11.4) — those go browser → control plane → vendor.
create table miniapp_functions (
  app_id uuid primary key references mini_apps(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  script_name text not null unique,
  draft_script_name text not null unique,
  d1_database_id text,
  kv_namespace_id text,
  realtime boolean not null default false,
  egress text[] not null default '{}',
  secret_names text[] not null default '{}',
  ai_daily_cap_usd numeric(6,2) not null default 1.00
    check (ai_daily_cap_usd > 0 and ai_daily_cap_usd <= 5.00),
  ai_spent_today_usd numeric(10,4) not null default 0,
  ai_spend_day date,
  limits jsonb not null default '{"cpu_ms":50,"subrequests":20}'::jsonb,
  status text not null default 'disabled'
    check (status in ('disabled','draft','live','suspended')),
  approved_manifest jsonb,
  deployed_at timestamptz,
  last_error text
);
create index miniapp_functions_user_idx on miniapp_functions (user_id);

-- 4. Runtime tokens: the per-app credential the Outbound Worker injects.
-- Hashed at rest; rotation is a new row + revoked_at on the old one.
create table miniapp_runtime_tokens (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index miniapp_runtime_tokens_app_idx on miniapp_runtime_tokens (app_id);
create index miniapp_runtime_tokens_user_idx on miniapp_runtime_tokens (user_id);

-- RLS: no write policy anywhere; owner select where a user-facing read
-- exists; runtime tokens are service-role only.
alter table miniapp_versions enable row level security;
alter table miniapp_functions enable row level security;
alter table miniapp_runtime_tokens enable row level security;
create policy own_miniapp_versions on miniapp_versions
  for select using (user_id = auth.uid());
create policy own_miniapp_functions on miniapp_functions
  for select using (user_id = auth.uid());

-- 5. Backend enablement is a one-tap owner decision (CR4).
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'crm_update','miniapp_publish','miniapp_backend',
                  'payment_request','shop_publish'));

-- Card kinds: the Create progress card and the published-app card.
alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app'
  ));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app'
  ));

-- Inference from a Functions Worker meters as trigger='app' (CR8).
alter table agent_runs drop constraint agent_runs_trigger_check;
alter table agent_runs add constraint agent_runs_trigger_check
  check (trigger in ('imessage','voice','web','desktop','email','cron','mcp','app'));

-- 6. Plugin tokens gain scopes (P2).
alter table plugin_tokens add column scopes text[] not null default '{}';

-- 7. Create ledgers join the MA11 ops log (§17).
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt',
  'build','build_failed','deploy_fn','fn_capped','rollback','import'
));
