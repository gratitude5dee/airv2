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
-- Rows already here were written under the old rule, which recorded no
-- outcome: the row went in before dispatch and stayed whether the handler
-- returned or threw, so nothing tells a completed delivery from a failed
-- one. They are stamped final, which is exactly what they already were —
-- a permanent acknowledgement — so this migration changes nothing about
-- them. Leaving them open instead would let a redelivery replay every one
-- of them past the lease, and a push handler stages the event's own head
-- while suspend/unsuspend are last-writer-wins: an old push or suspension
-- redelivered after a newer one would overwrite the newer state. An old
-- event known to have been lost is replayed by deleting its row and
-- redelivering it — a fresh id is a fresh claim.
alter table github_deliveries
  add column processed_at timestamptz;
update github_deliveries set processed_at = received_at where processed_at is null;

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
