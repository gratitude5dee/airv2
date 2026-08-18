-- V4: calendar surface — the calendar mini-app card and one-shot reminders.
--
-- card_sends generalizes computer_card_sends: one row per (user, card kind)
-- recording the last agent-initiated mini-app card, used as an atomic rate
-- limit so a prompt-injected agent cannot flood the owner's thread.
create table card_sends (
  user_id uuid not null references users(id) on delete cascade,
  kind    text not null check (kind in ('computer','calendar')),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table card_sends enable row level security;

insert into card_sends (user_id, kind, sent_at)
  select user_id, 'computer', sent_at from computer_card_sends;
drop table computer_card_sends;

-- One-shot schedules ("Remind me 30 minutes before"): fire once, then the
-- sweeper deletes the row and the box prompt.
alter table agent_schedules add column one_shot boolean not null default false;

-- The calendar mini-app: agenda (next 7 days) + inline calendar_add approval.
insert into mini_apps (slug, route, kind, scopes, backing_tool) values
  ('calendar', '/mini/calendar', 'input', '{calendar:read,calendar:approve}', null);

-- Default deny: no policies. The control plane's service role bypasses RLS.
