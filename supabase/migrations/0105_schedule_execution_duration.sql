create or replace function public.record_agent_run_box_seconds()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.box_seconds is null and new.trigger is distinct from 'cron' then
    new.box_seconds := public.agent_run_duration_seconds(
      new.hermes_run_id, new.started_at, new.ended_at
    );
  end if;
  return new;
end;
$$;

-- Legacy cron timestamps include wake and prompt-loading time.
update public.agent_runs
set box_seconds = null
where trigger = 'cron'
  and box_seconds = public.agent_run_duration_seconds(
    hermes_run_id, started_at, ended_at
  );
