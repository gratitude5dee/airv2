-- Air Create (V11) MC5 follow-up — the per-user media quota as a reservation.
--
-- 0034's user_buckets is charged by a compare-and-set on bytes_used *after*
-- an upload, and the quota was checked on a row read before it. Two uploads
-- racing under the quota both passed the check and both landed. This makes
-- the check and the charge one statement: an upload reserves its bytes
-- before anything reaches R2 (refused when bytes_used + bytes would exceed
-- quota_bytes) and releases them if the upload does not complete. The row
-- and its columns are unchanged; the Storage settings page reads bytes_used
-- as before.

-- Charge p_bytes against the quota. True when the charge was taken; false
-- when it would overflow (or the bucket row does not exist — callers
-- provision it first). Racing callers serialize on the row.
create or replace function user_bucket_reserve(p_user_id uuid, p_bytes bigint)
returns boolean as $$
  with charged as (
    update user_buckets
       set bytes_used = bytes_used + p_bytes
     where user_id = p_user_id
       and p_bytes >= 0
       and bytes_used + p_bytes <= quota_bytes
    returning 1
  )
  select exists (select 1 from charged);
$$ language sql security definer;

-- Give p_bytes back (an upload that failed after its reservation). Clamped at
-- zero so a double release never goes negative. Returns the new bytes_used.
create or replace function user_bucket_release(p_user_id uuid, p_bytes bigint)
returns bigint as $$
  update user_buckets
     set bytes_used = greatest(bytes_used - p_bytes, 0)
   where user_id = p_user_id
  returning bytes_used;
$$ language sql security definer;

revoke all on function user_bucket_reserve(uuid, bigint) from public;
grant execute on function user_bucket_reserve(uuid, bigint) to service_role;
revoke all on function user_bucket_release(uuid, bigint) from public;
grant execute on function user_bucket_release(uuid, bigint) to service_role;
