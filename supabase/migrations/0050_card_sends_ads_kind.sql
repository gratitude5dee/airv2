-- Phase 3: allow the 'ads' card kind in card_sends. Migration 0049 published
-- the ads mini-app but the kind check (last set in 0034) still enumerated the
-- original 16 kinds, so every /api/cards/ads send hit a 23514 check violation.
-- Forward-only.

alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check
  check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads'
  ));
