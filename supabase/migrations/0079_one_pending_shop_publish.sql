-- MA8: one pending shop_publish decision per user, enforced by the database.
-- requestCatalogPublish reuses the pending decision and appends the agent's
-- staging note to it; two first stagings racing past the lookup used to both
-- insert, handing the owner duplicate approval cards for one catalog. The
-- newest pending row per user survives; the staging notes on the older
-- duplicates are folded into it first (same rules as the code path: one line
-- per note, whitespace collapsed, 500 chars per note, no repeats, the newest
-- 2000 chars kept, unrelated payload keys untouched), then the duplicates are
-- dismissed so the index can be created. The code path treats a
-- unique_violation as "merge into the winner".
with ranked as (
  select id, user_id, payload, created_at,
         row_number() over (partition by user_id order by created_at desc, id desc) as rn
  from decisions
  where kind = 'shop_publish' and status = 'pending'
),
-- Every note line the owner would have seen: the survivor's own lines first,
-- then the older duplicates' lines oldest-first. Payloads that are not an
-- object with a string note contribute nothing.
lines as (
  select r.user_id,
         left(btrim(regexp_replace(l.line, '\s+', ' ', 'g')), 500) as line,
         row_number() over (
           partition by r.user_id
           order by (r.rn <> 1), r.created_at, r.id, l.ord
         ) as seq
  from ranked r
  cross join lateral unnest(string_to_array(r.payload->>'note', E'\n'))
    with ordinality as l(line, ord)
  where jsonb_typeof(r.payload) = 'object'
    and jsonb_typeof(r.payload->'note') = 'string'
),
deduped as (
  select user_id, line, seq
  from (
    select user_id, line, seq,
           row_number() over (partition by user_id, line order by seq) as dup
    from lines
    where line <> ''
  ) d
  where dup = 1
),
merged as (
  select user_id, right(string_agg(line, E'\n' order by seq), 2000) as note
  from deduped
  group by user_id
),
folded as (
  update decisions d
  set payload = (case when jsonb_typeof(d.payload) = 'object' then d.payload else '{}'::jsonb end)
                || jsonb_build_object('note', m.note)
  from ranked r
  join merged m on m.user_id = r.user_id
  where d.id = r.id and r.rn = 1
    and (jsonb_typeof(d.payload) is distinct from 'object'
         or d.payload->>'note' is distinct from m.note)
  returning d.id
),
dismissed as (
  update decisions d
  set status = 'dismissed', resolved_at = now()
  from ranked
  where d.id = ranked.id and ranked.rn > 1
  returning d.id
)
select (select count(*) from folded) as folded,
       (select count(*) from dismissed) as dismissed;

create unique index one_pending_shop_publish
  on decisions (user_id)
  where kind = 'shop_publish' and status = 'pending';
