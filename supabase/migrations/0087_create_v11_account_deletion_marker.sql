-- V11 CR16: account deletion is a state of the account, not only of the apps
-- that existed when it started.
--
-- users.deleting_at is the first write of /api/admin/delete. Under it:
--   * no new mini_apps row can be created for the account (trigger below,
--     which shares-locks the users row so an insert in flight and the
--     deletion's marker write serialize — whichever commits first, the
--     deletion's owned-app inventory taken after the marker is complete);
--   * miniapp_claim_app_origin refuses every origin write for the account's
--     apps, before and after the vendor call, whether or not the per-app
--     mini_apps.deleting_at has been set yet.
alter table users
  add column if not exists deleting_at timestamptz;

create or replace function miniapp_refuse_insert_under_deletion()
returns trigger as $$
declare
  v_deleting timestamptz;
begin
  if new.owner_user_id is null then
    return new;
  end if;
  select deleting_at into v_deleting
    from users
   where id = new.owner_user_id
     for share;
  if v_deleting is not null then
    raise exception 'account is being deleted';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_miniapp_refuse_insert_under_deletion on mini_apps;
create trigger trg_miniapp_refuse_insert_under_deletion
  before insert on mini_apps
  for each row execute function miniapp_refuse_insert_under_deletion();

-- Returns true when the app exists, neither it nor its owner's account is
-- being deleted, and it now carries app_origin_deployed_at; false (writing
-- nothing) otherwise. Called before and after every origin write.
create or replace function miniapp_claim_app_origin(p_app_id uuid)
returns boolean as $$
declare
  v_found boolean;
  v_deleting timestamptz;
  v_owner uuid;
  v_owner_deleting timestamptz;
begin
  select true, deleting_at, owner_user_id
    into v_found, v_deleting, v_owner
    from mini_apps
   where id = p_app_id
     for update;
  if v_found is null or v_deleting is not null then
    return false;
  end if;
  if v_owner is not null then
    select deleting_at into v_owner_deleting
      from users
     where id = v_owner
       for share;
    if v_owner_deleting is not null then
      return false;
    end if;
  end if;
  update mini_apps
     set app_origin_deployed_at = coalesce(app_origin_deployed_at, now())
   where id = p_app_id;
  return true;
end;
$$ language plpgsql security definer;

revoke all on function miniapp_claim_app_origin(uuid) from public;
grant execute on function miniapp_claim_app_origin(uuid) to service_role;
