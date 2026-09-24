-- Per-tick delivery ledger for schedule runs: every claimed tick records
-- what it sent (or why it sent nothing), so "why did I get this text" and
-- "how many times did this watch check silently" are answerable. The
-- content_hash on 'delivered' rows also powers verbatim-repeat suppression
-- in the sweep (identical output inside 6h never texts the owner twice).

create table if not exists schedule_deliveries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  schedule_id  uuid references agent_schedules(id) on delete cascade,
  channel      text not null check (channel in ('imessage','email','none')),
  disposition  text not null check (disposition in (
    'delivered',
    'suppressed_silent',
    'suppressed_transient',
    'suppressed_repeat',
    'skipped',
    'failed'
  )),
  content_hash text,
  excerpt      text,
  created_at   timestamptz not null default now()
);

create index if not exists schedule_deliveries_schedule_idx
  on schedule_deliveries (schedule_id, created_at desc);
create index if not exists schedule_deliveries_dedupe_idx
  on schedule_deliveries (schedule_id, content_hash, created_at desc)
  where disposition = 'delivered';

alter table schedule_deliveries enable row level security;
create policy own_schedule_deliveries on schedule_deliveries
  for select using (user_id = auth.uid());
