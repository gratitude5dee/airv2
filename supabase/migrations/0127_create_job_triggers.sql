-- Air Create (V13) M3 — docs/goal-create-v13.md §10 follow-up.
--
-- The CreateJob Workflow opens Create runs with trigger='job' and posts
-- ops events 'create.job' (go) and 'create.notify' (terminal notify); both
-- were missing from the enum checks, which made every job die at the
-- brief step and dropped the audit rows. Widening is additive and safe.

alter table agent_runs drop constraint agent_runs_trigger_check;
alter table agent_runs add constraint agent_runs_trigger_check
  check (trigger in ('imessage','voice','web','desktop','email','cron','mcp','app','job'));

alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt','pay_link_checkout',
  'build','build_failed','deploy_fn','fn_capped','rollback','import',
  'create.drop','create.push','create.build','create.turn','create.qa',
  'create.job','create.notify',
  'fn_request','fn_secret','fn_rotate','fn_kill','fn_backend',
  'intake','plan','dev_release','dev_revoke','mirror'
));
