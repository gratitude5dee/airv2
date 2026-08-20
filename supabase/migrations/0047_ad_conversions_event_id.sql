-- P1-4: replayed conversion postbacks must not double-count. Postbacks now
-- carry a client-supplied event_id; a replay of the same (account_id,
-- event_id) is dropped at insert time via on-conflict-do-nothing.
alter table ad_conversions add column event_id text;

-- Backfill existing rows so the column can be NOT NULL and the plain unique
-- constraint (required for ON CONFLICT inference through PostgREST) holds.
update ad_conversions set event_id = id::text where event_id is null;

alter table ad_conversions alter column event_id set not null;

alter table ad_conversions
  add constraint ad_conversions_account_event_key unique (account_id, event_id);
