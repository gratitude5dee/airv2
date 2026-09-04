-- V11 — discard an empty draft app atomically against anyone else who has
-- just started using it (docs/goal-create-v11.md §10, §11; CR5, CR16).
--
-- A request that creates an app row for an import or a drop, and then fails
-- before anything is staged, removes the row again. That removal was a plain
-- conditional delete (owned, `draft`, both pointers null). It raced a second
-- request on the same new name: that one had found the row (`created` false),
-- written its repository link or reserved a version row, and was staging — its
-- pointers not yet set — when the first request's delete took the app away and
-- cascaded its link and version with it, failing both.
--
-- The cleanup now runs under the app row's lock. Every row that hands the app
-- to another request (github_repo_links.app_id, miniapp_versions.app_id) is a
-- foreign key onto mini_apps, so inserting one holds a KEY SHARE lock on the
-- app row until it commits; FOR UPDATE waits for that, and the checks below
-- then see the committed row and keep the app. A claimant that arrives after
-- the lock is taken has its insert refused by the foreign key once the app is
-- gone, before it has done anything external. Lock order matches the pointer
-- RPCs (0085): registry row first, nothing else held.
create or replace function miniapp_discard_empty_draft(
  p_app_id uuid,
  p_owner_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from mini_apps where id = p_app_id for update;
  if not found then
    return false;
  end if;
  delete from mini_apps a
   where a.id = p_app_id
     and a.owner_user_id = p_owner_user_id
     and a.status = 'draft'
     and a.draft_version is null
     and a.bundle_version is null
     and not exists (select 1 from github_repo_links l where l.app_id = a.id)
     and not exists (select 1 from miniapp_versions v where v.app_id = a.id);
  return found;
end;
$$;

revoke all on function miniapp_discard_empty_draft(uuid, uuid) from public;
grant execute on function miniapp_discard_empty_draft(uuid, uuid) to service_role;
