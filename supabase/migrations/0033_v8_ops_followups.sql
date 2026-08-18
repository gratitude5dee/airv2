-- V8 review follow-up: per-fire schedule attribution on run receipts.
-- agent_schedules.last_run_at only keeps the most recent fire, so counting
-- schedule rows undercounts activity; the sweeper already writes one
-- agent_runs receipt per fire — stamp it with the schedule's source so ops
-- can count bot-sourced fires (and any other source) per fire.
alter table agent_runs add column schedule_source text;
