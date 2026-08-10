-- CM3: publish verdicts land in the "Needs you" queue as two new decision
-- kinds — 'reconnect' (reauth verdict: the platform connection needs to be
-- renewed) and 'revise' (fix-content verdict: the card carries the actual
-- violated constraint in `label`).

alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect','revise'));
