-- Air Create (V11) MC4 Vibe — docs/goal-create-v11.md §9, §14.1.
--
-- The Build Service compiles a Box workspace into a draft version. Builds
-- that outlive the request window are tracked here so the status route can
-- report them: state, a content-free log tail, the version they produced
-- and their findings — never a line of source (CR14). Create turns and
-- their gateway completions share an agent_runs label `create:<slug>` so a
-- project's spend is a sum over its own rows (§9.1 per-project budget).
-- Additive, forward-only. create_budget_usd and qa_score exist since 0083.

create table create_builds (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  lane text not null default 'vibe' check (lane in ('drop','vibe','import','push')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed')),
  -- ≤ 50 short progress lines: counts, sizes, rule ids. No file contents.
  log jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  sizes jsonb,
  version text check (version is null or version ~ '^v[0-9]{10,16}$'),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index create_builds_app_started_idx on create_builds (app_id, started_at desc);
create index create_builds_user_started_idx on create_builds (user_id, started_at desc);
alter table create_builds enable row level security;
create policy own_create_builds on create_builds
  for select using (user_id = auth.uid());

-- Preview QA (§9.6) posts a content-free summary beside qa_score: rule ids
-- that failed, min contrast, max LCP, off-origin count. Never DOM text.
alter table miniapp_versions add column qa_report jsonb;

-- Budget sums and active-run lookups filter on the Create label.
create index agent_runs_create_label_idx
  on agent_runs (user_id, label, started_at desc)
  where label like 'create:%';

-- Build, turn and QA join the Create ops ledger (§17) beside create.drop /
-- create.push.
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt',
  'build','build_failed','deploy_fn','fn_capped','rollback','import',
  'create.drop','create.push','create.build','create.turn','create.qa'
));
