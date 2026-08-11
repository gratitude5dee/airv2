-- Pixel registry: one row per Meta pixel the user tracks. The pixel itself
-- lives on Meta and is created/managed by the agent through the box's Meta
-- Ads MCP; this table only records refs so every surface (web, iMessage,
-- desktop) sees the same pixel inventory. No platform credential is stored.
create table ad_pixels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  account_id uuid references ad_accounts(id) on delete set null,
  pixel_ref  text not null,
  name       text,
  status     text not null default 'active'
             check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (user_id, pixel_ref)
);
create index on ad_pixels (user_id, status);
alter table ad_pixels enable row level security;
