-- R-SEC-04: replay protection on the Create bridge (lib/create/bridge.ts).
-- A request's x-air-sig is claimed atomically with
-- `insert ... on conflict do nothing`; a duplicate means the same signed
-- request is being replayed inside the ±300 s tolerance window and is a
-- 409. Rows outlive the window by 2x and are deleted on each claim.
--
-- Service-role only: no user column, so no owner policy — RLS with no
-- policies denies every non-service principal.

create table create_bridge_nonces (
  sig        text primary key,
  created_at timestamptz not null default now()
);

create index create_bridge_nonces_created_idx
  on create_bridge_nonces (created_at);

alter table create_bridge_nonces enable row level security;
