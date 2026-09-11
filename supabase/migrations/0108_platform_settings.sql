-- Migration 0108 — fleet-wide operator settings.
--
-- `platform_settings` is a small key/value table the control plane reads on
-- provision paths (e.g. `box_default_provider`, which the admin dashboard's
-- provider switch writes). Metadata only (C4); RLS on with no policies, so
-- the service role is the only reader/writer.

create table platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table platform_settings enable row level security;
