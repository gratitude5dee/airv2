-- V8 hardening: keep-awake schedule fires get their own receipt in the box
-- power ledger. 'ready' rows are written for every genuine wake (messages,
-- chat, cron, uploads), so counting them as keep-awake consumption would
-- inflate the schedule budget alarm; a distinct 'keepawake' row is written
-- only by the sweeper's keep-awake branch. The Screen sparkline reads only
-- ready/stopped edges.
alter table box_state_events drop constraint box_state_events_state_check;
alter table box_state_events add constraint box_state_events_state_check
  check (state in ('ready','stopped','keepawake'));
