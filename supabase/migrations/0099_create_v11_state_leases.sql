-- Mini-app state documents live in the owner's Box (C4: no content in shared
-- Postgres) and the Box files API has no compare-and-swap, so two appenders
-- to `.hermes/miniapps/<slug>/actions.json` (the Apps API and the Functions
-- runtime API) could read the same log and each write back a copy missing the
-- other's entry. This table is the serialization point: a writer takes a
-- short lease on (user, app, resource) before its read-modify-write and
-- releases it after. Rows are content-free — a slug, a resource name, an
-- opaque holder id and an expiry — and an expired lease is simply re-taken,
-- so a crashed writer can only delay the next one, never wedge the log.
create table miniapp_state_leases (
  user_id uuid not null references users(id) on delete cascade,
  app text not null,
  resource text not null,
  holder uuid not null,
  expires_at timestamptz not null,
  primary key (user_id, app, resource)
);

alter table miniapp_state_leases enable row level security;
-- Default-deny; the service role is the sole reader/writer.

-- Take the lease when it is free or expired; false when another writer holds
-- it. The upsert is one statement, so two racing callers serialize on the
-- primary key and exactly one sees the row as free.
create or replace function miniapp_state_lease(
  p_user_id uuid, p_app text, p_resource text, p_holder uuid, p_ttl_ms integer
) returns boolean as $$
  with taken as (
    insert into miniapp_state_leases (user_id, app, resource, holder, expires_at)
    values (p_user_id, p_app, p_resource, p_holder,
            now() + make_interval(secs => p_ttl_ms / 1000.0))
    on conflict (user_id, app, resource) do update
      set holder = excluded.holder,
          expires_at = excluded.expires_at
      where miniapp_state_leases.expires_at <= now()
    returning 1
  )
  select exists (select 1 from taken);
$$ language sql security definer;

-- Release only the caller's own lease; a lease that expired and was re-taken
-- by someone else stays with its new holder.
create or replace function miniapp_state_release(
  p_user_id uuid, p_app text, p_resource text, p_holder uuid
) returns boolean as $$
  with freed as (
    delete from miniapp_state_leases
     where user_id = p_user_id
       and app = p_app
       and resource = p_resource
       and holder = p_holder
    returning 1
  )
  select exists (select 1 from freed);
$$ language sql security definer;

revoke all on function miniapp_state_lease(uuid, text, text, uuid, integer) from public;
grant execute on function miniapp_state_lease(uuid, text, text, uuid, integer) to service_role;
revoke all on function miniapp_state_release(uuid, text, text, uuid) from public;
grant execute on function miniapp_state_release(uuid, text, text, uuid) to service_role;
