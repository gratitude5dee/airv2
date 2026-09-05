-- Air Create (V11) MC4 Vibe — open a Create run atomically (§9.1).
--
-- The gateway attributes every `create-<tier>` completion to the owner's
-- one open Create run (agent_runs row labelled `create:<slug>`, trigger set,
-- ended_at null). The turn route kept that invariant with a read followed
-- by an insert, so two turns arriving together could both pass the read and
-- both open a row — spend then landed on whichever project inserted last.
--
-- The check and the insert now run under a per-owner transaction-scoped
-- advisory lock. The same critical section retires rows that never closed
-- cleanly, so they neither block the owner nor attract another run's spend:
-- an open row older than p_max_minutes (the relay never saw a terminal
-- event), and an open row still without hermes_run_id after
-- p_link_grace_minutes (the turn links the id once the Box is awake and the
-- run exists; the caller sets the grace above the bounded cold-wake time, so
-- a row unlinked past it belongs to a turn that failed and could not close
-- it either). A second turn on the *same* project while its run is open is
-- still admitted, as before.
--
-- Returns one row: (id, null) when a run row was opened, (null, label) when
-- another project's run blocks this one. Additive, forward-only.
create or replace function create_run_open(
  p_user_id uuid,
  p_trigger text,
  p_label text,
  p_max_minutes int,
  p_link_grace_minutes int
) returns table (id uuid, blocked_by text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('create_run_open'), hashtext(p_user_id::text));

  update agent_runs r
     set ended_at = now(), outcome = 'failed'
   where r.user_id = p_user_id
     and r.label like 'create:%'
     and r.trigger is not null
     and r.ended_at is null
     and (r.started_at < now() - make_interval(mins => p_max_minutes)
          or (r.hermes_run_id is null
              and r.started_at < now() - make_interval(mins => p_link_grace_minutes)));

  select r.label into v_open
    from agent_runs r
   where r.user_id = p_user_id
     and r.label like 'create:%'
     and r.trigger is not null
     and r.ended_at is null
   order by r.started_at desc
   limit 1;

  if v_open is not null and v_open <> p_label then
    return query select null::uuid, v_open;
    return;
  end if;

  insert into agent_runs (user_id, trigger, label)
  values (p_user_id, p_trigger, p_label)
  returning agent_runs.id into v_id;
  return query select v_id, null::text;
end;
$$;

revoke all on function create_run_open(uuid, text, text, int, int) from public;
grant execute on function create_run_open(uuid, text, text, int, int) to service_role;
