-- Air Create (V11) MC5 follow-up — CR8, the per-app inference cap as a
-- reservation.
--
-- 0097's miniapp_fn_spend adds a call's cost once its usage is known, and
-- the gateway gated on the row it had read before dispatching. Two calls
-- racing just under the cap therefore both passed and both spent. This
-- makes the gate and the hold one statement: a call reserves an estimate
-- before dispatch (refused when spent + held has reached the cap), then
-- settles to its real cost — or releases — afterwards. Day scoping matches
-- miniapp_fn_spend: a counter from another UTC day reads as zero.
-- ai_spent_today_usd keeps meaning "settled spend" (the Functions tab shows
-- it unchanged); ai_reserved_today_usd is what is in flight.

alter table miniapp_functions
  add column if not exists ai_reserved_today_usd numeric(10,4) not null default 0;

-- Hold p_usd against p_cap. Returns the UTC day the hold was booked on, or
-- null when refused. The admission test is the one the read-then-dispatch
-- gate applied (spent + held < cap): a cap of $0.05 still admits one deep
-- call while the day's total is under the cap, and the hold it takes is what
-- the next caller sees — racing callers serialize on the row, so a second
-- call is admitted only if the first's hold still leaves the total under cap.
drop function if exists miniapp_fn_reserve(uuid, numeric, numeric);
create function miniapp_fn_reserve(p_app_id uuid, p_usd numeric, p_cap numeric)
returns date as $$
  with held as (
    update miniapp_functions
       set ai_spent_today_usd = case
             when ai_spend_day = (now() at time zone 'utc')::date then ai_spent_today_usd
             else 0
           end,
           ai_reserved_today_usd = case
             when ai_spend_day = (now() at time zone 'utc')::date then ai_reserved_today_usd
             else 0
           end + p_usd,
           ai_spend_day = (now() at time zone 'utc')::date,
           updated_at = now()
     where app_id = p_app_id
       and case
             when ai_spend_day = (now() at time zone 'utc')::date
               then ai_spent_today_usd + ai_reserved_today_usd
             else 0
           end < p_cap
    returning ai_spend_day
  )
  select ai_spend_day from held;
$$ language sql security definer;

-- Turn a hold of p_reserved, booked on p_day, into p_usd of settled spend
-- (p_usd = 0 releases). The cost lands on today's counter like
-- miniapp_fn_spend; the hold is subtracted only if it was booked today — a
-- hold from an earlier UTC day was already zeroed by the day roll, so it must
-- not come out of today's in-flight total. Clamped at zero.
drop function if exists miniapp_fn_settle(uuid, numeric, numeric);
create function miniapp_fn_settle(p_app_id uuid, p_reserved numeric, p_usd numeric, p_day date)
returns numeric as $$
  update miniapp_functions
     set ai_spent_today_usd = case
           when ai_spend_day = (now() at time zone 'utc')::date then ai_spent_today_usd
           else 0
         end + p_usd,
         ai_reserved_today_usd = greatest(
           case
             when ai_spend_day = (now() at time zone 'utc')::date then ai_reserved_today_usd
             else 0
           end - case
             when p_day = (now() at time zone 'utc')::date then p_reserved
             else 0
           end,
           0
         ),
         ai_spend_day = (now() at time zone 'utc')::date,
         updated_at = now()
   where app_id = p_app_id
  returning ai_spent_today_usd;
$$ language sql security definer;

revoke all on function miniapp_fn_reserve(uuid, numeric, numeric) from public;
grant execute on function miniapp_fn_reserve(uuid, numeric, numeric) to service_role;
revoke all on function miniapp_fn_settle(uuid, numeric, numeric, date) from public;
grant execute on function miniapp_fn_settle(uuid, numeric, numeric, date) to service_role;
