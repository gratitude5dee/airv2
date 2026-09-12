-- /freeze mini-app: still photo → frozen-time camera-move video.
--
-- freeze_sessions: one owner-scoped session per card; the link token's
--   resource_id binds the session. source_asset_id is the photo the camera
--   orbits (capture/upload/sketch lanes all converge there).
-- freeze_events is the append-only feed the studio polls — states only,
--   never prompts or media (C4).
-- creative_jobs gains mode 'freeze' plus the session linkage column; the
--   render rides the metered fal lane like 'zap'.

-- ─── freeze sessions ─────────────────────────────────────────────────────────
create table freeze_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  space_id            text not null,
  phone               text not null,
  status              text not null default 'active'
    check (status in ('active','expired')),
  -- The still the camera move renders around (capture, upload, or sketch
  -- lane output). Null until a source lands.
  source_asset_id     uuid references creative_assets(id) on delete set null,
  active_job_id       uuid references creative_jobs(id) on delete set null,
  latest_job_id       uuid references creative_jobs(id) on delete set null,
  -- Last sequence written to freeze_events; -1 = none yet.
  event_sequence      integer not null default -1,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now()
);
create index freeze_sessions_user_idx on freeze_sessions (user_id, created_at desc);

alter table freeze_sessions enable row level security;
create policy own_freeze_sessions on freeze_sessions
  for select using (user_id = auth.uid());

-- ─── freeze events ───────────────────────────────────────────────────────────
create table freeze_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references freeze_sessions(id) on delete cascade,
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
create index freeze_events_session_idx on freeze_events (session_id, sequence);

alter table freeze_events enable row level security;
create policy own_freeze_events on freeze_events
  for select using (
    exists (
      select 1 from freeze_sessions
      where freeze_sessions.id = freeze_events.session_id
        and freeze_sessions.user_id = auth.uid()
    )
  );

-- ─── creative_jobs: freeze mode + session linkage ────────────────────────────
alter table creative_jobs drop constraint creative_jobs_mode_check;
alter table creative_jobs add constraint creative_jobs_mode_check
  check (mode in ('imagine','animate','zap','video_render','draw','freeze'));

alter table creative_jobs
  add column freeze_session_id uuid references freeze_sessions(id) on delete set null,
  -- Which freeze lane produced the job: 'sketch' = source-image generation
  -- on the imagine lane, 'render' = the camera-trajectory video on fal.
  add column freeze_kind text check (freeze_kind in ('sketch','render'));

create index creative_jobs_freeze_session_idx
  on creative_jobs (freeze_session_id, created_at);

-- ─── registry row + card kind ────────────────────────────────────────────────
insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description,
   visibility, access, status)
values
  ('freeze', '/mini/freeze', 'input', '{image:read,image:write,video:write}', null,
   'Freeze', 'Freeze the scene — then move the camera.',
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

-- 0109 (trade) widened both lists before this migration ran; keep trade.
alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app','draw',
    'trade','freeze'
  ));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app','draw',
    'trade','freeze'
  ));
