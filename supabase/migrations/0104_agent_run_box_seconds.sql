-- Recorded Hermes run duration, excluding the nested gateway usage receipts.
create or replace function public.agent_run_duration_seconds(
  run_id text,
  started_at timestamptz,
  ended_at timestamptz
) returns integer
language sql immutable
set search_path = public
as $$
  select case
    when nullif(run_id, '') is not null
      and ended_at >= started_at
      and ceil(extract(epoch from ended_at - started_at)) <= 2147483647
    then ceil(extract(epoch from ended_at - started_at))::integer
    else null
  end;
$$;

create or replace function public.record_agent_run_box_seconds()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.box_seconds is null then
    new.box_seconds := public.agent_run_duration_seconds(
      new.hermes_run_id, new.started_at, new.ended_at
    );
  end if;
  return new;
end;
$$;

create trigger agent_run_box_seconds
before insert or update of hermes_run_id, started_at, ended_at, box_seconds
on public.agent_runs
for each row execute function public.record_agent_run_box_seconds();

update public.agent_runs
set box_seconds = public.agent_run_duration_seconds(
  hermes_run_id, started_at, ended_at
)
where box_seconds is null
  and nullif(hermes_run_id, '') is not null
  and ended_at >= started_at;
