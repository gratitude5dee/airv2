-- Pairing/binding control-plane metadata for the Berd and Buzz mini-apps
-- (berd.goal.md §MA-B2, buzz.goal.md §MA-Z2). Postgres holds routing and
-- pairing state only (C4): device labels, hashed tokens, statuses, and
-- timestamps — never an agent, project, channel, message, provider key, or
-- any Nostr private material (C18). Codes are single-use, short-lived, and
-- stored hashed (C15); tokens are stored hashed and revocable. The paired
-- device can be the user's desktop app or a self-hosted instance on their
-- own Box — the exchange lane is the same either way (berd.goal.md §3.3).
-- Forward-only and idempotent.

create table if not exists berd_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists berd_pairing_codes_user_idx
  on berd_pairing_codes (user_id);

create table if not exists berd_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_label text not null,
  token_hash text not null unique,
  protocol_version integer,
  status text not null default 'paired' check (status in ('paired', 'revoked')),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists berd_links_user_idx on berd_links (user_id);

create table if not exists buzz_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null unique,
  relay_url text not null,
  signer_kind text not null check (signer_kind in ('box', 'desktop')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists buzz_pairing_codes_user_idx
  on buzz_pairing_codes (user_id);

create table if not exists buzz_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  relay_url text not null,
  community_label text,
  npub text not null,
  signer_kind text not null check (signer_kind in ('box', 'desktop')),
  token_hash text not null unique,
  status text not null default 'connected'
    check (status in ('connected', 'revoked')),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists buzz_links_user_idx on buzz_links (user_id);

alter table berd_pairing_codes enable row level security;
alter table berd_links enable row level security;
alter table buzz_pairing_codes enable row level security;
alter table buzz_links enable row level security;
