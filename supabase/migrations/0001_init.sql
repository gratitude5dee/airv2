create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── identity ────────────────────────────────────────────────────────────────
create table users (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  status              text not null default 'pending'
                      check (status in ('pending','active','suspended','deleted')),
  username            citext unique,
  username_changed_at timestamptz,
  wallet_address      text unique,
  thirdweb_user_id    text unique
);

-- Username change limited to once per 30 days (product rule).
create or replace function enforce_username_cooldown() returns trigger as $$
begin
  if new.username is distinct from old.username
     and old.username_changed_at is not null
     and old.username_changed_at > now() - interval '30 days' then
    raise exception 'username_cooldown_active'
      using detail = to_char(old.username_changed_at + interval '30 days', 'YYYY-MM-DD');
  end if;
  if new.username is distinct from old.username then
    new.username_changed_at := now();
  end if;
  return new;
end $$ language plpgsql;

create trigger trg_username_cooldown before update on users
  for each row execute function enforce_username_cooldown();

-- ─── routing ─────────────────────────────────────────────────────────────────
-- A user may reach the agent from several addresses. This is the lookup that
-- the inbound webhook performs before it knows anything else.
create table handles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  platform    text not null check (platform in ('imessage','whatsapp','telegram','email')),
  address     text not null,                       -- E.164 or email
  verified_at timestamptz,
  unique (platform, address)
);
create index on handles (user_id);

-- Who is allowed to write to this user's agent, and how far they are trusted.
-- The RICH contact record lives in the box (it is user content); this is only
-- the projection the router needs before it knows anything else. See §2.5c.
create table senders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  platform    text not null,
  address     text not null,                       -- E.164 or email
  trust_tier  smallint not null default 2 check (trust_tier in (0,1,2)),
  first_seen  timestamptz not null default now(),
  unique (user_id, platform, address)
);
create index on senders (platform, address);

-- The agent's own addresses, provisioned via AgentMail. Local-part derives
-- from users.username, so a rename must ADD a row, never rewrite one — old
-- cards and CC'd threads keep resolving. `is_primary` is what it sends from.
-- AgentMail pod_id is derivable (client_id = user_id) but stored for clarity.
create table agent_addresses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  address           citext not null unique,        -- agentuser@wzrd.tech
  agentmail_pod_id  text not null,
  agentmail_inbox_id text not null,
  is_primary        boolean not null default false,
  created_at        timestamptz not null default now(),
  retired_at        timestamptz                    -- alias still routes; never reused
);
create unique index one_primary_per_user
  on agent_addresses (user_id) where is_primary;

-- Plan + the abstraction behind "Speed & Intelligence". The tier name is the
-- only thing the user sees; the mapping to real model ids lives in the
-- inference gateway so it can change without touching a single box (§2.5a).
create table entitlements (
  user_id            uuid primary key references users(id) on delete cascade,
  plan               text not null default 'free' check (plan in ('free','paid')),
  speed_tier         text not null default 'balanced'
                     check (speed_tier in ('fast','balanced','deep')),
  monthly_cap_usd    numeric(10,2) not null default 5.00,
  spend_mtd_usd      numeric(10,4) not null default 0,
  phone_entitled     boolean not null default false,
  suspended_reason   text
);

-- Lines leased from Photon. In the beta every line is 'personal' and bound to
-- exactly one user at provisioning time (§2.5d). `role` stays in the schema so
-- a public 'onboarding' line is additive if self-serve signup arrives later.
create table lines (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null default 'imessage',
  phone             text not null unique,          -- E.164, or 'shared'
  role              text not null default 'personal'
                    check (role in ('personal','onboarding')),
  mode              text not null check (mode in ('dedicated','shared')),
  assigned_user_id  uuid references users(id) on delete set null,
  assigned_at       timestamptz,
  new_convos_today  int not null default 0,        -- Photon caps at 50/line/day
  provider_ref      text
);
create unique index one_line_per_user
  on lines (assigned_user_id) where role = 'personal' and assigned_user_id is not null;
create unique index one_onboarding_line on lines (role) where role = 'onboarding';

-- Operator-driven provisioning. The user's phone is known BEFORE the line
-- exists, so the line is bound to one handle from birth and there is no claim
-- code to steal: anyone else who texts it is simply tier 2 (§2.5d).
create table provisioning (
  user_id       uuid primary key references users(id) on delete cascade,
  state         text not null default 'created'
                check (state in ('created','line_assigned','invited','claimed','active','abandoned')),
  bound_phone   text not null,                     -- E.164, tier-0 from the start
  invited_at    timestamptz,
  claimed_at    timestamptz,                       -- first inbound from bound_phone
  otp_attempts  smallint not null default 0,
  operator      text,                              -- who set this account up
  updated_at    timestamptz not null default now()
);

-- ─── the agent ───────────────────────────────────────────────────────────────
create table boxes (
  user_id            uuid primary key references users(id) on delete cascade,
  provider           text not null default 'ascii',
  provider_box_id    text not null unique,          -- bx_...
  state              text not null
                     check (state in ('provisioning','ready','idle','stopped','failed')),
  hosted_url         text,                          -- https://<sub>-8642.on.ascii.dev
  hosted_token       text,                          -- the ?_token= bearer. SECRET.
  api_server_key     text,                          -- Hermes API_SERVER_KEY. SECRET.
  template_version   text,
  last_active_at     timestamptz,
  stop_after         timestamptz,                   -- orchestrator's idle deadline
  created_at         timestamptz not null default now()
);
create index on boxes (stop_after) where state in ('ready','idle');

-- ─── idempotency ─────────────────────────────────────────────────────────────
-- Spectrum delivers at-least-once and retries on 5xx/timeout. message.id is
-- stable across every delivery and retry of the same message.
create table inbound_events (
  webhook_id   text not null,
  message_id   text not null,
  user_id      uuid references users(id) on delete set null,
  received_at  timestamptz not null default now(),
  status       text not null default 'received'
               check (status in ('received','dispatched','failed','ignored')),
  primary key (webhook_id, message_id)
);
create index on inbound_events (received_at);   -- for the 48h TTL sweep

-- ─── connectors ──────────────────────────────────────────────────────────────
-- Which toolkits a user has authorized. The *tokens* live with Composio and
-- reach the agent as an MCP endpoint; they are never stored here.
create table connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  provider            text not null default 'composio',
  toolkit             text not null,               -- 'gmail', 'telegram', ...
  external_account_id text,
  status              text not null
                      check (status in ('pending','active','revoked','error')),
  connected_at        timestamptz,
  unique (user_id, provider, toolkit)
);

-- ─── audit / billing ─────────────────────────────────────────────────────────
create table agent_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  hermes_run_id text,
  trigger       text check (trigger in ('imessage','voice','web','email','cron')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  outcome       text,
  box_seconds   int,
  cost_usd      numeric(10,6)
);
create index on agent_runs (user_id, started_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Default deny. The control plane uses the service role. End users, if they
-- ever hold a Supabase JWT, see only their own rows and never boxes.*.
alter table users            enable row level security;
alter table handles          enable row level security;
alter table senders          enable row level security;
alter table agent_addresses  enable row level security;
alter table entitlements     enable row level security;
alter table lines            enable row level security;
alter table provisioning     enable row level security;
alter table boxes            enable row level security;
alter table inbound_events   enable row level security;
alter table connections      enable row level security;
alter table agent_runs       enable row level security;

create policy own_user   on users           for select using (id = auth.uid());
create policy own_handle on handles         for select using (user_id = auth.uid());
create policy own_conn   on connections     for select using (user_id = auth.uid());
create policy own_runs   on agent_runs      for select using (user_id = auth.uid());
create policy own_sender on senders         for select using (user_id = auth.uid());
create policy own_addr   on agent_addresses for select using (user_id = auth.uid());
create policy own_ent    on entitlements    for select using (user_id = auth.uid());
-- boxes, lines, inbound_events: no user-facing policy. Service role only.
