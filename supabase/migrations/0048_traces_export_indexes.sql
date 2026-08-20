-- P1-6: traces export pages each source per user ordered by timestamp
-- (lib/traces/receipts.ts); without these indexes every export is a full
-- scan of decisions and miniapp_gate_events.
create index decisions_user_created_idx
  on decisions (user_id, created_at);

create index miniapp_gate_events_user_created_idx
  on miniapp_gate_events (user_id, created_at);
