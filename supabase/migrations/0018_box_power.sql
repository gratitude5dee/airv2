-- M10: box power. Transitional lifecycle states so the UI can show an honest
-- boot/stop progression, plus an stt cost kind for voice transcription (M13).

alter table boxes drop constraint boxes_state_check;
alter table boxes add constraint boxes_state_check
  check (state in ('provisioning','starting','ready','idle','stopping','stopped','failed'));

alter table cost_events drop constraint cost_events_kind_check;
alter table cost_events add constraint cost_events_kind_check
  check (kind in ('render','storage','ad','stt'));
