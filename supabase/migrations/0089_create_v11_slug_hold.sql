-- V11 CR16: a deleted app's name stays unavailable while a write to its
-- origin could still be in flight.
--
-- An origin writer that claimed the row before deletion may only find out
-- after its vendor call (its confirm comes back false) and then tears the
-- origin down by slug. Were the slug recreated in between, that teardown
-- would take the new app's Worker with it; the owner check the writer does
-- first narrows the window but cannot close it (no conditional delete at the
-- vendor). So the slug is held for longer than any request can run
-- (apps/web routes cap at maxDuration = 300s): while the hold stands no new
-- mini_apps row may take it. Only apps that ever carried an origin
-- (app_origin_deployed_at) leave a hold; the rest are reusable at once.
create table if not exists miniapp_slug_holds (
  slug text primary key,
  held_until timestamptz not null
);

create or replace function miniapp_hold_deleted_slug()
returns trigger as $$
begin
  if old.app_origin_deployed_at is not null then
    insert into miniapp_slug_holds (slug, held_until)
    values (old.slug, now() + interval '1 hour')
    on conflict (slug) do update
      set held_until = greatest(miniapp_slug_holds.held_until, excluded.held_until);
  end if;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_miniapp_hold_deleted_slug on mini_apps;
create trigger trg_miniapp_hold_deleted_slug
  after delete on mini_apps
  for each row execute function miniapp_hold_deleted_slug();

create or replace function miniapp_refuse_held_slug()
returns trigger as $$
declare
  v_held_until timestamptz;
begin
  select held_until into v_held_until
    from miniapp_slug_holds
   where slug = new.slug
     for share;
  if v_held_until is not null and v_held_until > now() then
    raise exception 'app name is on hold after deletion';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_miniapp_refuse_held_slug on mini_apps;
create trigger trg_miniapp_refuse_held_slug
  before insert or update of slug on mini_apps
  for each row execute function miniapp_refuse_held_slug();

-- The cron sweep clears expired holds.
create index if not exists miniapp_slug_holds_held_until_idx
  on miniapp_slug_holds (held_until);
