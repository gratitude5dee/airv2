-- R-SEC-05: approval relays must not fail silently (lib/vault/purchase.ts).
-- An approve/dismiss that fails to reach the paused run marks the decision
-- "relay_failed" — out of the pending queue (a second owner approval can
-- never re-mint the fill) — and the sweeper retries until the run answers
-- or proves gone. 0125's drop-and-recreate pattern applies verbatim.

alter table decisions drop constraint if exists decisions_status_check;
alter table decisions add constraint decisions_status_check
  check (status in ('pending','approved','dismissed','relay_failed'));
