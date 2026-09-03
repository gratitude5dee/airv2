-- MA8: one pending shop_publish decision per user, enforced by the database.
-- requestCatalogPublish reuses the pending decision and appends the agent's
-- staging note to it; two first stagings racing past the lookup used to both
-- insert, handing the owner duplicate approval cards for one catalog. Older
-- duplicates are dismissed (the newest carries the latest staging reasons) so
-- the index can be created; the code path treats a unique_violation as "merge
-- into the winner".
with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at desc, id desc) as rn
  from decisions
  where kind = 'shop_publish' and status = 'pending'
)
update decisions d
set status = 'dismissed', resolved_at = now()
from ranked
where d.id = ranked.id and ranked.rn > 1;

create unique index one_pending_shop_publish
  on decisions (user_id)
  where kind = 'shop_publish' and status = 'pending';
