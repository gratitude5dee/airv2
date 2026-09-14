-- Owner-scoped checkout handoffs. URLs are validated by the control plane.
create table checkout_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  space_id text not null, phone text not null, task_id text,
  status text not null default 'preparing' check (status in (
    'preparing','needs_human','ready_for_review','payment_pending','requires_action',
    'completed','failed','expired','cancelled','unknown_outcome')),
  merchant_host text not null, merchant_url text not null, item_summary text not null,
  quantity integer check (quantity is null or quantity > 0),
  amount_cents integer check (amount_cents is null or amount_cents >= 0), currency text,
  blocker text, verified_at timestamptz, expires_at timestamptz,
  same_session boolean not null default true,
  payment_request_id uuid references payment_requests(id) on delete set null,
  version integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkout_handoffs_user_idx on checkout_handoffs (user_id, created_at desc);
create unique index checkout_handoffs_task_idx on checkout_handoffs (user_id, task_id) where task_id is not null;
alter table checkout_handoffs enable row level security;
create policy own_checkout_handoffs on checkout_handoffs for select using (user_id = auth.uid());

alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout'));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout'));

insert into mini_apps (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values ('checkout', '/mini/checkout', 'render', '{}', null, 'Checkout', 'Review and continue your purchase.', 'public', 'single', 'published')
on conflict (slug) do update set route = excluded.route, kind = excluded.kind, name = excluded.name,
  description = excluded.description, visibility = excluded.visibility, access = excluded.access,
  status = excluded.status, updated_at = now();
