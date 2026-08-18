-- V1: AIR Vault metadata mirror + audit trail. Postgres holds METADATA ONLY —
-- no vault values, no TOTP seeds, no AIR_VAULT_KEY ever land here (C18/C19);
-- the encrypted store lives solely in the user's Box at
-- ~/.hermes/vault/store.enc. `masked` is a display tail (•••• 4242 /
-- sk-…abcd), never enough to reconstruct a value.

create table vault_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  kind         text not null check (kind in ('login','card','api_key','note','identity')),
  name         text not null,
  masked       text,
  env_var      text,
  totp_enabled boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (user_id, env_var)
);

create index vault_items_user_kind_idx on vault_items (user_id, kind);

alter table vault_items enable row level security;
create policy own_vault_items on vault_items for select using (user_id = auth.uid());

create table vault_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  item_id    uuid references vault_items(id) on delete set null,
  action     text not null check (action in
             ('create','update','delete','reveal','fill_requested','fill_approved',
              'fill_denied','env_injected','manager_enabled','manager_disabled')),
  -- Free-form context label (e.g. surface or requester) — never a value.
  context    text,
  created_at timestamptz not null default now()
);

create index vault_events_user_created_idx on vault_events (user_id, created_at desc);

alter table vault_events enable row level security;
create policy own_vault_events on vault_events for select using (user_id = auth.uid());
