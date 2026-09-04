-- V11 MC7 — GitHub webhook deliveries as a lease, not a one-way claim
-- (docs/goal-create-v11.md §11; CR9).
--
-- A delivery row used to be a permanent acknowledgement the moment it was
-- inserted: if the handler then failed and the release (a delete) failed
-- too, every redelivery of that id was answered "duplicate" for as long as
-- the row lived, and the event was lost. Now a row is only final once
-- `processed_at` is set. Until then it is a lease: a redelivery that finds
-- the lease expired (the handler crashed, or its release never landed)
-- takes the row over and runs the event again. A live lease still refuses
-- a concurrent redelivery, so an event is never processed twice at once.
--
-- Rows already here were written under the old rule, which inserted the row
-- before dispatch and never removed it when the handler threw — so an old
-- row does not prove its event ran. They are deliberately left with
-- `processed_at` null: once past the lease, a redelivery of a lost event is
-- processed once more (the handlers are idempotent), while a row whose
-- event never comes back costs nothing.
alter table github_deliveries
  add column processed_at timestamptz;

-- Claim `delivery_id` for one processing attempt. Returns true when this
-- call owns the delivery: the id was new, or its previous attempt neither
-- finished nor renewed its lease within `lease_seconds`. Returns false for
-- a processed delivery and for one still being processed.
create or replace function github_delivery_claim(
  p_delivery_id text,
  p_event text,
  p_lease_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
begin
  insert into github_deliveries (delivery_id, event, received_at, processed_at)
  values (p_delivery_id, p_event, now(), null)
  on conflict (delivery_id) do update
    set received_at = excluded.received_at,
        event = excluded.event
    where github_deliveries.processed_at is null
      and github_deliveries.received_at < now() - make_interval(secs => p_lease_seconds)
  returning delivery_id into claimed;
  return claimed is not null;
end;
$$;

revoke all on function github_delivery_claim(text, text, integer) from public;
grant execute on function github_delivery_claim(text, text, integer) to service_role;

-- Each import writes its own `import_id` onto the app's link row. Imports of
-- one app can overlap (the row is shared, keyed by app), and the one that
-- fails must not undo the one that succeeded: every compensating write —
-- restore, delete, the final stamp — is fenced on the id the request wrote,
-- so it is a no-op once another import has replaced the row.
alter table github_repo_links
  add column import_id uuid not null default gen_random_uuid();
