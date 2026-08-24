-- Command lanes for the Berd and Buzz mini-apps (berd.goal.md §MA-B3,
-- buzz.goal.md §MA-Z3). The owner's mini-app action mints an envelope; the
-- paired device (desktop or Box-hosted) pulls it outbound and posts the
-- result, which is merged into the box-side document. Postgres holds the
-- lifecycle ledger only: group/verb names, states, and timestamps. Command
-- arguments can carry content (a system prompt, a message body), so they are
-- sealed at rest (AES-256-GCM) and nulled the moment the device claims the
-- envelope — the plaintext lives only in transit to the signer and in the
-- box document afterwards (C4). Each link also gets a sealed per-device
-- envelope-signing key so the device can verify that an envelope really came
-- from this control plane. Forward-only and idempotent.

alter table berd_links add column if not exists envelope_key_sealed text;
alter table buzz_links add column if not exists envelope_key_sealed text;

create table if not exists berd_envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resource_id text not null,
  cmd_group text not null,
  action text not null,
  args_sealed text,
  state text not null default 'queued'
    check (state in ('queued', 'sent', 'done', 'failed')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  note text
);
create index if not exists berd_envelopes_user_state_idx
  on berd_envelopes (user_id, state);

create table if not exists buzz_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resource_id text not null,
  cmd_group text not null,
  verb text not null,
  args_sealed text,
  state text not null default 'queued'
    check (state in ('queued', 'sent', 'done', 'failed')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  note text
);
create index if not exists buzz_intents_user_state_idx
  on buzz_intents (user_id, state);

alter table berd_envelopes enable row level security;
alter table buzz_intents enable row level security;
