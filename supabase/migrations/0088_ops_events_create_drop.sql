-- V11 MC2 (docs/goal-create-v11.md §8, CR16): Drop counts in the ops ledger
-- under its own kind so the dashboard can tell a staged Drop from a publisher
-- upload. Widening the check is the only schema Drop needs — the version row,
-- draft pointer, and findings column all landed in 0083.
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt',
  'build','build_failed','deploy_fn','fn_capped','rollback','import',
  'create.drop'
));
