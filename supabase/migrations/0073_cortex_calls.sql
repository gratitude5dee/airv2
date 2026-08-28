-- Cortex (Mitosis) call ledger: one content-free row per MCP call made
-- against the user's own Mitosis office, so trial/credit burn is observable
-- from the admin cost dashboard. Postgres still holds nothing about the
-- office itself — no credentials, no memory content, no questions/answers
-- (C2 analog); only the tool name, latency, and outcome land here. Mitosis's
-- own dashboard remains the source of truth for actual credit spend.
create table cortex_calls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  call       text not null check (call in ('cortex_manifest', 'cortex_ask')),
  ms         integer not null default 0,
  ok         boolean not null default false,
  created_at timestamptz not null default now()
);
create index on cortex_calls (user_id, created_at);
alter table cortex_calls enable row level security;
