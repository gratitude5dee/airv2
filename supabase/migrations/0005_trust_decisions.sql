-- M4: sender trust tiers + the "Needs you" decision queue.
-- Decisions hold routing metadata only (kind, refs, a short label) — never
-- message bodies or agent memory (C4).

create table decisions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('tier2_contact','email_draft','run_approval')),
  platform    text,
  sender      text,
  ref         text,                                -- draft_id / run_id / message_id
  label       text,                                -- short safe label (e.g. subject)
  status      text not null default 'pending' check (status in ('pending','approved','dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index on decisions (user_id, status);

alter table decisions enable row level security;
-- Default-deny: the service role is the sole reader/writer; the dashboard
-- reads through authenticated server routes.
