-- 0002 revoked execute on add_spend from public, which also stripped the
-- service role. The control plane (service role) is the only caller.
grant execute on function add_spend(uuid, numeric) to service_role;
