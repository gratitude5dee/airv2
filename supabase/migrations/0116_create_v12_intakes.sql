-- Air Create (V12) MC1 — docs/goal-create-v12.md §14.2 item 1 (CR21).
--
-- create_intakes: one row per `/create` conversation, from the first prompt
-- to production or abandonment (§4 "Intake", §5.1 stage machine). The row
-- holds state, the template id, counters, content hashes and timestamps
-- only: questions, answers, plan.md and goal.md live in the owner's Box
-- under ~/.hermes/create/<appname>/ and are never columns here (CR21).
-- Forward-only.

create table create_intakes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  app_id                uuid references mini_apps(id) on delete cascade,
  appname               text,
  template              text check (template in ('landing','store','game-2d','game-3d','tool','page')),
  stage                 text not null check (stage in (
                          'asking','planning','plan_sent','revising','confirmed',
                          'building','qa','testing','dev_ready','finalizing',
                          'decision_sent','production','abandoned','failed'
                        )),
  source                text not null check (source in ('imessage','web')),
  questions_asked       smallint not null default 0,
  revisions             smallint not null default 0,
  plan_sha256           text,
  goal_sha256           text,
  builds                smallint not null default 0,
  failed_builds         smallint not null default 0,
  mirror_error          text,
  opened_at             timestamptz not null default now(),
  confirmed_at          timestamptz,
  dev_ready_at          timestamptz,
  production_at         timestamptz,
  last_owner_message_at timestamptz,
  updated_at            timestamptz not null default now()
);

-- One open intake per (user, app). app_id is null until the draft registry
-- row exists, so the provisional appname carries the same guarantee.
create unique index create_intakes_open_app_idx
  on create_intakes (user_id, app_id)
  where stage not in ('production','abandoned','failed');
create unique index create_intakes_open_appname_idx
  on create_intakes (user_id, appname)
  where stage not in ('production','abandoned','failed');
-- Owner lookups and the 7-day abandonment sweep (§5.1).
create index create_intakes_user_stage_idx
  on create_intakes (user_id, stage, updated_at desc);
create index create_intakes_stage_owner_msg_idx
  on create_intakes (stage, last_owner_message_at);

alter table create_intakes enable row level security;
create policy own_create_intakes on create_intakes
  for select using (user_id = auth.uid());
