-- Bring-your-own token subscriptions (Sign in with ChatGPT / Claude Code) ---
--
-- entitlements.token_provider records WHO pays for the user's chat turns:
--   'wzrd'      — the platform router (default; metered platform spend)
--   'openai'    — the user's own ChatGPT plan via Sign in with ChatGPT
--                 (SIWC), routed through the gateway with the user's token
--   'anthropic' — the user's Claude Pro/Max subscription, served box-side by
--                 the official claude CLI provider plugin (the credential
--                 lives in ~/.claude on the box and never enters Postgres)
-- entitlements.byo_model is the model id the user pinned inside their
-- subscription, validated against the discovered catalog at write time and
-- again at the gateway.
--
-- provider_oauth holds OAuth account state under the same discipline as
-- provider_keys (sealed at rest with PROVIDER_VAULT_KEY): for 'openai' the
-- full SIWC credential bundle (access/refresh/id_token); for 'anthropic'
-- only the account label + model cache — Anthropic subscription credentials
-- stay on the user's own box.
--
-- provider_oauth_attempts carries one pending sign-in per provider: the
-- OAuth state plus the sealed PKCE verifier/nonce/redirect_uri needed to
-- finish the exchange. Rows are disposable; attempts expire by age in code.
-- Forward-only and idempotent.

alter table entitlements
  add column if not exists token_provider text not null default 'wzrd'
    check (token_provider in ('wzrd', 'openai', 'anthropic')),
  add column if not exists byo_model text;

create table if not exists provider_oauth (
  user_id        uuid not null references users(id) on delete cascade,
  provider       text not null check (provider in ('openai', 'anthropic')),
  bundle_sealed  text not null,
  account_label  text,
  client_id      text,
  host_id        text,
  id_token_sub   text,
  expires_at     timestamptz,
  models_cache   jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table provider_oauth enable row level security;
-- Service-role only: no policies. Same posture as provider_keys — the
-- sealed bundle is never readable by the anon/authenticated roles.

create table if not exists provider_oauth_attempts (
  user_id        uuid not null references users(id) on delete cascade,
  provider       text not null check (provider in ('openai', 'anthropic')),
  state          text not null,
  attempt_sealed text not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table provider_oauth_attempts enable row level security;
-- Service-role only.
