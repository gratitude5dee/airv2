-- CM4: the calendar is control-plane state and the box is woken to serve it.
-- Slots hold refs and status only (CC2): no caption, no hashtags, no media.
-- package_ref resolves against the box's creative plugin; assets resolve
-- against object storage at fire time.

create table content_slots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  platform       text not null,
  account_ref    text not null,
  package_ref    text not null,
  scheduled_at   timestamptz not null,
  timezone       text not null,
  status         text not null default 'scheduled'
                 check (status in ('scheduled','publishing','published','parked','cancelled')),
  attempt        integer not null default 0,
  -- attempt_epoch is the CAS token for claims: a claim only wins if it
  -- matches, and winning bumps it — replayed crons and racing invocations
  -- converge on one publish (CM4 task 4).
  attempt_epoch  integer not null default 0,
  claimed_at     timestamptz,
  -- Resumable adapter step state (e.g. an Instagram container id) so a
  -- worker deadline mid-poll never creates a second container (CC7).
  publish_state  jsonb not null default '{}',
  external_id    text,
  permalink      text,
  last_verdict   text,
  error_message  text,
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);

create index on content_slots (status, scheduled_at);
create index on content_slots (user_id, platform, account_ref, published_at);

alter table content_slots enable row level security;
-- Default-deny: the service role is the sole reader/writer; the calendar
-- reads through authenticated server routes.
