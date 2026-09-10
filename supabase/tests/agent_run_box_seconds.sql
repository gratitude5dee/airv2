\set ON_ERROR_STOP on
begin;

-- Run against an empty disposable Postgres database.
create table public.agent_runs (
  id text primary key,
  hermes_run_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  box_seconds integer
);

insert into public.agent_runs values
  ('historical', 'run-old', '2026-09-10 10:00Z', '2026-09-10 10:01:30Z', null),
  ('gateway', null, '2026-09-10 10:00Z', '2026-09-10 10:01Z', null),
  ('explicit', 'run-explicit', '2026-09-10 10:00Z', '2026-09-10 10:01Z', 17),
  ('open', 'run-open', '2026-09-10 10:00Z', null, null),
  ('invalid', 'run-invalid', '2026-09-10 10:01Z', '2026-09-10 10:00Z', null);

\ir ../migrations/0104_agent_run_box_seconds.sql

do $$
begin
  assert (select box_seconds = 90 from agent_runs where id = 'historical'), 'backfill recorded duration';
  assert (select box_seconds is null from agent_runs where id = 'gateway'), 'exclude gateway receipts';
  assert (select box_seconds = 17 from agent_runs where id = 'explicit'), 'preserve explicit usage';
  assert (select box_seconds is null from agent_runs where id = 'open'), 'open duration is unknown';
  assert (select box_seconds is null from agent_runs where id = 'invalid'), 'reject reversed timestamps';
end;
$$;

update agent_runs set ended_at = '2026-09-10 10:02:00.001Z' where id = 'open';
insert into agent_runs values
  ('closed-insert', 'run-insert', '2026-09-10 10:00Z', '2026-09-10 10:00:03Z', null),
  ('empty-run', '', '2026-09-10 10:00Z', '2026-09-10 10:00:03Z', null),
  ('overflow', 'run-overflow', '1900-01-01', '2026-09-10', null);
update agent_runs set ended_at = '2026-09-10 10:05Z' where id = 'open';

do $$
begin
  assert (select box_seconds = 121 from agent_runs where id = 'open'), 'record completion once, round subsecond duration up';
  assert (select box_seconds = 3 from agent_runs where id = 'closed-insert'), 'meter completed inserts';
  assert (select box_seconds is null from agent_runs where id = 'empty-run'), 'require Hermes identity';
  assert (select box_seconds is null from agent_runs where id = 'overflow'), 'invalid duration cannot break receipts';
  assert (select sum(box_seconds) = 231 from agent_runs), 'aggregate completed runs without double-counting gateway calls';
end;
$$;

alter table agent_runs add column trigger text;
insert into agent_runs (id, hermes_run_id, started_at, ended_at, box_seconds, trigger) values
  ('legacy-schedule', 'run-cron-old', '2026-09-10 10:00Z', '2026-09-10 10:01:40Z', null, 'cron'),
  ('explicit-schedule', 'run-cron-explicit', '2026-09-10 10:00Z', '2026-09-10 10:01:40Z', 10, 'cron');

\ir ../migrations/0105_schedule_execution_duration.sql

insert into agent_runs (id, hermes_run_id, started_at, ended_at, box_seconds, trigger) values
  ('new-schedule', 'run-cron-new', '2026-09-10 10:01:30Z', '2026-09-10 10:01:40Z', 10, 'cron'),
  ('old-writer-schedule', 'run-cron-old-writer', '2026-09-10 10:00Z', '2026-09-10 10:01:40Z', null, 'cron'),
  ('web-run', 'run-web', '2026-09-10 10:01:30Z', '2026-09-10 10:01:40Z', null, 'web');

do $$
begin
  assert (select box_seconds is null from agent_runs where id = 'legacy-schedule'), 'discard wake-inclusive historical cron duration';
  assert (select box_seconds = 10 from agent_runs where id = 'explicit-schedule'), 'preserve distinct explicit cron measurement';
  assert (select box_seconds = 10 from agent_runs where id = 'new-schedule'), 'preserve new explicit execution duration';
  assert (select box_seconds is null from agent_runs where id = 'old-writer-schedule'), 'old cron writer remains unmetered during rollout';
  assert (select box_seconds = 10 from agent_runs where id = 'web-run'), 'other triggers still derive duration';
end;
$$;

rollback;
