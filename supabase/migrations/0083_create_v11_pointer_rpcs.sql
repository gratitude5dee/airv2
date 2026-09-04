-- V11 §13.3 live-pointer moves and §13.1 retention tombstones race each
-- other through PostgREST: a rollback reads a version as selectable, the
-- sweep tombstones it, both proceed. These two functions make each side a
-- single transaction that locks the ledger row, then the registry row (same
-- order in both, so they serialize instead of deadlocking).

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
  v_now timestamptz := now();
  v_moved integer;
begin
  select id into v_row_id
    from miniapp_versions
   where app_id = p_app_id and version = p_version and purged_at is null
     for update;
  if v_row_id is null then
    return false;
  end if;

  update mini_apps
     set bundle_version = p_version, updated_at = v_now
   where id = p_app_id
     and bundle_version is not distinct from p_expected;
  get diagnostics v_moved = row_count;
  if v_moved = 0 then
    return false;
  end if;

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
  select app_id, version, purged_at into v_app_id, v_version, v_purged
    from miniapp_versions
   where id = p_id
     for update;
  if v_app_id is null then
    return false;
  end if;
  if v_purged is not null then
    return true;
  end if;

  select (bundle_version = v_version or draft_version = v_version)
    into v_live
    from mini_apps
   where id = v_app_id
     for update;
  if coalesce(v_live, false) then
    return false;
  end if;

  update miniapp_versions set purged_at = now() where id = p_id;
  return true;
end;
$$ language plpgsql security definer;

revoke all on function miniapp_tombstone_version(uuid) from public;
grant execute on function miniapp_tombstone_version(uuid) to service_role;
