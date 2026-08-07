-- M2 iMessage pipeline: burst debouncing (C14) and the stop sweeper.
--
-- batch_queue rows are transient transport state, not memory: they hold a
-- message only between webhook receipt and the debounced flush that drains
-- them (deleted on drain, swept after 48h). The agent's memory of the
-- conversation lives in the box (~/.hermes), never here (C4/I2).
-- Service-role only; no user-facing policy on any of these tables.

create table batch_queue (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  space_id     text not null,
  phone        text not null,                    -- the line, pinned explicitly
  sender_id    text,
  message_id   text not null,
  body         text not null,                    -- transient; deleted on drain
  received_at  timestamptz not null default now()
);
create index on batch_queue (space_id, received_at);
create index on batch_queue (received_at);       -- 48h TTL sweep

-- One flush job per chat. On each inbound the enqueuer resets run_at to
-- now()+5s; whichever invocation still owns the deadline when it fires
-- claims the drain. chain_started_at / cancelled_at implement mid-generation
-- cancellation: a new inbound cancels the running chain by setting
-- cancelled_at, and the handler compares it against its own chain_started_at
-- (never "is the flag set") so a stale flag cannot orphan a new chain.
create table flush_jobs (
  space_id          text primary key,
  user_id           uuid not null references users(id) on delete cascade,
  phone             text not null,
  run_at            timestamptz not null,
  chain_started_at  timestamptz,
  cancelled_at      timestamptz,
  hermes_run_id     text,
  attempts          int not null default 0
);
create index on flush_jobs (run_at);

-- Messages a cancelled chain had already drained. The next batch prepends
-- them as "[Earlier message] …" so the model reads them as history, not
-- fresh input. Same transience contract as batch_queue.
create table carried_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  space_id     text not null,
  message_id   text not null,
  body         text not null,
  received_at  timestamptz not null default now()
);
create index on carried_messages (space_id, received_at);

alter table batch_queue      enable row level security;
alter table flush_jobs       enable row level security;
alter table carried_messages enable row level security;
-- Default deny: no policies. The control plane's service role bypasses RLS.
