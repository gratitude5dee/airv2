-- R-SEC-02: a burst's trust is its least-trusted message, not the last one.
--
-- batch_queue/carried_messages keep each row's resolved tier alongside
-- sender_id (carried rows keep their sender across carry-forward, same as
-- batch_queue — migration 0107), so a drain can compute the burst minimum and
-- name the least-trusted sender. schedule_flush folds the same minimum onto
-- flush_jobs so anything that reads only the job row (purchase gating,
-- crm surface, recovery) sees the burst's minimum trust rather than the most
-- recent message's.

alter table batch_queue add column sender_tier int;
alter table carried_messages add column sender_tier int;

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
        -- minimum trust across the burst: the higher tier number wins, and an
        -- unknown tier (null) outranks every known one — fail closed.
        sender_tier  = greatest(
          coalesce(flush_jobs.sender_tier, 2),
          coalesce(excluded.sender_tier, 2)
        )
  returning run_at;
$$ language sql security definer;

revoke all on function schedule_flush(text, uuid, text, int, timestamptz, timestamptz, timestamptz) from public;
grant execute on function schedule_flush(text, uuid, text, int, timestamptz, timestamptz, timestamptz) to service_role;
