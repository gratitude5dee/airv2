-- Migration 0106 — the compute-migration control plane (Box <-> Tenki).
--
-- One user still owns exactly one routing row in `boxes` (I1). Migration
-- state lives alongside it, never inside it:
--
--   tenant_control     per-user serialization row: routing_generation (bumped
--                      on every route commit), the admission flag every
--                      work-admission path consults, and the live migration
--                      marker. Its row lock orders "commit the route" against
--                      "admit new work".
--   compute_migrations the job record. A partial unique index enforces one
--                      non-terminal migration per user; `request_key` makes
--                      prepare idempotent for retrying operators.
--   migration_targets  role-keyed records (source / candidate / retained /
--                      active) carrying provider ids, staged manifests,
--                      integrity receipts, and the sealed credential
--                      envelope. The envelope is sealed under
--                      MIGRATION_SEAL_KEY with lib/crypto/secretbox (AES-256-
--                      GCM). It holds only box-scoped tokens minted for the
--                      candidate — never AIR_VAULT_KEY, never provider
--                      account credentials (C18).
--   tenant_operations  short leases taken by every work-admission path (chat
--                      turns, iMessage flushes, schedule runs, uploads,
--                      mini-app writes). A migration closes admission, drains
--                      these, then fences the box — leases are the drain
--                      accounting, the box-side mask is the hard barrier.
--   delivery_receipts  stable (user_id, kind, stable_id) receipts so a
--                      claimed schedule occurrence dedupes on
--                      (schedule_id, occurrence_time) across retries and
--                      migrations rather than on a fresh timestamp.
--
-- Multi-statement invariants (admit-vs-close, claim-under-admission, begin,
-- route commit, settle) live in security-definer RPCs so no PostgREST caller
-- can split them. Lock order everywhere: tenant_control -> boxes ->
-- compute_migrations.

create table tenant_control (
  user_id             uuid primary key references users(id) on delete cascade,
  routing_generation  bigint not null default 1,
  admission           text not null default 'open'
                      check (admission in ('open', 'closed')),
  -- 'mig:<uuid>' while a migration holds admission closed.
  admission_holder    text,
  active_migration_id uuid,
  -- Bumped once per admission close: the epoch a source fence is installed
  -- under, recorded in the box-side marker so a resumed source can prove the
  -- fence it reads belongs to this barrier.
  fence_epoch         bigint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table tenant_control enable row level security;

create table compute_migrations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  direction           text not null
                      check (direction in ('box_to_tenki', 'tenki_to_box')),
  phase               text not null default 'preflight' check (phase in (
                        'preflight', 'preparing', 'precopy',
                        'waiting_for_idle', 'quiescing', 'final_copy',
                        'route_committed', 'activating', 'observing',
                        'cleanup_pending', 'completed',
                        'cancelled', 'failed', 'recovery_required',
                        'return_requested', 'cleanup_failed', 'returned')),
  -- 'out' while moving user -> target provider; 'back' during returnToProvider
  -- after a commit (the same phase graph replays with roles swapped).
  leg                 text not null default 'out' check (leg in ('out', 'back')),
  request_key         text,
  source_provider     text not null,
  target_provider     text not null,
  -- Provider-side ids. source_box_id is what the boxes row pointed at when
  -- the migration began; the route commit refuses to run if it moved.
  source_box_id       text not null,
  candidate_box_id    text,
  -- Routing generation captured at begin; commit_migration_route asserts the
  -- control row still carries it, then bumps it. A stale expected value means
  -- some other path re-pointed the box mid-migration: the migration aborts
  -- instead of writing over it.
  expected_generation bigint not null,
  -- Drive lease: whichever invocation holds worker_token until
  -- worker_lease_until owns the state machine. Compare-and-swap on the row so
  -- a killed driver's successor cannot double-drive while it is alive.
  worker_token        text,
  worker_lease_until  timestamptz,
  -- Next scheduled drive (idle waits, observe window, retention deadline,
  -- retry backoff). The sweep picks rows where this is <= now().
  wake_at             timestamptz,
  -- Idempotent step journal: {step_name: {finished_at, ...receipt}}. Steps
  -- check their own receipt before doing external work, so a driver crash
  -- mid-phase replays harmlessly.
  steps               jsonb not null default '{}'::jsonb,
  manifest            jsonb,        -- classified inventory (metadata only)
  stats               jsonb,        -- pass counts, bytes, file counts
  verification        jsonb,        -- hash/integrity check receipts
  options             jsonb not null default '{}'::jsonb,
  error_code          text,
  error_detail        text,
  cancel_requested_at timestamptz,
  cleanup_approved_at timestamptz,  -- operator acceptance gate for delete
  work_paused_at      timestamptz,
  work_resumed_at     timestamptz,
  route_committed_at  timestamptz,
  activated_at        timestamptz,
  retention_until     timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table compute_migrations enable row level security;

-- One non-terminal migration per user. cancelled/failed are written only
-- after compensation has run, so they do not strand a user: a stuck
-- compensation lands in cleanup_failed / recovery_required instead, which
-- deliberately keep blocking new attempts until an operator resolves them.
create unique index compute_migrations_one_live
  on compute_migrations (user_id)
  where phase not in ('completed', 'cancelled', 'failed', 'returned');
create unique index compute_migrations_request_key
  on compute_migrations (user_id, request_key)
  where request_key is not null;
create index compute_migrations_due
  on compute_migrations (wake_at)
  where wake_at is not null
    and phase not in ('completed', 'cancelled', 'failed', 'returned');

create table migration_targets (
  migration_id    uuid not null references compute_migrations(id) on delete cascade,
  role            text not null
                  check (role in ('source', 'candidate', 'retained', 'active')),
  provider        text not null,
  provider_box_id text not null,
  hosted_url      text,
  -- secretbox-sealed JSON of the box-scoped credentials for this target
  -- (gateway token, api server key, dashboard password, hosted route token).
  -- Written at stage time; opened only inside the commit/return path.
  credentials_sealed text,
  manifest        jsonb,           -- last classified inventory for this box
  integrity       jsonb,           -- per-pass verification receipts
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (migration_id, role)
);
alter table migration_targets enable row level security;

create table tenant_operations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  kind          text not null check (kind in (
                  'turn', 'flush', 'schedule_run', 'upload',
                  'miniapp_write', 'wake', 'provision')),
  routing_generation bigint not null,
  holder        text not null,   -- run id, space id, lease id — for diagnosis
  detail        jsonb not null default '{}'::jsonb,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  finished_at   timestamptz
);
create index tenant_operations_active
  on tenant_operations (user_id) where finished_at is null;
alter table tenant_operations enable row level security;

create table delivery_receipts (
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null,     -- 'schedule_occurrence' today
  stable_id   text not null,     -- '<schedule uuid>@<due-time ISO>'
  state       text not null check (state in (
                'pending', 'running', 'held', 'completed', 'delivered', 'failed')),
  result_ref  text,              -- agent_runs.hermes_run_id etc.
  attempt     int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz,       -- hygiene sweep for finished rows
  primary key (user_id, kind, stable_id)
);
alter table delivery_receipts enable row level security;

-- ─── admit / complete ───────────────────────────────────────────────────────

-- Take an operation lease iff the tenant's admission is open. The
-- insert...select evaluates admission at statement execution, so a close that
-- commits first refuses the admit; a lease committed before the close is
-- visible to the migration's drain. Callers get {admitted, operation_id,
-- routing_generation} or {admitted:false, admission, holder}.
create or replace function public.admit_operation(
  p_user_id uuid,
  p_kind text,
  p_holder text,
  p_ttl_seconds int,
  p_detail jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ctl tenant_control%rowtype;
  v_op  tenant_operations%rowtype;
begin
  insert into tenant_control (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  insert into tenant_operations
    (user_id, kind, routing_generation, holder, expires_at, detail)
  select p_user_id, p_kind, tc.routing_generation, p_holder,
         now() + make_interval(secs => p_ttl_seconds), p_detail
  from tenant_control tc
  where tc.user_id = p_user_id and tc.admission = 'open'
  returning * into v_op;
  if not found then
    select * into v_ctl from tenant_control where user_id = p_user_id;
    return jsonb_build_object(
      'admitted', false,
      'admission', v_ctl.admission,
      'holder', v_ctl.admission_holder);
  end if;
  return jsonb_build_object(
    'admitted', true,
    'operation_id', v_op.id,
    'routing_generation', v_op.routing_generation);
end $$;
revoke all on function public.admit_operation(uuid, text, text, int, jsonb) from public;
grant execute on function public.admit_operation(uuid, text, text, int, jsonb) to service_role;

create or replace function public.complete_operation(p_key text)
returns void
language sql security definer set search_path = public
as $$
  -- p_key is either the operation id or its holder; both are unique per op.
  update tenant_operations
     set finished_at = now()
   where (id::text = p_key or holder = p_key)
     and finished_at is null;
$$;
revoke all on function public.complete_operation(text) from public;
grant execute on function public.complete_operation(text) to service_role;

-- Read-only check for mid-operation callers that never needed a lease of
-- their own (the wake funnel): true while the tenant admits work.
create or replace function public.admission_open(p_user_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select coalesce(
    (select admission = 'open' from tenant_control where user_id = p_user_id),
    true);
$$;
revoke all on function public.admission_open(uuid) from public;
grant execute on function public.admission_open(uuid) to service_role;

-- ─── claims gated on admission ──────────────────────────────────────────────

-- Advance a due schedule iff (a) the CAS on next_run_at still matches and
-- (b) the tenant's admission is open — checked in the same statement, so a
-- migration's close cannot race a claim. Occurrence identity is
-- (schedule_id, due time): a delivered/completed receipt for it means the
-- occurrence already ran (post-migration replay), so the claim advances the
-- schedule but reports duplicate=true and the caller must not run it. A
-- 'held' receipt is one the migration froze mid-run; re-claiming resumes it.
create or replace function public.claim_schedule(
  p_schedule_id uuid,
  p_expected_next_run_at timestamptz,
  p_next_run_at timestamptz,
  p_holder text,
  p_ttl_seconds int
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_admission text;
  v_receipt delivery_receipts%rowtype;
  v_stable_id text;
  v_claimed agent_schedules%rowtype;
  v_op_id uuid;
  v_duplicate boolean := false;
  v_has_receipt boolean := false;
begin
  select user_id into v_user_id from agent_schedules where id = p_schedule_id;
  if v_user_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'missing');
  end if;
  v_stable_id := p_schedule_id::text || '@' || p_expected_next_run_at::text;

  insert into tenant_control (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  select admission into v_admission
    from tenant_control where user_id = v_user_id;

  select * into v_receipt from delivery_receipts
   where user_id = v_user_id and kind = 'schedule_occurrence'
     and stable_id = v_stable_id;
  v_has_receipt := found;
  -- 'held' means the migration froze this occurrence mid-run and the resume
  -- step pointed the schedule back at it: this claim is the sanctioned
  -- replay, not a duplicate. Everything else finished or in flight stays
  -- claimed but is skipped by the caller.
  if v_has_receipt and v_receipt.state <> 'held' then
    v_duplicate := true;
  end if;

  update agent_schedules s
     set next_run_at = p_next_run_at, last_run_at = now()
   where s.id = p_schedule_id
     and s.status = 'active'
     and s.next_run_at = p_expected_next_run_at
     and exists (select 1 from tenant_control tc
                  where tc.user_id = s.user_id and tc.admission = 'open')
  returning * into v_claimed;
  if not found then
    return jsonb_build_object(
      'claimed', false,
      'reason', case when v_admission = 'closed'
                     then 'admission_closed' else 'lost' end);
  end if;

  if v_duplicate then
    return jsonb_build_object('claimed', true, 'duplicate', true,
                              'schedule', to_jsonb(v_claimed));
  end if;
  if v_has_receipt then
    update delivery_receipts
       set state = 'running', attempt = attempt + 1, updated_at = now()
     where user_id = v_user_id and kind = 'schedule_occurrence'
       and stable_id = v_stable_id;
  else
    insert into delivery_receipts (user_id, kind, stable_id, state)
    values (v_user_id, 'schedule_occurrence', v_stable_id, 'running');
  end if;
  -- The lease doubles as drain accounting for the migration's idle wait.
  insert into tenant_operations
    (user_id, kind, routing_generation, holder, expires_at)
  select v_user_id, 'schedule_run', tc.routing_generation, p_holder,
         now() + make_interval(secs => p_ttl_seconds)
    from tenant_control tc where tc.user_id = v_user_id
  returning id into v_op_id;

  return jsonb_build_object(
    'claimed', true,
    'duplicate', false,
    'schedule', to_jsonb(v_claimed),
    'operation_id', v_op_id);
end $$;
revoke all on function public.claim_schedule(uuid, timestamptz, timestamptz, text, int) from public;
grant execute on function public.claim_schedule(uuid, timestamptz, timestamptz, text, int) to service_role;

-- claim_flush mirrors the client-side CAS: stamps chain_started_at only while
-- run_at is unchanged AND admission is open, and takes the flush's operation
-- lease in the same statement. `attempts` is bumped only on a won claim so a
-- refused claim can't inflate backoff.
create or replace function public.claim_flush(
  p_space_id text,
  p_expected_run_at timestamptz,
  p_chain_started_at timestamptz,
  p_ttl_seconds int
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_admission text;
  v_job flush_jobs%rowtype;
  v_op_id uuid;
begin
  select user_id into v_user_id from flush_jobs where space_id = p_space_id;
  if v_user_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'missing');
  end if;
  insert into tenant_control (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  select admission into v_admission
    from tenant_control where user_id = v_user_id;

  update flush_jobs f
     set chain_started_at = p_chain_started_at
   where f.space_id = p_space_id
     and f.run_at = p_expected_run_at
     and exists (select 1 from tenant_control tc
                  where tc.user_id = f.user_id and tc.admission = 'open')
  returning f.* into v_job;
  if not found then
    return jsonb_build_object(
      'claimed', false,
      'reason', case when v_admission = 'closed'
                     then 'admission_closed' else 'lost' end);
  end if;

  insert into tenant_operations
    (user_id, kind, routing_generation, holder, expires_at)
  select v_user_id, 'flush', tc.routing_generation, p_space_id,
         now() + make_interval(secs => p_ttl_seconds)
    from tenant_control tc where tc.user_id = v_user_id
  returning id into v_op_id;
  return jsonb_build_object(
    'claimed', true,
    'chain_started_at', v_job.chain_started_at,
    'operation_id', v_op_id);
end $$;
revoke all on function public.claim_flush(text, timestamptz, timestamptz, int) from public;
grant execute on function public.claim_flush(text, timestamptz, timestamptz, int) to service_role;

-- ─── migration lifecycle ────────────────────────────────────────────────────

-- Begin a migration under the tenant_control lock. Refuses when another
-- migration is live, when a box replacement holds its claim, or when the
-- boxes row no longer points at p_source_box_id (the caller's view is stale —
-- nothing is written). Idempotent on (user_id, request_key): a retry returns
-- the live attempt instead of making a second.
create or replace function public.begin_migration(
  p_user_id uuid,
  p_direction text,
  p_request_key text,
  p_source_provider text,
  p_target_provider text,
  p_source_box_id text,
  p_replace_stale_before timestamptz
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ctl tenant_control%rowtype;
  v_box boxes%rowtype;
  v_mig compute_migrations%rowtype;
begin
  insert into tenant_control (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_ctl from tenant_control where user_id = p_user_id for update;

  select * into v_box from boxes where user_id = p_user_id;
  if v_box is null then
    return jsonb_build_object('ok', false, 'reason', 'no_box');
  end if;
  if v_box.provider_box_id is distinct from p_source_box_id then
    return jsonb_build_object(
      'ok', false, 'reason', 'stale_source',
      'current_box_id', v_box.provider_box_id);
  end if;
  if v_ctl.active_migration_id is not null then
    return jsonb_build_object(
      'ok', false, 'reason', 'migration_active',
      'migration_id', v_ctl.active_migration_id);
  end if;
  if v_box.replace_claimed_at is not null
     and v_box.replace_claimed_at >= p_replace_stale_before then
    return jsonb_build_object('ok', false, 'reason', 'replace_in_flight');
  end if;

  if p_request_key is not null then
    select * into v_mig from compute_migrations
     where user_id = p_user_id and request_key = p_request_key
       and phase not in ('completed', 'cancelled', 'failed', 'returned');
    if found then
      return jsonb_build_object(
        'ok', true, 'duplicate', true,
        'migration', to_jsonb(v_mig));
    end if;
  end if;

  insert into compute_migrations
    (user_id, direction, phase, request_key, source_provider, target_provider,
     source_box_id, expected_generation)
  values
    (p_user_id, p_direction, 'preflight', p_request_key, p_source_provider,
     p_target_provider, p_source_box_id, v_ctl.routing_generation)
  returning * into v_mig;

  update tenant_control
     set active_migration_id = v_mig.id, updated_at = now()
   where user_id = p_user_id;
  insert into migration_targets
    (migration_id, role, provider, provider_box_id, hosted_url)
  values
    (v_mig.id, 'source', p_source_provider, p_source_box_id, v_box.hosted_url);

  return jsonb_build_object('ok', true, 'migration', to_jsonb(v_mig));
end $$;
revoke all on function public.begin_migration(uuid, text, text, text, text, text, timestamptz) from public;
grant execute on function public.begin_migration(uuid, text, text, text, text, text, timestamptz) to service_role;

-- take over the replacement claim, refusing while a migration is live. Same
-- lock order as begin_migration: tenant_control then boxes.
create or replace function public.claim_replace(
  p_user_id uuid,
  p_box_id text,
  p_claimed_at timestamptz,
  p_stale_before timestamptz
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ctl tenant_control%rowtype;
  v_claimed text;
begin
  insert into tenant_control (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_ctl from tenant_control where user_id = p_user_id for update;
  if v_ctl.active_migration_id is not null then
    return jsonb_build_object(
      'claimed', false, 'reason', 'migration_active',
      'migration_id', v_ctl.active_migration_id);
  end if;
  update boxes set replace_claimed_at = p_claimed_at
   where user_id = p_user_id
     and provider_box_id = p_box_id
     and (replace_claimed_at is null or replace_claimed_at < p_stale_before)
  returning provider_box_id into v_claimed;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'replace_in_flight');
  end if;
  return jsonb_build_object('claimed', true);
end $$;
revoke all on function public.claim_replace(uuid, text, timestamptz, timestamptz) from public;
grant execute on function public.claim_replace(uuid, text, timestamptz, timestamptz) to service_role;

-- Close admission for a migration. Refuses unless the caller's migration is
-- the live one; bumps fence_epoch so the box-side barrier written this
-- barrier is distinguishable from any stale one.
create or replace function public.close_admission(
  p_migration_id uuid,
  p_expected_generation bigint
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ctl tenant_control%rowtype;
begin
  select tc.* into v_ctl from tenant_control tc
    join compute_migrations m on m.user_id = tc.user_id
   where m.id = p_migration_id for update of tc;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_control');
  end if;
  if v_ctl.active_migration_id is distinct from p_migration_id then
    return jsonb_build_object('ok', false, 'reason', 'not_holder');
  end if;
  if v_ctl.admission = 'closed' then
    -- Idempotent for the holder: a replayed close is a no-op.
    if v_ctl.admission_holder = 'mig:' || p_migration_id::text then
      return jsonb_build_object(
        'ok', true,
        'routing_generation', v_ctl.routing_generation,
        'fence_epoch', v_ctl.fence_epoch,
        'already_closed', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'already_closed');
  end if;
  if v_ctl.routing_generation is distinct from p_expected_generation then
    return jsonb_build_object('ok', false, 'reason', 'stale_generation');
  end if;
  update tenant_control
     set admission = 'closed',
         admission_holder = 'mig:' || p_migration_id::text,
         fence_epoch = fence_epoch + 1,
         updated_at = now()
   where user_id = v_ctl.user_id
  returning * into v_ctl;
  return jsonb_build_object(
    'ok', true,
    'routing_generation', v_ctl.routing_generation,
    'fence_epoch', v_ctl.fence_epoch);
end $$;
revoke all on function public.close_admission(uuid, bigint) from public;
grant execute on function public.close_admission(uuid, bigint) to service_role;

-- Reopen admission. Only the migration that closed it (or one that has since
-- taken the hold for a return leg) may reopen.
create or replace function public.open_admission(p_migration_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ctl tenant_control%rowtype;
begin
  update tenant_control tc
     set admission = 'open', admission_holder = null, updated_at = now()
    from compute_migrations m
   where m.id = p_migration_id
     and tc.user_id = m.user_id
     and tc.admission_holder = 'mig:' || p_migration_id::text
  returning tc.* into v_ctl;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_holder');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.open_admission(uuid) from public;
grant execute on function public.open_admission(uuid) to service_role;

-- The route commit. One transaction flips the boxes row to the candidate,
-- bumps routing_generation, flips target roles, and advances the migration —
-- or writes nothing. Every guard the plan lists lives here: admission closed
-- by this migration, generation unmoved, boxes row still pointing at the
-- source, migration parked in final_copy.
create or replace function public.commit_migration_route(
  p_migration_id uuid,
  p_from_box_id text,
  p_expected_generation bigint,
  p_route jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mig compute_migrations%rowtype;
  v_ctl tenant_control%rowtype;
  v_box_id text;
  v_new_gen bigint;
begin
  select * into v_mig from compute_migrations where id = p_migration_id;
  if v_mig is null then
    return jsonb_build_object('ok', false, 'reason', 'no_migration');
  end if;
  select * into v_ctl from tenant_control
   where user_id = v_mig.user_id for update;
  if v_ctl.active_migration_id is distinct from p_migration_id
     or v_ctl.admission <> 'closed'
     or v_ctl.admission_holder is distinct from 'mig:' || p_migration_id::text then
    return jsonb_build_object('ok', false, 'reason', 'admission_not_held');
  end if;
  -- The driver passes the generation it expects for this leg: expected_generation
  -- on the way out, +1 on the way back. Anything else means another path
  -- re-pointed the box and the commit must not write over it.
  if v_ctl.routing_generation is distinct from p_expected_generation then
    return jsonb_build_object('ok', false, 'reason', 'stale_generation');
  end if;
  if v_mig.phase <> 'final_copy' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_phase',
                             'phase', v_mig.phase);
  end if;

  update boxes set
    provider         = p_route ->> 'provider',
    provider_box_id  = p_route ->> 'provider_box_id',
    environment      = coalesce(p_route ->> 'environment', environment),
    state            = coalesce(p_route ->> 'state', 'ready'),
    hosted_url       = p_route ->> 'hosted_url',
    hosted_token     = p_route ->> 'hosted_token',
    dashboard_url    = p_route ->> 'dashboard_url',
    dashboard_token  = p_route ->> 'dashboard_token',
    dashboard_auth   = p_route ->> 'dashboard_auth',
    control_url      = p_route ->> 'control_url',
    control_token    = p_route ->> 'control_token',
    api_server_key   = p_route ->> 'api_server_key',
    gateway_token    = p_route ->> 'gateway_token',
    template_version = p_route ->> 'template_version',
    channel          = coalesce(p_route ->> 'channel', channel),
    baseline_version = p_route ->> 'baseline_version',
    baseline_synced_at = (p_route ->> 'baseline_synced_at')::timestamptz,
    provider_name    = coalesce(p_route ->> 'provider_name', provider_name),
    stop_after       = null,
    replace_claimed_at = null,
    last_active_at   = now()
  where user_id = v_mig.user_id
    and provider_box_id = p_from_box_id
  returning provider_box_id into v_box_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'route_moved');
  end if;

  v_new_gen := v_ctl.routing_generation + 1;
  update tenant_control
     set routing_generation = v_new_gen, updated_at = now()
   where user_id = v_mig.user_id;
  update compute_migrations
     set phase = 'route_committed', route_committed_at = now(), updated_at = now()
   where id = p_migration_id;
  if v_mig.leg = 'out' then
    update migration_targets set role = 'retained', updated_at = now()
     where migration_id = p_migration_id and role = 'source';
    update migration_targets set role = 'active', updated_at = now()
     where migration_id = p_migration_id and role = 'candidate';
  else
    -- return leg: the previously-active side is retained again.
    update migration_targets set role = 'retained', updated_at = now()
     where migration_id = p_migration_id and role = 'active';
    update migration_targets set role = 'active', updated_at = now()
     where migration_id = p_migration_id and role = 'retained';
  end if;
  return jsonb_build_object(
    'ok', true, 'routing_generation', v_new_gen);
end $$;
revoke all on function public.commit_migration_route(uuid, text, bigint, jsonb) from public;
grant execute on function public.commit_migration_route(uuid, text, bigint, jsonb) to service_role;

-- Terminal settle: mark the migration's final phase and clear the
-- tenant_control hold in one transaction. p_reopen controls admission —
-- 'recovery_required' deliberately keeps admission closed until an operator
-- resolves the account.
create or replace function public.settle_migration(
  p_migration_id uuid,
  p_phase text,
  p_reopen boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mig compute_migrations%rowtype;
begin
  select * into v_mig from compute_migrations where id = p_migration_id;
  if v_mig is null then
    return jsonb_build_object('ok', false, 'reason', 'no_migration');
  end if;
  update compute_migrations
     set phase = p_phase,
         completed_at = case
           when p_phase in ('completed', 'cancelled', 'failed', 'returned')
           then now() else completed_at end,
         updated_at = now()
   where id = p_migration_id;
  -- The tenant hold releases only at a terminal phase; recovery_required /
  -- cleanup_failed keep it so replacements and new migrations stay locked
  -- out until an operator resolves the account.
  update tenant_control tc
     set active_migration_id = case
           when p_phase in ('completed', 'cancelled', 'failed', 'returned')
           then null else tc.active_migration_id end,
         admission = case when p_reopen then 'open' else tc.admission end,
         admission_holder = case when p_reopen then null else tc.admission_holder end,
         updated_at = now()
   where tc.user_id = v_mig.user_id
     and tc.active_migration_id = p_migration_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.settle_migration(uuid, text, boolean) from public;
grant execute on function public.settle_migration(uuid, text, boolean) to service_role;
