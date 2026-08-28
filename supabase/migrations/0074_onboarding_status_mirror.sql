-- Read-path cache of the box-side onboarding status documents so the
-- onboarding mini-app renders without touching the Box (production timing
-- showed the five Box file reads cost 0.5-1s each per render). Metadata only,
-- honoring C4: step statuses, upload counts, flags, and timestamps — never
-- document content, and never the Link pairing phrase or verification URL
-- (those stay box-side; the link slide fetches them live while pairing).
-- The Box documents remain the source of truth; rows here refresh on every
-- control-plane write and lazily on render.
-- Forward-only and idempotent.

create table if not exists onboarding_status_mirror (
  user_id uuid primary key references users(id) on delete cascade,
  state jsonb,
  ingest jsonb,
  imports jsonb,
  browser_profile jsonb,
  link jsonb,
  refreshed_at timestamptz not null default now()
);

alter table onboarding_status_mirror enable row level security;
