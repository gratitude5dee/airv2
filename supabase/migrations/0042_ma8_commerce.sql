-- MA8 commerce: merchants (Stripe Connect Standard), storefront product
-- projections (public listing data only — catalogs stay box-side, C4),
-- orders + tickets, payment requests, and the storefront funnel ledger.
-- The platform never custodies merchant funds: charges are created directly
-- on the merchant's connected account and only receipts land here.

create table merchants (
  user_id           uuid primary key references users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table merchants enable row level security;

-- Published projection of the box-side catalog: public metadata only
-- (price, name, image on R2, inventory). The source of truth stays in
-- .hermes/miniapps/shop/catalog.json; publishing it is a decision.
create table storefront_products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  product_key  text not null,
  kind         text not null check (kind in ('physical','digital','service','event_ticket')),
  name         text not null,
  description  text not null default '',
  image_url    text,
  price_cents  integer not null check (price_cents > 0),
  currency     text not null default 'usd' check (currency = 'usd'),
  inventory    integer check (inventory >= 0),
  active       boolean not null default true,
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, product_key)
);
create index storefront_products_user_idx on storefront_products (user_id, active);
alter table storefront_products enable row level security;

-- Orders are receipts: amounts are computed server-side from the product
-- row at checkout creation and reconciled by signed webhooks. buyer_key_hash
-- authorizes the anonymous buyer's receipt page; ticket_code backs QR
-- check-in for event tickets.
create table orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references users(id) on delete cascade,
  product_id               uuid not null references storefront_products(id) on delete cascade,
  quantity                 integer not null check (quantity > 0 and quantity <= 10),
  amount_cents             integer not null check (amount_cents > 0),
  currency                 text not null default 'usd',
  status                   text not null default 'pending'
                           check (status in ('pending','paid','refunded','expired')),
  stripe_session_id        text unique,
  stripe_payment_intent_id text,
  buyer_key_hash           text not null,
  attribution              text,
  ticket_code              text unique,
  checked_in_at            timestamptz,
  created_at               timestamptz not null default now(),
  resolved_at              timestamptz
);
create index orders_user_idx on orders (user_id, status, created_at desc);
create index orders_payment_intent_idx on orders (stripe_payment_intent_id);
alter table orders enable row level security;

-- MA8 #12: the generic "agent needs to buy / user needs to pay" surface.
-- Approval is the payment_request decision; fiat resolves through Stripe
-- Checkout (Link), USDC through the existing wallet transfer approval lane.
create table payment_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  amount_cents      integer check (amount_cents > 0),
  amount_display    text not null,
  currency          text not null check (currency in ('usd','usdc')),
  payee             text not null,
  payee_user_id     uuid references users(id) on delete set null,
  memo              text not null default '',
  status            text not null default 'pending'
                    check (status in ('pending','approved','paid','dismissed','expired')),
  decision_id       uuid references decisions(id) on delete set null,
  stripe_session_id text unique,
  transfer_id       uuid references wallet_transfers(id) on delete set null,
  expires_at        timestamptz not null default now() + interval '24 hours',
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index payment_requests_user_idx on payment_requests (user_id, status, created_at desc);
alter table payment_requests enable row level security;

-- Funnel ledger: visit → product view → checkout → purchase/refund, with
-- optional attribution ref so campaigns reconcile end-to-end.
create table storefront_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  product_id   uuid references storefront_products(id) on delete set null,
  kind         text not null check (kind in
               ('visit','product_view','checkout_started','purchase','refund')),
  ref          text,
  amount_cents integer,
  created_at   timestamptz not null default now()
);
create index storefront_events_user_idx on storefront_events (user_id, kind, created_at desc);
alter table storefront_events enable row level security;

-- Decision kinds: the 0040 union plus MA8's payment_request and shop_publish.
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'crm_update','miniapp_publish',
                  'payment_request','shop_publish'));

-- Wave 4 goes live: pay and shop leave draft (seeded in 0034).
update mini_apps
set status = 'published', updated_at = now()
where slug in ('pay', 'shop') and owner_user_id is null;
