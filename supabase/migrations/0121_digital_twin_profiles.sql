-- Digital twin profiles (onboarding.md §5): auditable consent per scope, a
-- wider identity-asset vocabulary (profile image, alternates, reference
-- video, voice samples) with ordering and provenance, ElevenLabs voice-clone
-- and fal video-avatar lifecycle on digital_twins, the /twin creative lane,
-- and a provenance ledger of which identity assets a generation used.
--
-- C4 posture unchanged: Postgres holds references, provider handles and
-- lifecycle metadata only. Bytes stay in the private creative-assets bucket;
-- prompts, sample audio and signed URLs never land here. Forward-only.

-- ─── identity_assets: roles, ordering, source, status, consent link ─────────
alter table identity_assets drop constraint if exists identity_assets_role_check;
alter table identity_assets add constraint identity_assets_role_check
  check (role in (
    'selfie','character_sheet','character_sheet_draft','avatar',
    'profile_image','profile_image_draft','alt_image',
    'reference_video','voice_sample','consent_recording'
  ));

alter table identity_assets
  add column if not exists position     integer not null default 0,
  add column if not exists source       text not null default 'upload'
    check (source in ('upload','booth','generated')),
  add column if not exists status       text not null default 'ready'
    check (status in ('ready','processing','failed')),
  add column if not exists consent_id   uuid,
  add column if not exists label        text,
  -- Provider-side handle for this asset (e.g. a voice-sample id) — never a URL.
  add column if not exists provider_ref text;

-- One approved profile image per user; approving another replaces the row.
create unique index if not exists identity_assets_one_profile_image
  on identity_assets (user_id) where role = 'profile_image';
create index if not exists identity_assets_user_role_idx
  on identity_assets (user_id, role, position);

-- ─── twin_consents: one live grant per scope, revocable, versioned ───────────
create table if not exists twin_consents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  scope             text not null check (scope in ('likeness','voice','video_avatar')),
  policy_version    text not null,
  surface           text not null check (surface in ('onboarding','settings','api')),
  -- Optional spoken/recorded attestation, stored as a private asset.
  evidence_asset_id uuid references creative_assets(id) on delete set null,
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz
);

create unique index if not exists twin_consents_live_scope
  on twin_consents (user_id, scope) where revoked_at is null;
create index if not exists twin_consents_user_idx on twin_consents (user_id);

alter table twin_consents enable row level security;
drop policy if exists own_twin_consents on twin_consents;
create policy own_twin_consents on twin_consents
  for select using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'identity_assets_consent_fk'
  ) then
    alter table identity_assets
      add constraint identity_assets_consent_fk
      foreign key (consent_id) references twin_consents(id) on delete set null;
  end if;
end $$;

-- ─── digital_twins: voice clone, video avatar, sharing, consent links ────────
alter table digital_twins
  add column if not exists likeness_consent_id uuid references twin_consents(id) on delete set null,
  add column if not exists voice_provider       text,
  -- Provider voice handle (ElevenLabs voice_id). Deleted provider-side on revoke.
  add column if not exists voice_id             text,
  add column if not exists voice_status         text not null default 'none'
    check (voice_status in ('none','pending','ready','failed','revoked')),
  add column if not exists voice_error          text,
  add column if not exists voice_consent_id     uuid references twin_consents(id) on delete set null,
  add column if not exists voice_source_asset_ids uuid[] not null default '{}',
  -- sha256 of the sorted sample asset ids: a retry with the same samples
  -- never mints a second provider voice.
  add column if not exists voice_idempotency_key text,
  add column if not exists voice_created_at     timestamptz,
  add column if not exists voice_deleted_at     timestamptz,
  add column if not exists avatar_provider      text,
  add column if not exists avatar_status        text not null default 'off'
    check (avatar_status in ('off','pending','ready','failed')),
  -- Model id + resolution the avatar renders with; no URLs.
  add column if not exists avatar_config        jsonb not null default '{}'::jsonb,
  add column if not exists avatar_preview_asset_id uuid references creative_assets(id) on delete set null,
  add column if not exists avatar_error         text,
  add column if not exists avatar_consent_id    uuid references twin_consents(id) on delete set null,
  -- private: only the owner may reference @username; public: other users'
  -- /zap may use the profile image and character sheet (never the voice).
  add column if not exists sharing              text not null default 'private'
    check (sharing in ('private','public'));

-- ─── creative_jobs: the /twin lane ──────────────────────────────────────────
alter table creative_jobs drop constraint if exists creative_jobs_mode_check;
alter table creative_jobs add constraint creative_jobs_mode_check
  check (mode in ('imagine','animate','zap','video_render','draw','freeze','twin'));
alter table creative_jobs add column if not exists twin_kind text
  check (twin_kind in ('speak','image','preview'));

-- ─── identity_reference_uses: provenance of @username references ────────────
create table if not exists identity_reference_uses (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references creative_jobs(id) on delete cascade,
  -- The caller who ran the command.
  user_id       uuid not null references users(id) on delete cascade,
  -- The twin owner whose asset was used (equals user_id unless shared).
  owner_user_id uuid not null references users(id) on delete cascade,
  asset_id      uuid references creative_assets(id) on delete set null,
  role          text not null,
  purpose       text not null check (purpose in ('image','video','speech')),
  created_at    timestamptz not null default now()
);

create index if not exists identity_reference_uses_job_idx
  on identity_reference_uses (job_id);
create index if not exists identity_reference_uses_owner_idx
  on identity_reference_uses (owner_user_id, created_at);

alter table identity_reference_uses enable row level security;
drop policy if exists own_identity_reference_uses on identity_reference_uses;
create policy own_identity_reference_uses on identity_reference_uses
  for select using (user_id = auth.uid());
