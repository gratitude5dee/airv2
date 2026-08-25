-- Compute environments: a user's agent can live on the Ubuntu box (the
-- default, unchanged), on Omarchy (Arch/Hyprland), or on a macOS instance.
-- The environment is chosen during onboarding and recorded on the boxes row
-- next to the provider that hosts it ('ascii' for the two Linux boxes,
-- 'namespace' for macos).
--
-- Template pointers are per (channel, environment) because a template only
-- describes one environment, and the providers do not agree on what a
-- template IS: a template box id to fork (ubuntu and omarchy — both ascii
-- boxes), or the URL of the bootstrap script a fresh Mac builds itself from
-- (macos) — Namespace has no snapshot fork. box_channels keeps its column as
-- the ubuntu pointer (existing rows stay authoritative); this table carries
-- the rest.
-- Forward-only and idempotent.

alter table boxes add column if not exists environment text not null default 'ubuntu'
  check (environment in ('ubuntu', 'omarchy', 'macos'));

-- macOS only: the template's bridge endpoint (exec + file read/write over an
-- authenticated Namespace ingress). Boxes are reached with the ascii command
-- API, so they leave these null. control_token is a per-instance secret, same
-- storage posture as hosted_token.
alter table boxes add column if not exists control_url text;
alter table boxes add column if not exists control_token text;

create table if not exists box_environment_templates (
  channel text not null references box_channels(name),
  environment text not null check (environment in ('ubuntu', 'omarchy', 'macos')),
  -- Template box id (ubuntu, omarchy) or bootstrap URL (macos).
  template_ref text,
  updated_at timestamptz not null default now(),
  primary key (channel, environment)
);

-- Seed the ubuntu rows from the existing channel pointers so the resolver
-- reads one table for every environment.
insert into box_environment_templates (channel, environment, template_ref)
select name, 'ubuntu', template_box_id from box_channels
on conflict (channel, environment) do nothing;
