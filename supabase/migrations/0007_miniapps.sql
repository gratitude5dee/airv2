-- M7.5: mini-app registry + single-use token redemption ledger.
-- Board/list content lives in the user's box filesystem (C4); Postgres holds
-- only routing metadata and redemption ids.

create table mini_apps (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  route        text not null,
  kind         text not null check (kind in ('render','input','passthrough')),
  scopes       text[] not null default '{}',
  backing_tool text
);

insert into mini_apps (slug, route, kind, scopes, backing_tool) values
  ('kanban', '/mini/kanban', 'input', '{kanban:read,kanban:write}', 'kanban_move_card'),
  ('todo',   '/mini/todo',   'input', '{todo:read,todo:write}',     'todo_update');

create table miniapp_redemptions (
  jti         text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  app         text not null,
  redeemed_at timestamptz not null default now()
);

alter table mini_apps enable row level security;
alter table miniapp_redemptions enable row level security;
-- Default-deny; service role is the sole reader/writer.
