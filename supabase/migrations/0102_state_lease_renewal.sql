-- `miniapp_state_lease` shipped twice under two names: first as
-- `0099_create_v11_state_leases.sql` without the same-holder renewal clause,
-- then renamed to `0101_...` (scripts/migration-renames.txt) with it. A
-- database that recorded the 0099 filename has 0101 marked applied by the
-- rename ledger and so never ran the renewal-capable body, yet the append
-- helper (lib/miniapps/actionLog.ts) renews its lease between the read and
-- the write and aborts when refused — every append would 503 there. Re-issue
-- the function under a name no database has recorded so fresh, 0099-recorded
-- and 0101-recorded databases all converge on the same definition.
create or replace function miniapp_state_lease(
  p_user_id uuid, p_app text, p_resource text, p_holder uuid, p_ttl_ms integer
) returns boolean as $$
  with taken as (
    insert into miniapp_state_leases (user_id, app, resource, holder, expires_at)
    values (p_user_id, p_app, p_resource, p_holder,
            now() + make_interval(secs => p_ttl_ms / 1000.0))
    on conflict (user_id, app, resource) do update
      set holder = excluded.holder,
          expires_at = excluded.expires_at
      where miniapp_state_leases.expires_at <= now()
         or miniapp_state_leases.holder = excluded.holder
    returning 1
  )
  select exists (select 1 from taken);
$$ language sql security definer;

revoke all on function miniapp_state_lease(uuid, text, text, uuid, integer) from public;
grant execute on function miniapp_state_lease(uuid, text, text, uuid, integer) to service_role;
