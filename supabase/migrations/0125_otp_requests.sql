-- Live sign-in code lane: the box files an otp_request when a site sends a
-- code to the owner's phone/email; the owner pastes it in the vault miniapp;
-- the box pops it exactly once and types it into the focused field. The code
-- lives only on this row (never decisions.payload, never logs) and is wiped
-- on pop; requests self-expire in minutes.

alter table decisions drop constraint if exists decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'crm_update','miniapp_publish','miniapp_backend',
                  'payment_request','shop_publish',
                  'trade_order','trade_cancel','trade_settings','muse_action',
                  'otp_request'));

create table if not exists otp_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  decision_id uuid references decisions(id) on delete cascade,
  host        text not null,
  run_id      text,
  status      text not null default 'pending'
              check (status in ('pending','resolved','denied','expired','popped')),
  -- Live credential: never logged; wiped the moment the box pops it.
  code        text,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  popped_at   timestamptz
);

create index if not exists otp_requests_user_status_idx
  on otp_requests (user_id, status, created_at desc);

alter table otp_requests enable row level security;
create policy own_otp_requests on otp_requests
  for select using (user_id = auth.uid());
