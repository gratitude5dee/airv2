-- Per-box gateway credential and spend metering support (goal.md M1).
-- The GATEWAY_TOKEN is a per-box, rotatable secret injected at fork; the
-- inference gateway authenticates it back to a user_id. Service-role only,
-- like the other secret columns on boxes (no user-facing RLS policy exists).

alter table boxes add column gateway_token text unique;

-- Atomic spend increment used by the inference gateway on run completion.
create or replace function add_spend(p_user_id uuid, p_cost_usd numeric)
returns void as $$
  update entitlements
     set spend_mtd_usd = spend_mtd_usd + p_cost_usd
   where user_id = p_user_id;
$$ language sql security definer;

revoke all on function add_spend(uuid, numeric) from public;
