-- V3: the calendar_add decision kind — an emailed .ics becomes a pending
-- event in the box plus one Needs-you decision; approve confirms, dismiss
-- tombstones so re-sync cannot resurrect it.
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add'));
