-- V6 shopping: fill-ticket redemption ledger + mint/redeem audit actions.
--
-- Fill tickets are single-use HMAC tokens over (user, item_id, host,
-- amount_band, jti, exp) minted only on an approved purchase_review
-- decision (C20). This ledger is the single-use guarantee, mirroring
-- miniapp_redemptions: the first insert of a jti wins; replays are
-- rejected. It stores claim metadata only — never a card value (C18).

create table fill_ticket_redemptions (
  jti          text primary key,
  user_id      uuid not null references users(id) on delete cascade,
  item_id      uuid,
  host         text not null,
  amount_band  text not null,
  redeemed_at  timestamptz not null default now()
);

alter table fill_ticket_redemptions enable row level security;
-- Default-deny; service role is the sole reader/writer.

-- §9: anything that mints logs mint and redeem as distinct events with jti.
alter table vault_events drop constraint vault_events_action_check;
alter table vault_events add constraint vault_events_action_check
  check (action in
         ('create','update','delete','reveal','fill_requested','fill_approved',
          'fill_denied','env_injected','manager_enabled','manager_disabled',
          'grant_site','revoke_site','ticket_minted','ticket_redeemed'));

-- The purchase_review live card on iMessage rides the vault mini-app,
-- cooldown-governed like every agent-initiated card.
alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in ('computer','calendar','vault','browser'));

-- Owner-initiated gate for offer-the-fill (C20's tier clause): the flush job
-- remembers which trust tier the burst came from, so the purchase route can
-- refuse offers on tier-1 conversations. Tier-2 never reaches the flush.
alter table flush_jobs add column sender_tier int;
