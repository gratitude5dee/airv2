-- Fleet release channels: versioned template releases, dev/prod channel
-- pointers, and the one-button fleet-sync job ledger. A release is the
-- infra/template/ tree at a git SHA, packed once into an immutable R2
-- artifact; a channel points at a release; user boxes subscribe to a channel
-- and converge to its release via sync-box.sh (in place, never re-fork).
-- Artifacts carry no credentials (C2/C18: per-box keys are minted per fork
-- or locally by sync-box.sh). Forward-only and idempotent.

create table if not exists template_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  git_sha text not null,
  artifact_key text not null,
  checksum text not null,
  hermes_ref text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists box_channels (
  name text primary key check (name in ('dev', 'prod')),
  release_id uuid references template_releases(id),
  template_box_id text,
  updated_at timestamptz not null default now()
);

insert into box_channels (name) values ('dev'), ('prod')
on conflict (name) do nothing;

alter table boxes add column if not exists channel text not null default 'prod'
  check (channel in ('dev', 'prod'));
alter table boxes add column if not exists baseline_version text;
alter table boxes add column if not exists baseline_synced_at timestamptz;

create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(),
  channel text not null references box_channels(name),
  release_id uuid not null references template_releases(id),
  state text not null default 'canary'
    check (state in ('canary', 'rolling', 'paused', 'done', 'failed', 'aborted')),
  include_hermes boolean not null default false,
  wave_size int not null default 3,
  canary_box_ids text[] not null default '{}',
  failure_threshold int not null default 1,
  failures int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_job_boxes (
  job_id uuid not null references sync_jobs(id) on delete cascade,
  provider_box_id text not null,
  state text not null default 'pending'
    check (state in ('pending', 'syncing', 'ok', 'failed', 'skipped')),
  is_canary boolean not null default false,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  primary key (job_id, provider_box_id)
);

create index if not exists sync_job_boxes_state_idx
  on sync_job_boxes (job_id, state);
