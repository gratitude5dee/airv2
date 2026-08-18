-- V9 MA1: mini_apps v2 — the registry becomes the single source of truth the
-- loader, store home, discovery index, and iMessage card mints all read
-- (goal.md §4.1/§6). Forward-only; RLS default-deny with the service role as
-- the sole reader/writer, matching 0007.

alter table mini_apps
  add column owner_user_id uuid references users(id) on delete cascade,
  add column name text not null default '',
  add column description text not null default '',
  add column icon_key text,
  add column publisher_username citext,
  add column publisher_wallet text,
  add column agent_identity text,
  add column visibility text not null default 'private'
    check (visibility in ('public','unlisted','private')),
  add column access text not null default 'single'
    check (access in ('single','multiplayer')),
  add column password_hash text,
  add column x402_enabled boolean not null default false,
  add column x402_price_usdc numeric(10,6),
  add column x402_config jsonb,
  add column plugin_signin_enabled boolean not null default false,
  add column status text not null default 'published'
    check (status in ('draft','published','suspended')),
  add column bundle_version text,
  add column listed_at timestamptz,
  add column updated_at timestamptz not null default now();

-- Published (user-owned) slugs are <username>-<appname>; first-party rows
-- (owner_user_id is null) keep bare reserved-word slugs.
alter table mini_apps add constraint mini_apps_published_slug_format
  check (
    owner_user_id is null
    or slug ~ '^[a-z0-9_]{2,24}-[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'
  );

-- Reconcile the 0007 seed: kanban + todo gain display metadata and stay
-- owner-only (private/single) exactly as the loader has served them.
update mini_apps set
  name = 'Kanban',
  description = 'A board your agent keeps in sync — move cards, add tasks, and ask for changes in plain language.',
  visibility = 'private', access = 'single', status = 'published',
  updated_at = now()
where slug = 'kanban';

update mini_apps set
  name = 'To-Do',
  description = 'A shared list you and your agent both write to.',
  visibility = 'private', access = 'single', status = 'published',
  updated_at = now()
where slug = 'todo';

-- Seed the fourteen first-party store apps (goal.md §MA1). Apps whose
-- renderer already exists in the loader are published; the rest are drafts
-- until their renderer lands (sessions D–F flip them).
insert into mini_apps
  (slug, route, kind, scopes, backing_tool, name, description, visibility, access, status)
values
  ('onboarding', '/mini/onboarding', 'input', '{onboarding:read,onboarding:write}', null,
   'Onboarding', 'Set up your agent: username, email, connected accounts, secrets, and your first conversation.',
   'private', 'single', 'draft'),
  ('vault', '/mini/vault', 'input', '{vault:read,vault:write}', null,
   'Secrets', 'Your encrypted logins, cards, and keys — managed by you, filled by your agent only with approval.',
   'private', 'single', 'published'),
  ('connect', '/mini/connect', 'input', '{connectors:read,connectors:write}', null,
   'Connect', 'One screen to sign your agent into everything — Gmail, Calendar, and every other toolkit.',
   'private', 'single', 'draft'),
  ('computer', '/mini/computer', 'passthrough', '{computer:view}', null,
   'Computer', 'Watch your agent''s computer live.',
   'private', 'single', 'published'),
  ('browser', '/mini/browser', 'passthrough', '{browser:view}', null,
   'Browser', 'Watch the browser your agent drives — you always click the final button.',
   'private', 'single', 'published'),
  ('calendar', '/mini/calendar', 'input', '{calendar:read,calendar:write}', null,
   'Calendar', 'Your next 7 days, with invite approvals inline.',
   'private', 'single', 'published'),
  ('video', '/mini/video', 'input', '{video:read,video:write}', null,
   'Video Editor', 'Timeline documents your agent renders — trim, caption, and cut by asking.',
   'private', 'single', 'draft'),
  ('image', '/mini/image', 'input', '{image:read,image:write}', null,
   'Image Editor', 'Layered image documents — reorder, retouch, and generate with your agent.',
   'private', 'single', 'draft'),
  ('crm', '/mini/crm', 'input', '{crm:read,crm:write}', 'crm_update',
   'People', 'A personal CRM your agent maintains from your conversations.',
   'private', 'single', 'draft'),
  ('analytics', '/mini/analytics', 'render', '{analytics:read}', null,
   'Analytics', 'Agent activity, ads, funnels, store opens, and revenue — one read-only surface.',
   'private', 'single', 'draft'),
  ('inbox', '/mini/inbox', 'input', '{inbox:read,inbox:draft}', null,
   'Inbox', 'Your agent''s email — read threads and compose drafts; nothing sends without you.',
   'private', 'single', 'draft'),
  ('pay', '/mini/pay', 'input', '{pay:read,pay:write}', null,
   'Pay', 'Approve payments — fiat by Stripe Link or USDC from your wallet.',
   'private', 'single', 'draft'),
  ('shop', '/mini/shop', 'input', '{shop:read,shop:write}', 'shop_update',
   'Storefront', 'An agent-first storefront: products, checkout, and promotion in one conversation.',
   'private', 'single', 'draft'),
  ('settings', '/mini/settings', 'input', '{settings:read,settings:write}', null,
   'Settings', 'Username, speed, timezone, memory, plugin sessions, storage, and exports.',
   'private', 'single', 'draft');

create index mini_apps_store_idx on mini_apps (status, visibility);
create index mini_apps_owner_idx on mini_apps (owner_user_id);

-- Pinned apps on the /home Apps tab.
create table miniapp_installs (
  user_id uuid not null references users(id) on delete cascade,
  app_id  uuid not null references mini_apps(id) on delete cascade,
  installed_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

-- Multiplayer guest grants (MA4): a grant scopes exactly one app+resource;
-- redemption mints a guest session and counts against max_uses.
create table miniapp_guest_grants (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  resource_id text not null,
  created_by uuid not null references users(id) on delete cascade,
  max_uses int not null default 25,
  uses int not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index miniapp_guest_grants_creator_idx on miniapp_guest_grants (created_by);

-- x402 settlement ledger (MA6/MA9): the receipt exists before access is
-- granted; jti doubles as the replay guard.
create table x402_receipts (
  jti text primary key,
  app_id uuid not null references mini_apps(id) on delete cascade,
  payer_address text not null,
  amount_usdc numeric(12,6) not null,
  tx_hash text not null,
  settled_at timestamptz not null default now()
);

create index x402_receipts_app_idx on x402_receipts (app_id);

-- MA9 gate ledger: gate_challenged / gate_settled / app_opened extend the
-- existing mint/open/redeem logging.
create table miniapp_gate_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  kind text not null check (kind in ('gate_challenged','gate_settled','app_opened')),
  ref text,
  created_at timestamptz not null default now()
);

create index miniapp_gate_events_app_idx on miniapp_gate_events (app_id, created_at);

-- Per-user public media prefix on the platform R2 bucket (MA4).
create table user_buckets (
  user_id uuid primary key references users(id) on delete cascade,
  prefix text not null unique,
  bytes_used bigint not null default 0,
  quota_bytes bigint not null default 2147483648
);

-- WZRD.Tech plugin device-code sessions (MA2.4): hashed bearer, revocable.
create table plugin_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tool text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index plugin_tokens_user_idx on plugin_tokens (user_id);

-- The agent may now send cards for every store app (§4.3) — cooldowns keep
-- applying per (user, kind).
alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop','settings'
  ));

alter table miniapp_installs enable row level security;
alter table miniapp_guest_grants enable row level security;
alter table x402_receipts enable row level security;
alter table miniapp_gate_events enable row level security;
alter table user_buckets enable row level security;
alter table plugin_tokens enable row level security;
-- Default-deny; the service role is the sole reader/writer (goal.md §6).
