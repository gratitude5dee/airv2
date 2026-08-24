-- Pairing-exchange attempts join the MA11 ops ledger so the unauthenticated
-- /api/berd/pair and /api/buzz/pair code exchanges get a durable per-source
-- throttle (berd.goal.md §MA-B2, buzz.goal.md §MA-Z2). ref holds a hashed
-- caller source, never a raw address; user_id stays null (the caller is
-- anonymous until the code resolves).
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt'
));

create index if not exists ops_events_kind_ref_idx
  on ops_events (kind, ref, created_at desc);
