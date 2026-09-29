-- @entity references (logos, later products/characters): a registered
-- name -> a private creative_assets image the owner can name with @ in
-- creative prompts. Per-user only; metadata only (C4: asset bytes live in
-- storage, this table holds the name + asset_id pair).

create table entity_refs (
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null default 'logo',
  name       text not null,
  asset_id   uuid not null references creative_assets(id) on delete cascade,
  label      text,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, name)
);

-- Default-deny like identity_assets/brand_kits: only the service role
-- reaches it; the control plane enforces per-user access itself.
alter table entity_refs enable row level security;

create index entity_refs_user_idx on entity_refs (user_id);
