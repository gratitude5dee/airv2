-- Provider & model choice (Settings). Three additions:
--
-- 1. entitlements grows two nullable per-user model selections and the
--    model_family check widens to the two new families. The family/tier
--    names remain the only thing a box ever sees (ARCHITECTURE.md §2.5a);
--    the slugs below resolve at the inference gateway and nowhere else.
--
-- 2. provider_keys carries OPTIONAL user-owned provider API keys (their own
--    token spend). Values are sealed at rest (AES-256-GCM under
--    PROVIDER_VAULT_KEY, lib/crypto/secretbox.ts) exactly like
--    ad_accounts.api_key_sealed: never plaintext in Postgres, never echoed
--    to a browser, never delivered to a box. Only the gateway / creative
--    lane opens them server-side. key_hint is the last 4 characters, for
--    display only.
--
-- 3. creative_prefs stores the per-lane GMI model choice for the creative
--    commands (/imagine, /edit, /animate, /zap). Slugs are validated
--    against the server-side catalog before every write and read.

alter table entitlements
  drop constraint if exists entitlements_model_family_check;
alter table entitlements
  add constraint entitlements_model_family_check
    check (model_family in ('openai','ox-alpha','inkling','inkling-small','openrouter','venice'));
alter table entitlements
  add column if not exists openrouter_model text,
  add column if not exists venice_model text;

create table provider_keys (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  provider        text not null check (provider in ('openrouter','venice','gmi')),
  api_key_sealed  text not null,
  key_hint        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider)
);
create index on provider_keys (user_id);
alter table provider_keys enable row level security;
-- Service-role only: no policies. The anon/authenticated roles can never
-- read a sealed key.

create table creative_prefs (
  user_id        uuid primary key references users(id) on delete cascade,
  imagine_model  text,
  edit_model     text,
  animate_model  text,
  zap_model      text,
  updated_at     timestamptz not null default now()
);
alter table creative_prefs enable row level security;
