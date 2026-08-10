-- CM0: brand kit source of record (goal-creative.md).
-- Postgres holds only the structured source — palette/typography/voice/claims
-- as tokens and URL refs, never media bytes (CC2). The compiled artifacts
-- (theme.yaml, BRAND.md) are derived copies mirrored into the box workspace
-- and are always safe to overwrite (CM0 task 3: mirror, don't sync).

create table brand_kits (
  user_id      uuid primary key references users(id) on delete cascade,
  source       jsonb not null,
  -- Bumped on every write; the box holds the compile of `mirrored_rev`.
  -- mirrored_rev < rev means the box copy is stale and the next wake
  -- (or the write itself, if the box is up) re-mirrors.
  rev          integer not null default 1,
  mirrored_rev integer not null default 0,
  updated_at   timestamptz not null default now()
);

alter table brand_kits enable row level security;
-- Default-deny; service role is the sole reader/writer.
