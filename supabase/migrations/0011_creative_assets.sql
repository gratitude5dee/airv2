-- CM2: asset delivery (goal-creative.md). Postgres holds only refs and
-- bookkeeping (CC2) — the bytes live in the private `creative-assets`
-- Supabase Storage bucket, keyed content-addressed under the user's prefix
-- so identical renders occupy one object and user deletion removes one
-- prefix.

create table creative_assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  -- The plugin-side asset id in the box's creative.db.
  box_asset_id text not null,
  sha256      text not null,
  ext         text not null,
  kind        text not null,
  bytes       bigint not null,
  -- <user_id>/masters/<sha256>.<ext> — content-addressed dedupe.
  storage_key text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, sha256)
);

create index creative_assets_user_idx on creative_assets (user_id);

-- A delivery is a short-lived capability (CC3): an unguessable copy of the
-- master minted at publish time, revoked on confirmation or TTL expiry.
create table asset_deliveries (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references creative_assets(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  -- <user_id>/deliveries/<random>.<ext> — deleted on revoke.
  storage_key text not null,
  purpose     text,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index asset_deliveries_asset_idx on asset_deliveries (asset_id);

alter table creative_assets enable row level security;
alter table asset_deliveries enable row level security;
-- Default-deny; service role is the sole reader/writer.

insert into storage.buckets (id, name, public)
values ('creative-assets', 'creative-assets', false)
on conflict (id) do nothing;
