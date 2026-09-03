-- MA8: recover the staging notes 0079 dropped.
--
-- 0079 dismissed every duplicate pending shop_publish row but the newest one
-- per user, so the agent's staging reasons on the dismissed rows never reach
-- the owner's Needs You card. This folds those notes into the survivor with
-- the same rules as requestCatalogPublish: one line per note, whitespace
-- collapsed, 500 chars per note, no repeats, unrelated payload keys untouched,
-- and the aggregate capped at 2000 chars by keeping the NEWEST lines (older
-- duplicates first, the survivor's own lines last, and a repeated line keeps
-- its LATEST position, so right() trims history, not the latest reason).
--
-- Only rows 0079 itself dismissed are touched. scripts/apply-migrations.sh
-- sends a migration and its applied_migrations insert as one request, i.e.
-- one implicit transaction, and now() is the transaction start, so 0079's
-- `resolved_at = now()` equals the recorded applied_at to the microsecond.
-- An owner's dismissal is stamped by the web route from a JavaScript clock
-- and can never share that instant, so exact equality is the discriminator;
-- a wider window would fold notes the owner rejected. If the timestamps were
-- ever split across transactions the fold quietly finds nothing, which is the
-- safe failure. The survivor is the user's pending shop_publish row created
-- before that instant — the partial unique index means there is at most one.
-- Owners who already resolved the survivor acted on it; their rows are left
-- alone. Environments without applied_migrations (Supabase branching, local
-- resets) were built from scratch after 0079 and have nothing to fold.
do $$
declare
  ran_0079 timestamptz;
begin
  if to_regclass('public.applied_migrations') is null then
    return;
  end if;

  execute 'select applied_at from applied_migrations where name = $1'
    into ran_0079
    using '0079_one_pending_shop_publish.sql';
  if ran_0079 is null then
    return;
  end if;

  with dropped as (
    select id, user_id, payload, created_at
    from decisions
    where kind = 'shop_publish'
      and status = 'dismissed'
      and resolved_at = ran_0079
      and created_at < ran_0079
  ),
  survivor as (
    select s.id, s.user_id, s.payload, s.created_at
    from decisions s
    where s.kind = 'shop_publish'
      and s.status = 'pending'
      and s.created_at < ran_0079
      and exists (select 1 from dropped d where d.user_id = s.user_id)
  ),
  -- Chronological: dropped duplicates oldest-first, the survivor last.
  lines as (
    select r.user_id,
           left(btrim(regexp_replace(l.line, '\s+', ' ', 'g')), 500) as line,
           row_number() over (
             partition by r.user_id
             order by r.is_survivor, r.created_at, r.id, l.ord
           ) as seq
    from (
      select d.user_id, d.id, d.payload, d.created_at, false as is_survivor
      from dropped d
      union all
      select s.user_id, s.id, s.payload, s.created_at, true
      from survivor s
    ) r
    cross join lateral unnest(string_to_array(r.payload->>'note', E'\n'))
      with ordinality as l(line, ord)
    where jsonb_typeof(r.payload) = 'object'
      and jsonb_typeof(r.payload->'note') = 'string'
  ),
  deduped as (
    select user_id, line, seq
    from (
      select user_id, line, seq,
             row_number() over (partition by user_id, line order by seq desc) as dup
      from lines
      where line <> ''
    ) d
    where dup = 1
  ),
  merged as (
    select user_id, right(string_agg(line, E'\n' order by seq), 2000) as note
    from deduped
    group by user_id
  )
  update decisions d
  set payload = (case when jsonb_typeof(d.payload) = 'object'
                      then d.payload else '{}'::jsonb end)
                || jsonb_build_object('note', m.note)
  from survivor s
  join merged m on m.user_id = s.user_id
  where d.id = s.id
    and (jsonb_typeof(d.payload) is distinct from 'object'
         or d.payload->>'note' is distinct from m.note);
end
$$;
