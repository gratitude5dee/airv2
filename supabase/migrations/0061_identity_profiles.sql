-- Identity assets, digital twins, and public profiles (MA5 identity steps).
-- Postgres holds references and metadata only: identity_assets tags existing
-- creative_assets rows with a role, digital_twins records provider lifecycle
-- (no media), and profiles carries the user-published public-page metadata —
-- never box internals (C4).

create table identity_assets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  asset_id   uuid not null references creative_assets(id) on delete cascade,
  role       text not null check (role in ('selfie','character_sheet','avatar')),
  created_at timestamptz not null default now(),
  unique (user_id, asset_id, role)
);

create index identity_assets_user_idx on identity_assets (user_id);
-- One avatar per user; setting a new one replaces the row.
create unique index identity_assets_one_avatar
  on identity_assets (user_id) where role = 'avatar';

alter table identity_assets enable row level security;
create policy own_identity_assets on identity_assets
  for select using (user_id = auth.uid());

create table digital_twins (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references users(id) on delete cascade,
  provider          text not null default 'heygen',
  provider_twin_id  text,
  -- HeyGen look ID (avatar_item.id) minted via POST /v3/avatars; passed as
  -- avatar_id when rendering. Null when the user renders from a photo.
  provider_avatar_id text,
  provider_group_id  text,
  provider_voice_id  text,
  -- Storage key of the owner's consent recording in the private assets bucket.
  consent_video_key text,
  video_asset_id    uuid references creative_assets(id) on delete set null,
  status            text not null default 'avatar_only'
    check (status in ('avatar_only','consented','creating','ready','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table digital_twins enable row level security;
create policy own_digital_twins on digital_twins
  for select using (user_id = auth.uid());

-- Public profile metadata for /@username — user-published identity only.
create table profiles (
  user_id    uuid primary key references users(id) on delete cascade,
  bio        text,
  -- LinkTree-style list: [{ "label": string, "url": string }]
  links      jsonb not null default '[]',
  instagram  text,
  tiktok     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy own_profiles on profiles
  for select using (user_id = auth.uid());
