-- V11 MC7 Lane C — Import via the WZRD Tech Inc GitHub App
-- (docs/goal-create-v11.md §10, §14.1; CR4, CR9, CR16).
--
-- The control plane holds ids only: which App installation a user connected,
-- which repository+branch feeds which app, and which webhook deliveries it
-- has already seen. Access to the repository is a short-lived installation
-- token minted per request from the App's private key (an env secret) —
-- no user OAuth token, no installation token, and no key material is ever
-- stored here (CR6).

-- 1. One row per App installation a signed-in owner completed the setup
--    redirect for. `removed_at` is set from the `installation.deleted`
--    webhook (or by account deletion, which also uninstalls at GitHub); a
--    removed installation is never used again.
create table github_installations (
  installation_id bigint primary key,
  user_id uuid not null references users(id) on delete cascade,
  account_login text not null,
  account_type text not null check (account_type in ('User', 'Organization')),
  created_at timestamptz not null default now(),
  suspended_at timestamptz,
  removed_at timestamptz
);
create index github_installations_user_idx on github_installations (user_id);

-- 2. A repository (+branch, +subdirectory) linked to exactly one owned app.
--    mode `static`: the tree is the site; every push to the branch re-syncs
--    a draft. mode `build`: the repo builds in its own GitHub Actions run and
--    POSTs the output to /api/create/push with an Actions OIDC token; the
--    workflow file the owner accepted is recorded so the push can insist
--    the token came from it.
create table github_repo_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  installation_id bigint not null references github_installations(installation_id) on delete cascade,
  app_id uuid not null references mini_apps(id) on delete cascade,
  repo_id bigint not null,
  full_name text not null check (full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  branch text not null check (length(branch) between 1 and 255),
  dir text not null default '' check (dir !~ '(^|/)\.\.?(/|$)' and dir !~ '^/' and length(dir) <= 255),
  mode text not null check (mode in ('static', 'build')),
  workflow_path text check (workflow_path is null or workflow_path ~ '^\.github/workflows/[A-Za-z0-9_.-]+\.ya?ml$'),
  last_sha text check (last_sha is null or last_sha ~ '^[0-9a-f]{40}$'),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (app_id),
  unique (repo_id, branch, dir)
);
create index github_repo_links_user_idx on github_repo_links (user_id);
create index github_repo_links_repo_idx on github_repo_links (repo_id);

-- 3. Delivery dedupe: GitHub redelivers on any non-2xx and on operator
--    request; a delivery id already here acknowledges without reprocessing.
--    Rows older than a day are swept by /api/cron/sweep.
create table github_deliveries (
  delivery_id text primary key,
  event text not null,
  received_at timestamptz not null default now()
);
create index github_deliveries_received_idx on github_deliveries (received_at);

-- RLS: service role only for deliveries; owners may read their own
-- installations and links (the Create surface lists them). No write policy.
alter table github_installations enable row level security;
alter table github_repo_links enable row level security;
alter table github_deliveries enable row level security;
create policy own_github_installations on github_installations
  for select using (user_id = auth.uid());
create policy own_github_repo_links on github_repo_links
  for select using (user_id = auth.uid());

-- 4. A CI push is an upload (hourly budget) under its own kind, so the ops
--    dashboard can tell Actions traffic from owner uploads and Drops.
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt',
  'build','build_failed','deploy_fn','fn_capped','rollback','import',
  'create.drop','create.push'
));
