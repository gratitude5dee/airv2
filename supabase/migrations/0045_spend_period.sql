-- Monthly spend cap window anchor (review 2026-08 P1-2). spend_mtd_usd was
-- only ever incremented, so the "monthly" cap acted as a lifetime cap. The
-- anchor marks the start of the current calendar-month window; the gateway
-- rolls it on read, and add_spend rolls it on write so a stale row can never
-- keep accumulating into an old period.

alter table entitlements
  add column spend_period_start timestamptz not null default date_trunc('month', now());

create or replace function add_spend(p_user_id uuid, p_cost_usd numeric)
returns void as $$
  update entitlements
     set spend_mtd_usd = case
           when spend_period_start < date_trunc('month', now()) then p_cost_usd
           else spend_mtd_usd + p_cost_usd
         end,
         spend_period_start = greatest(spend_period_start, date_trunc('month', now()))
   where user_id = p_user_id;
$$ language sql security definer;

revoke all on function add_spend(uuid, numeric) from public;
grant execute on function add_spend(uuid, numeric) to service_role;
