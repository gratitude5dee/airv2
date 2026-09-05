-- Air Create (V11) MC4 Vibe — create_run_open blocks on any other project's
-- open run, not only the newest.
--
-- 0095 read the newest open Create row and admitted the request when that
-- row carried the same label. Rows opened before 0095 (read-then-insert)
-- can overlap across projects, so the newest row matching the request could
-- hide an older open row of another project and a further row would open
-- while that project was still running. The check now looks for any open
-- row of a different project. Sweep, lock, return shape and grants are
-- unchanged. Additive, forward-only.
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
     and r.label <> p_label
   order by r.started_at desc
   limit 1;

  if v_open is not null then
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
