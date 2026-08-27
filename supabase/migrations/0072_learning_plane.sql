-- Air Learning Plane (goal.md V10 §19.1). Content-free by construction:
-- every column here is an opaque ID, bounded enum, version string, timestamp,
-- or aggregate number. Raw episodes, tasks, corrections, candidate bodies,
-- and profile bodies live only in the owner's Box (L1). Forward-only.

-- 1. Stable correlation: trace_id on the run ledger (no time-window joins).
alter table agent_runs add column trace_id text;
alter table agent_runs add column parent_trace_id text;
create index on agent_runs (trace_id);

-- 3. Typed feedback receipts. The enum and rating are content-free; any
-- free-text correction is forwarded to the Box and NEVER stored here.
create table run_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  trace_id    text not null,
  reason      text not null check (reason in (
                'worked','wrong_result','did_not_finish','missed_context',
                'unnecessary_question','unsafe_or_unapproved','too_slow',
                'too_expensive','style_or_preference','other')),
  rating      int check (rating between 1 and 5),
  delivery    text not null default 'pending'
              check (delivery in ('pending','forwarded','failed')),
  created_at  timestamptz not null default now()
);
create index on run_feedback (user_id, created_at desc);
create index on run_feedback (trace_id);

-- 4. Per-owner learning settings (§5 control modes). Private beta defaults
-- to 'observe'; 'auto_safe' stays unavailable until M8 + operator flag.
create table learning_settings (
  user_id             uuid primary key references users(id) on delete cascade,
  mode                text not null default 'observe'
                      check (mode in ('off','observe','suggest','auto_safe')),
  daily_budget_usd    numeric(10,2) not null default 1.00,
  retention_raw_days  int not null default 30 check (retention_raw_days between 1 and 365),
  schedule            text not null default 'idle_only'
                      check (schedule in ('idle_only','scheduled','manual')),
  updated_at          timestamptz not null default now()
);

-- 5. Content-free experiment receipts (aggregates only; per-trial rows stay
-- in the Box ledger).
create table learning_experiments (
  experiment_id  text primary key,
  user_id        uuid not null references users(id) on delete cascade,
  candidate_id   text,
  backend        text check (backend in ('native','hud','harbor')),
  status         text not null default 'queued'
                 check (status in ('queued','running','passed','failed','inconclusive','cancelled')),
  air_release    text,
  hermes_ref     text,
  os_class       text check (os_class in ('ubuntu','omarchy','macos')),
  served_model   text,
  sample_count   int,
  task_success_delta numeric(6,4),
  task_success_delta_lower95 numeric(6,4),
  hard_gate_failures int,
  tokens         bigint,
  cost_usd       numeric(10,6),
  latency_ms_p95 int,
  error_class    text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index on learning_experiments (user_id, created_at desc);

-- 6. Profile receipts: opaque IDs and lifecycle only — no profile body.
create table learning_profiles (
  profile_id        text primary key,
  user_id           uuid not null references users(id) on delete cascade,
  parent_profile_id text,
  candidate_id      text,
  status            text not null default 'inactive'
                    check (status in ('inactive','active','rolled_back','superseded')),
  tested_hermes_refs text[],
  activated_at      timestamptz,
  rolled_back_at    timestamptz,
  rollback_reason   text check (rollback_reason in (
                      'hard_gate','integrity_error','task_family_regression',
                      'owner_rejection','incompatible_update','kill_switch')),
  created_at        timestamptz not null default now()
);
create index on learning_profiles (user_id, created_at desc);

-- 7. Append-only content-free audit stream drained from each Box's
-- receipts outbox (air.learning-receipt.v1). Idempotent on (user, key).
create table learning_events (
  seq             bigint generated always as identity primary key,
  user_id         uuid not null references users(id) on delete cascade,
  idempotency_key text not null,
  event_type      text not null,
  trace_id        text,
  experiment_id   text,
  candidate_id    text,
  profile_id      text,
  status          text,
  backend         text,
  error_class     text,
  rollback_reason text,
  occurred_at     timestamptz not null,
  received_at     timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index on learning_events (user_id, seq desc);
create index on learning_events (event_type, occurred_at desc);

-- RLS: default deny, no policies — only the control plane's service role
-- reads or writes these tables (matches ops_events in 0043).
alter table run_feedback         enable row level security;
alter table learning_settings    enable row level security;
alter table learning_experiments enable row level security;
alter table learning_profiles    enable row level security;
alter table learning_events      enable row level security;
