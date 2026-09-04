-- Follow-up to 0084. Both RPCs now take the registry row lock first and only
-- then touch ledger rows. 0084 locked the ledger row first, but the pointer
-- move also updates the *previous* version's row after taking the registry
-- lock, so a tombstone holding that row while waiting on the registry row
-- deadlocked against it. Same signatures, same return semantics.
--
-- Also adds mini_apps.app_origin_deployed_at (CR16): which apps ever had a
-- Worker on the app origin. Version rows are discardable (a failed upload
-- deletes its row after the draft Worker was already put), so account
-- deletion cannot infer "something may still serve" from the ledger. Set
-- before an app's first deploy, never cleared by anything but the app row
-- going away.

-- Move mini_apps.bundle_version to p_version only if the row still names
-- p_expected (compare-and-swap; null = "was unset") and the target version
-- is still selectable (not tombstoned). Stamps published_at on the new row
-- and retired_at on the one it replaces. Returns false when either check
-- fails and writes nothing.
create or replace function miniapp_point_live(
  p_app_id uuid,
  p_version text,
  p_expected text
) returns boolean as $$
declare
  v_row_id uuid;
  v_current text;
  v_found boolean;
  v_now timestamptz := now();
begin
  select true, bundle_version into v_found, v_current
    from mini_apps
   where id = p_app_id
     for update;
  if v_found is null or v_current is distinct from p_expected then
    return false;
  end if;

  select id into v_row_id
    from miniapp_versions
   where app_id = p_app_id and version = p_version and purged_at is null
     for update;
  if v_row_id is null then
    return false;
  end if;

  update mini_apps
     set bundle_version = p_version, updated_at = v_now
   where id = p_app_id;
  update miniapp_versions
     set published_at = v_now, retired_at = null
   where id = v_row_id;
  if p_expected is not null and p_expected <> p_version then
    update miniapp_versions
       set retired_at = v_now
     where app_id = p_app_id and version = p_expected and retired_at is null;
  end if;
  return true;
end;
$$ language plpgsql security definer;

revoke all on function miniapp_point_live(uuid, text, text) from public;
grant execute on function miniapp_point_live(uuid, text, text) to service_role;

-- Set purged_at on a version row unless the app's live or draft pointer
-- names it (checked under the registry row lock). Returns true when the row
-- is tombstoned after the call (including one tombstoned earlier), false
-- when the version is a pointer target or no longer exists.
create or replace function miniapp_tombstone_version(p_id uuid)
returns boolean as $$
declare
  v_app_id uuid;
  v_version text;
  v_purged timestamptz;
  v_live boolean;
begin
  -- Unlocked read for the app id; the row is re-read under lock below, after
  -- the registry row, so the lock order matches miniapp_point_live.
  select app_id into v_app_id from miniapp_versions where id = p_id;
  if v_app_id is null then
    return false;
  end if;

  perform 1 from mini_apps where id = v_app_id for update;

  select version, purged_at into v_version, v_purged
    from miniapp_versions
   where id = p_id
     for update;
  if v_version is null then
    return false;
  end if;
  if v_purged is not null then
    return true;
  end if;

  select (bundle_version = v_version or draft_version = v_version)
    into v_live
    from mini_apps
   where id = v_app_id;
  if coalesce(v_live, false) then
    return false;
  end if;

  update miniapp_versions set purged_at = now() where id = p_id;
  return true;
end;
$$ language plpgsql security definer;

revoke all on function miniapp_tombstone_version(uuid) from public;
grant execute on function miniapp_tombstone_version(uuid) to service_role;

alter table mini_apps
  add column if not exists app_origin_deployed_at timestamptz;

update mini_apps a
   set app_origin_deployed_at = coalesce(a.app_origin_deployed_at, v.first_seen)
  from (
    select app_id, min(created_at) as first_seen
      from miniapp_versions
     where worker_sha256 is not null
     group by app_id
  ) v
 where v.app_id = a.id
   and a.app_origin_deployed_at is null;
