-- /draw mini-app + Find My location requests (ported from mayor-coast).
--
-- draw_sessions: one owner-scoped studio session per card; the link token's
--   resource_id binds the session. draw_events is the append-only feed the
--   studio polls — states only, never prompts or media (C4).
-- creative_jobs gains mode 'draw' plus the revision-chain columns a refine
--   loop needs (parent/root/revision) and its input/output asset links.
-- location_requests holds a "near me" burst while a Find My share resolves;
--   only the coarse label is ever stored — exact coordinates never land here.

-- ─── draw sessions ───────────────────────────────────────────────────────────
create table draw_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  space_id            text not null,
  phone               text not null,
  status              text not null default 'active'
    check (status in ('active','expired')),
  active_job_id       uuid references creative_jobs(id) on delete set null,
  latest_job_id       uuid references creative_jobs(id) on delete set null,
  -- Last sequence written to draw_events; -1 = none yet.
  event_sequence      integer not null default -1,
  initial_asset_id    uuid references creative_assets(id) on delete set null,
  initial_prompt_sent boolean not null default false,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now()
);
create index draw_sessions_user_idx on draw_sessions (user_id, created_at desc);

alter table draw_sessions enable row level security;
create policy own_draw_sessions on draw_sessions
  for select using (user_id = auth.uid());

-- ─── draw events ─────────────────────────────────────────────────────────────
create table draw_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references draw_sessions(id) on delete cascade,
  job_id        uuid references creative_jobs(id) on delete set null,
  sequence      integer not null,
  kind          text not null check (kind in ('state','preview','completed')),
  state         text,
  asset_id      uuid references creative_assets(id) on delete set null,
  preview_index integer,
  error_code    text,
  created_at    timestamptz not null default now(),
  unique (session_id, sequence)
);
create index draw_events_session_idx on draw_events (session_id, sequence);

alter table draw_events enable row level security;
create policy own_draw_events on draw_events
  for select using (
    exists (
      select 1 from draw_sessions
      where draw_sessions.id = draw_events.session_id
        and draw_sessions.user_id = auth.uid()
    )
  );

-- ─── creative_jobs: draw mode + revision linkage ─────────────────────────────
alter table creative_jobs drop constraint creative_jobs_mode_check;
alter table creative_jobs add constraint creative_jobs_mode_check
  check (mode in ('imagine','animate','zap','video_render','draw'));

alter table creative_jobs
  add column draw_session_id uuid references draw_sessions(id) on delete set null,
  add column draw_mode text check (draw_mode in ('fast','detailed','turbo','hq')),
  add column parent_job_id uuid references creative_jobs(id) on delete set null,
  add column root_job_id uuid references creative_jobs(id) on delete set null,
  add column revision_number integer,
  add column input_asset_id uuid references creative_assets(id) on delete set null,
  add column output_asset_id uuid references creative_assets(id) on delete set null;

create index creative_jobs_draw_session_idx
  on creative_jobs (draw_session_id, created_at);
create index creative_jobs_root_revision_idx
  on creative_jobs (root_job_id, revision_number);

-- ─── location requests ───────────────────────────────────────────────────────
-- A "near me" burst held while Find My resolves: the request card goes out,
-- the held message bodies wait here, and the sweep resolver either consumes
-- the share (storing only a coarse label) or expires the ask.
create table location_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  space_id       text not null,
  phone          text not null,
  -- The DM participant the Find My request targets.
  sender_address text not null,
  request_key    text not null unique,
  status         text not null default 'pending_provider'
    check (status in (
      'pending_provider','awaiting_share','resolving',
      'consumed','expired','cancelled','declined'
    )),
  purpose        text not null default 'nearby'
    check (purpose in ('nearby','directions')),
  entity_type    text not null default 'any',
  search_text    text,
  -- The drained burst bodies held until the share resolves (jsonb array).
  burst_input    jsonb,
  -- Optimistic-concurrency fence for claim/release between sweep ticks.
  revision       integer not null default 0,
  next_attempt_at timestamptz,
  expires_at     timestamptz not null,
  coarse_label   text,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index location_requests_due_idx
  on location_requests (status, next_attempt_at);
create index location_requests_space_idx
  on location_requests (space_id, created_at desc);

alter table location_requests enable row level security;
create policy own_location_requests on location_requests
  for select using (user_id = auth.uid());

-- carried_rows keep their sender across carry-forward, same as batch_queue.
alter table carried_messages add column sender_id text;

-- ─── registry row + card kind ────────────────────────────────────────────────
insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description,
   visibility, access, status)
values
  ('draw', '/mini/draw', 'input', '{image:read,image:write}', null,
   'Draw', 'Sketch a rough idea, then generate — and animate — the real thing.',
   'public', 'single', 'published')
on conflict (slug) do update set
  route = excluded.route,
  kind = excluded.kind,
  scopes = excluded.scopes,
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  access = excluded.access,
  status = excluded.status,
  updated_at = now();

alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app','draw'
  ));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app','draw'
  ));
