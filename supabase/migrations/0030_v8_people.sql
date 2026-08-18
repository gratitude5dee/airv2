-- V8 tab upgrades (People): block + promotion audit on senders, and
-- per-sender run attribution so message counts come from agent_runs.
-- Metadata only (C4): timestamps and foreign keys — never message content.

-- Block is orthogonal to trust tier: a blocked email sender is also mirrored
-- to AgentMail's inbox-scoped receive-block list (the enforcement layer).
alter table senders add column blocked_at timestamptz;

-- "Recently promoted" audit line: when the owner last changed this sender's
-- tier from the People tab. Null for rows never touched by hand.
alter table senders add column tier_changed_at timestamptz;

-- Which known sender's inbound message triggered the run. Null for
-- owner-initiated web/voice/cron runs and for rows predating V8; set null on
-- sender delete so run history survives contact cleanup.
alter table agent_runs add column sender_id uuid references senders(id) on delete set null;
create index on agent_runs (sender_id);
