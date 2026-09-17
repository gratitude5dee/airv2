-- Air Create (V12) stage attribution — docs/goal-create-v12.md §7.3,
-- §14.2 item 4 (CR18).
--
-- A Create turn names its role in the model request
-- (`create-<tier>:<slug>#<stage>`); the gateway strips the suffix before
-- resolution and stamps it on the completion's agent_runs receipt so the
-- admin Tokens page (§12) can group Astra (plan/finalize) and GLM
-- (build/review) spend. A role name only — never a prompt or a reply.
-- agent_runs keeps its existing RLS. Forward-only.

alter table agent_runs
  add column if not exists create_stage text
    check (create_stage in ('plan', 'build', 'review', 'finalize'));

comment on column agent_runs.create_stage is
  'V12 §7.3: the Create role this completion served (plan|build|review|finalize); null for every other run.';

-- The Tokens page groups one owner's Create spend by stage over a time window.
create index if not exists agent_runs_user_create_stage_started_idx
  on agent_runs (user_id, create_stage, started_at desc)
  where create_stage is not null;
