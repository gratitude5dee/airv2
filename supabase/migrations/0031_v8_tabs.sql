-- V8 tabs 5–8: wallet send intents, box power-state history, and the
-- Computer tab's keep-awake schedules.

-- Wallet send flow: the composer only ever creates an intent row plus a
-- run_approval decision — execution happens server-side via thirdweb after
-- the user approves (never straight from the composer). Address and amount
-- are the user's own inputs, not secrets; no key material, no tokens.
create table wallet_transfers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  to_address     text not null,
  amount_wei     text not null,
  amount_display text not null,
  chain_id       int  not null,
  status         text not null default 'pending'
                 check (status in ('pending','submitting','submitted','denied','failed')),
  transaction_id text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index on wallet_transfers (user_id, created_at desc);
alter table wallet_transfers enable row level security;
-- Default deny: no policies. The control plane's service role bypasses RLS.

-- Power-state transitions for the Screen tab's history sparkline. Value-free:
-- just ready/stopped edges with timestamps.
create table box_state_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  state      text not null check (state in ('ready','stopped')),
  created_at timestamptz not null default now()
);
create index on box_state_events (user_id, created_at desc);
alter table box_state_events enable row level security;

-- Keep-awake schedules are agent_schedules rows minted by the Computer tab
-- (deliver 'none', prompt in the box like every other schedule).
alter table agent_schedules drop constraint agent_schedules_source_check;
alter table agent_schedules add constraint agent_schedules_source_check
  check (source in ('calendar','chat','bots','computer'));
