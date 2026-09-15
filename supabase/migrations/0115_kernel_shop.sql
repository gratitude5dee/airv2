-- Kernel cloud browsers + vaults for /shop (docs/plans/kernel-shop-commerce-swe2.md).
-- The shared DB keeps ids, masks, states, and audit metadata only: KERNEL_API_KEY
-- stays in the control plane (C26); CDP/live-view/provider URLs are stored sealed
-- or not at all (C27); no PAN is ever a column (C28).

-- Per-user Kernel project identity (lazy-provisioned on first Kernel use).
create table kernel_accounts (
  user_id     uuid primary key references users(id) on delete cascade,
  project_id  text not null unique,
  profile_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table kernel_accounts enable row level security;
create policy own_kernel_accounts on kernel_accounts for select using (user_id = auth.uid());

-- Cloud browser sessions. Every credential-bearing URL Kernel returns is sealed
-- (AES-GCM, purpose-separated key derived from SESSION_SECRET); nothing usable
-- to drive or watch a browser is stored as plaintext.
create table kernel_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  kernel_session_id text not null unique,
  project_id        text not null,
  purpose           text not null default 'errand'
                    check (purpose in ('errand','checkout','watch')),
  task_id           text,
  profile_name      text,
  vault_id          text,
  status            text not null default 'active'
                    check (status in ('active','ended','failed')),
  stealth           boolean not null default false,
  save_profile      boolean not null default false,
  human_control_expires_at timestamptz,
  human_control_returned_at timestamptz,
  recording_replay_id text,
  cdp_url_sealed    text,
  live_view_sealed  text,
  replay_views_sealed jsonb not null default '{}'::jsonb,
  ended_at          timestamptz,
  version           integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index kernel_sessions_user_idx on kernel_sessions (user_id, created_at desc);
alter table kernel_sessions enable row level security;
create policy own_kernel_sessions on kernel_sessions for select using (user_id = auth.uid());

-- One Kernel vault per user, inside their per-user project.
create table kernel_vaults (
  user_id   uuid primary key references users(id) on delete cascade,
  project_id text not null,
  vault_id   text not null unique,
  vault_name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table kernel_vaults enable row level security;
create policy own_kernel_vaults on kernel_vaults for select using (user_id = auth.uid());

-- Wallet and per-purchase card items. Card aliases (the only digits that exist)
-- are delivered to the box on demand and never stored here — only masks,
-- state, and the frozen purchase they were minted for.
create table kernel_vault_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  vault_id    text not null,
  item_key    text not null,
  provider    text not null check (provider in ('link','agentcard')),
  kind        text not null check (kind in ('wallet','card')),
  state       text not null,
  brand       text,
  last4       text,
  payment_method_id text,
  frozen_purchase jsonb,
  purchase_id uuid,
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (vault_id, item_key)
);
create index kernel_vault_items_user_idx on kernel_vault_items (user_id);
alter table kernel_vault_items enable row level security;
create policy own_kernel_vault_items on kernel_vault_items for select using (user_id = auth.uid());

-- Provider-hosted action (Link OAuth, card enrollment, spend approval). The
-- owner-facing presenter redeems a fragment token, opens this row's sealed URL
-- once, and redirects — the URL is never stored or sent in the clear.
create table kernel_actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  item_key   text,
  action     text not null,
  url_sealed text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index kernel_actions_user_idx on kernel_actions (user_id, created_at desc);
alter table kernel_actions enable row level security;
create policy own_kernel_actions on kernel_actions for select using (user_id = auth.uid());

-- Verified, owner-approved purchase objects for the Kernel card lane
-- (propose → backend quote → freeze → decide → authorize → aliases → fill →
-- submit-once → reconcile). The purchase column is the frozen quote the owner
-- approved; nothing about it can be re-proposed by the agent afterward.
create table kernel_purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  decision_id  uuid references decisions(id) on delete set null,
  kernel_session_id text,
  item_key     text,
  purchase     jsonb not null,
  card_item_id text,
  status       text not null default 'proposed'
               check (status in ('proposed','pending_approval','authorized','ready',
                 'consumed','submitted','unknown_outcome','failed','expired',
                 'declined','cancelled')),
  submitted_at timestamptz,
  outcome      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index kernel_purchases_user_idx on kernel_purchases (user_id, created_at desc);
alter table kernel_purchases enable row level security;
create policy own_kernel_purchases on kernel_purchases for select using (user_id = auth.uid());

-- link.wzrd.tech/<slug> payment links: one public slug per product. The row is
-- public-read by design — the link page renders only listing data that is
-- already public on the storefront — but writes stay owner-scoped.
create table pay_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references storefront_products(id) on delete cascade,
  slug       text not null unique,
  status     text not null default 'active' check (status in ('active','paused')),
  views      bigint not null default 0,
  checkouts  bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);
create index pay_links_slug_idx on pay_links (slug);
alter table pay_links enable row level security;
create policy own_pay_links on pay_links for select using (user_id = auth.uid());
create policy public_pay_links_read on pay_links
  for select using (status = 'active');

-- Shopify/catalog sync refs on products (provider -> {external_id, url, synced_at}).
alter table storefront_products
  add column if not exists external_refs jsonb not null default '{}'::jsonb;
comment on column storefront_products.external_refs is
  'Provider-side ids/URLs reported by box sync skills (e.g. shopify). Value-free refs only — never credentials.';

-- A checkout handoff may ride a Kernel cloud session instead of the box Chrome.
alter table checkout_handoffs
  add column if not exists kernel_session_id uuid references kernel_sessions(id) on delete set null;
comment on column checkout_handoffs.kernel_session_id is
  'Kernel cloud session driving this handoff; null = box-local browser lane.';

-- 'watch' card kind for Kernel playback cards.
alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout','watch'));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout','watch'));

insert into mini_apps (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values ('watch', '/mini/watch', 'render', '{}', null, 'Watch', 'Watch your agent work.', 'public', 'single', 'published')
on conflict (slug) do update set route = excluded.route, kind = excluded.kind, name = excluded.name,
  description = excluded.description, visibility = excluded.visibility, access = excluded.access,
  status = excluded.status, updated_at = now();
