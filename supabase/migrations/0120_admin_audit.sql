-- Air Create (V12) operator actions — docs/goal-create-v12.md §12 (the
-- `POST /api/admin/create/apps/<slug>/{dev,suspend}` rows) and the admin
-- repository's goal.md A3 ("actions are confirm-gated and audited").
--
-- admin_audit: one row per operator action on an app: who (the admin bearer,
-- named by role only), what (revoke/renew dev, suspend), which app (id + slug
-- at the time) and a metadata detail (version, expiry). Never a reason text
-- typed by anyone, never app content (CR21). Forward-only.

create table admin_audit (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null default 'admin',
  action     text not null check (action in ('dev_revoke', 'dev_renew', 'suspend')),
  app_id     uuid references mini_apps(id) on delete set null,
  user_id    uuid references users(id) on delete cascade,
  slug       text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_created_idx on admin_audit (created_at desc);
create index admin_audit_app_idx on admin_audit (app_id, created_at desc);

alter table admin_audit enable row level security;
-- The owner may read what operators did to their apps; only the service role writes.
create policy own_admin_audit on admin_audit
  for select using (user_id = auth.uid());
