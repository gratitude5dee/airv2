-- Air Create (V13) M2 — docs/goal-create-v13.md §10.
--
-- create_jobs: one row per CreateJob Workflow run — the durable build loop
-- that starts when the owner confirms a plan ("yes" → `air-create go`) or
-- asks for a change. The row mirrors what the Cloudflare job reports
-- through /api/internal/create/facts: state, step, percent, fix round,
-- version, dev_url and at most one rule/test id (error_rule). CF5 holds:
-- ids, counters, step names, rule ids, timings and percents only — never
-- prompt, plan, goal, findings text or code. Forward-only.

create table create_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  app_id          uuid not null references mini_apps(id) on delete cascade,
  intake_id       uuid references create_intakes(id) on delete set null,
  kind            text not null check (kind in ('initial','change')),
  state           text not null default 'queued'
                  check (state in ('queued','running','live','stuck','cancelled','superseded','failed')),
  step            text,
  step_started_at timestamptz,
  percent         smallint not null default 0 check (percent between 0 and 100),
  round           smallint not null default 0,
  workflow_id     text unique,
  version         text,
  dev_url         text,
  locked_test_ids text[] not null default '{}',
  error_rule      text,               -- a rule id or test id, never message text
  skill_ver       smallint,           -- x-air-skill the request carried (F10 handshake)
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  updated_at      timestamptz not null default now()
);

create index create_jobs_user_created_idx on create_jobs (user_id, created_at desc);

-- D8: one running job per owner. Queued rows coexist; a newer queued job for
-- the same app supersedes the older one inside the OwnerRoom, which then
-- marks the replaced row 'superseded'.
create unique index one_running_job_per_owner
  on create_jobs (user_id) where state = 'running';

alter table create_jobs enable row level security;

create policy own_jobs on create_jobs for select using (user_id = auth.uid());
