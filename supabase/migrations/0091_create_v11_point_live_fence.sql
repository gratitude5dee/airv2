-- Follow-up to 0085. The live pointer move also compares mini_apps.updated_at
-- with the value the caller observed before its Worker write, and returns the
-- updated_at it committed (null when it lost). Every pointer commit bumps
-- updated_at, and the origin reconciler (cron) touches it after putting the
-- Workers back on the registry's releases, so a publish/rollback whose live
-- Worker that repair may have written over cannot commit as if it hadn't —
-- the same fence the upload swap already carries. Same lock order as 0085.

drop function if exists miniapp_point_live(uuid, text, text);

create or replace function miniapp_point_live(
  p_app_id uuid,
  p_version text,
  p_expected text,
  p_expected_updated_at timestamptz
) returns timestamptz as $$
declare
  v_row_id uuid;
  v_current text;
  v_updated timestamptz;
  v_found boolean;
  v_now timestamptz := now();
begin
  select true, bundle_version, updated_at into v_found, v_current, v_updated
    from mini_apps
   where id = p_app_id
     for update;
  if v_found is null
     or v_current is distinct from p_expected
     or v_updated is distinct from p_expected_updated_at then
    return null;
  end if;

  select id into v_row_id
    from miniapp_versions
   where app_id = p_app_id and version = p_version and purged_at is null
     for update;
  if v_row_id is null then
    return null;
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
  return v_now;
end;
$$ language plpgsql security definer;

revoke all on function miniapp_point_live(uuid, text, text, timestamptz) from public;
grant execute on function miniapp_point_live(uuid, text, text, timestamptz) to service_role;
