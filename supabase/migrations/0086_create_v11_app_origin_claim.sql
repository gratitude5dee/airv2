-- V11 CR16: deployment and account deletion coordinate through the app row.
--
-- mini_apps.deleting_at is set by /api/admin/delete before it tears origins
-- down and stays set until the row cascades away. Every Worker put goes
-- through miniapp_claim_app_origin first, which refuses an app under
-- deletion and otherwise records app_origin_deployed_at (first deploy wins)
-- under the row lock — so a deploy cannot start once deletion has begun, and
-- a deploy that started earlier re-reads deleting_at after the vendor write
-- and tears itself down if deletion began in between.
alter table mini_apps
  add column if not exists deleting_at timestamptz;

-- Returns true when the app exists, is not being deleted, and now carries
-- app_origin_deployed_at; false (writing nothing) otherwise.
create or replace function miniapp_claim_app_origin(p_app_id uuid)
returns boolean as $$
declare
  v_found boolean;
  v_deleting timestamptz;
begin
  select true, deleting_at into v_found, v_deleting
    from mini_apps
   where id = p_app_id
     for update;
  if v_found is null or v_deleting is not null then
    return false;
  end if;
  update mini_apps
     set app_origin_deployed_at = coalesce(app_origin_deployed_at, now())
   where id = p_app_id;
  return true;
end;
$$ language plpgsql security definer;

revoke all on function miniapp_claim_app_origin(uuid) from public;
grant execute on function miniapp_claim_app_origin(uuid) to service_role;
