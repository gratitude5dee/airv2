-- R-PERF-08: durable first-bubble (TTFK) telemetry on the turn receipts
-- ledger. The iMessage webhook writes one row per burst-start send attempt
-- (hermes_run_id null, outcome 'first_bubble'/'first_bubble_failed') so a
-- week of these feeds the fixed-template vs model-ack decision without
-- depending on ephemeral log lines. ttfk_lane is the initialResponse source
-- ('acknowledgement' | 'arithmetic' | 'context' | 'gmi' | 'fallback');
-- ttfk_met is sent && elapsed <= INITIAL_REPLY_SLA_MS (5 s).
alter table agent_runs
  add column ttfk_ms   int,
  add column ttfk_met  boolean,
  add column ttfk_lane text;
