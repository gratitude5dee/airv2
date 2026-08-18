-- V7: bots — one Hermes profile per bot on the user's ONE box. Postgres holds
-- routing metadata only (goal.md §7): no chat bodies, no memory, no routine
-- prompt content (those live in ~/.hermes/profiles/<name>/ on the box, C4).
-- api_server_key is the per-profile Hermes key — same storage posture as
-- boxes.api_server_key: service-role only, never sent to a browser (C3).

create table bots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  name            citext not null,             -- profile name: [a-z0-9-]{2,32}; 'default' reserved
  title           text,
  description     text,
  avatar_kind     text not null default 'geometric' check (avatar_kind in ('geometric','image','generated','pet')),
  avatar_ref      text,
  model_tier      text check (model_tier in ('fast','balanced','deep')),  -- null = inherit (C21)
  api_server_key  text not null,               -- per-profile key, same storage posture as boxes.api_server_key
  status          text not null default 'provisioning'
                  check (status in ('provisioning','ready','error','deleted')),
  group_label     text,
  created_at      timestamptz not null default now(),
  unique (user_id, name)
);

create index bots_user_idx on bots (user_id);

-- Default-deny: RLS on with no policies — only the service role reads/writes.
alter table bots enable row level security;

-- Rooms: multi-bot group chats. Membership/routing metadata only — the
-- labelled transcript lives in each member's own 'Group: <name>' Hermes
-- session on the box, never here (C4).
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table room_members (
  room_id     uuid not null references rooms(id) on delete cascade,
  bot_id      uuid not null references bots(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (room_id, bot_id)
);

create index rooms_user_idx on rooms (user_id);

alter table rooms enable row level security;
alter table room_members enable row level security;
