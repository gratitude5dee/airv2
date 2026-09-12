-- /trade mini-app + guarded trading (docs/trade/plan.md).
--
-- mini_apps row: owner-only, no guest surface (access='single').
-- trade_connections: one row per (user, provider); the sealed Coinbase key
--   lives here (secretbox under PROVIDER_VAULT_KEY) — the browser only ever
--   sees key_id_hint, the box never sees either (C18, T1).
-- trade_orders: the order ledger AND the mutation/idempotency store —
--   state machine previewed → pending_approval → submitting → submitted →
--   filled | cancelled | rejected | denied | expired | uncertain. A partial
--   unique index enforces T3 (one pending approval per user) at the DB level.
-- decisions widens by three kinds: trade_order, trade_cancel, trade_settings.

-- ─── registry row + card kinds ───────────────────────────────────────────
insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description,
   visibility, access, status)
values
  ('trade', '/mini/trade', 'render', '{trade:read,trade:stage}', null,
   'Trade', 'Buy and sell crypto on Coinbase — every order needs your approval.',
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
    'settings','ads','home','persona','feedback','create','app','draw',
    'trade'
  ));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads','home','persona','feedback','create','app','draw',
    'trade'
  ));

alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'crm_update','miniapp_publish','miniapp_backend',
                  'payment_request','shop_publish',
                  'trade_order','trade_cancel','trade_settings'));

-- ─── trade connections ────────────────────────────────────────────────────
create table trade_connections (
  user_id          uuid not null references users(id) on delete cascade,
  provider         text not null check (provider = 'coinbase'),
  key_id           text,                        -- CDP key id or name
  key_id_hint      text,                        -- last 4, display only (C18)
  secret_sealed    text,                        -- AES-256-GCM ciphertext
  portfolio_uuid   text,
  portfolio_name   text,
  mode             text not null default 'paper'
    check (mode in ('paper','live')),
  status           text not null default 'disconnected'
    check (status in ('disconnected','connected','error')),
  per_order_usd_cap numeric(14,2) not null default 250,
  daily_usd_cap     numeric(14,2) not null default 1000,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table trade_connections enable row level security;
create policy own_trade_connections on trade_connections
  for select using (user_id = auth.uid());

-- ─── trade orders ─────────────────────────────────────────────────────────
create table trade_orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  mode               text not null check (mode in ('paper','live')),
  product_id         text not null,
  side               text not null check (side in ('BUY','SELL')),
  order_type         text not null check (order_type in ('market','limit','stop_limit')),
  base_size          text,
  quote_size         text,
  limit_price        text,
  stop_price         text,
  stop_direction     text check (stop_direction in ('up','down')),
  client_order_id    uuid not null,
  state              text not null check (state in (
    'previewed','pending_approval','approved','submitting','submitted',
    'partially_filled','filled','cancelled','rejected','denied','expired',
    'uncertain'
  )),
  decision_id        uuid references decisions(id) on delete set null,
  venue_order_id     text,                      -- Coinbase order id / paper id
  preview            jsonb,                     -- signed token + venue preview
  preview_expires_at timestamptz,
  notional_usd       numeric(18,2),
  requested_by       text not null default 'miniapp',
  error_code         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, client_order_id)
);
create index trade_orders_user_idx
  on trade_orders (user_id, created_at desc);
create index trade_orders_open_idx
  on trade_orders (user_id) where state in ('submitted','partially_filled');
create index trade_orders_expiry_idx
  on trade_orders (preview_expires_at)
  where state in ('previewed','pending_approval');
-- T3 at the database level: at most one live approval per user, period.
create unique index trade_orders_pending_idx
  on trade_orders (user_id) where state = 'pending_approval';

alter table trade_orders enable row level security;
create policy own_trade_orders on trade_orders
  for select using (user_id = auth.uid());
