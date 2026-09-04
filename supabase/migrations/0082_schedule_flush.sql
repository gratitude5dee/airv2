-- Atomic flush scheduling. Two webhooks for one chat can be in flight at
-- once (iMessage delivers a photo and its typed caption as separate events),
-- and a read-then-upsert in the app let the last writer restore a shorter
-- deadline. The deadline is now chosen inside the upsert, under the row lock:
--   * a deadline still open within the reference window (p_window_end) that
--     is later than this message's own wins, nudged +1ms so the caller owns a
--     distinct run_at for claim_flush's equality match;
--   * anything else (no row, an earlier deadline, or a backoff reschedule
--     minutes out) is replaced by this message's own deadline.
-- cancelled_at is stamped by the caller, not now(): the running chain compares
-- it against its own chain_started_at, which the app clock wrote, and the two
-- must come from the same clock. It only moves forward, so a webhook that
-- reaches the row late cannot hide a newer cancellation from the chain.
create or replace function schedule_flush(
  p_space_id     text,
  p_user_id      uuid,
  p_phone        text,
  p_sender_tier  int,
  p_run_at       timestamptz,
  p_window_end   timestamptz,
  p_cancelled_at timestamptz
) returns timestamptz as $$
  insert into flush_jobs (space_id, user_id, phone, run_at, cancelled_at, sender_tier)
  values (p_space_id, p_user_id, p_phone, p_run_at, p_cancelled_at, p_sender_tier)
  on conflict (space_id) do update
    set run_at = case
          when flush_jobs.run_at >= excluded.run_at
           and flush_jobs.run_at <= p_window_end
            then flush_jobs.run_at + interval '1 millisecond'
          else excluded.run_at
        end,
        user_id      = excluded.user_id,
        phone        = excluded.phone,
        cancelled_at = greatest(flush_jobs.cancelled_at, excluded.cancelled_at),
        sender_tier  = excluded.sender_tier
  returning run_at;
$$ language sql security definer;

revoke all on function schedule_flush(text, uuid, text, int, timestamptz, timestamptz, timestamptz) from public;
grant execute on function schedule_flush(text, uuid, text, int, timestamptz, timestamptz, timestamptz) to service_role;
