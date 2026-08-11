-- 0017: computer relay follow-ups.
--
-- imessage_destinations: a durable per-user record of where the agent's
-- iMessage replies go. flush_jobs rows are transient transport state (deleted
-- when a chain completes), so the agent-initiated computer card needs its own
-- durable destination, refreshed on every inbound.
create table imessage_destinations (
  user_id    uuid primary key references users(id) on delete cascade,
  space_id   text not null,
  phone      text not null,
  updated_at timestamptz not null default now()
);
alter table imessage_destinations enable row level security;

-- computer_card_sends: one row per user recording the last agent-initiated
-- computer card, used as an atomic rate limit so a prompt-injected agent
-- cannot flood the owner's thread with screen links.
create table computer_card_sends (
  user_id uuid primary key references users(id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table computer_card_sends enable row level security;

-- Default deny: no policies. The control plane's service role bypasses RLS.
