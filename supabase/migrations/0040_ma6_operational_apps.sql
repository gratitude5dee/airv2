-- MA6: the operational five (computer, browser, calendar, inbox, crm).
-- Forward-only.

-- #6 Calendar personas: view-state metadata on the source rows — the event
-- spine (box-side events.json) is untouched, so dedupe/sync are unchanged.
-- persona is a short owner-chosen bucket (work/personal/custom); color is a
-- hex accent for the tab and event dots.
alter table calendar_accounts add column persona text not null default 'personal';
alter table calendar_accounts add column color text
  check (color is null or color ~ '^#[0-9a-f]{6}$');

-- #9 CRM: tier-derived agent edits are decision-gated (crm_update cards).
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'miniapp_publish','crm_update'));

-- Wave 2 goes live: inbox and crm leave draft (computer/browser/calendar
-- were already published in 0034).
update mini_apps
set status = 'published', updated_at = now()
where slug in ('inbox', 'crm') and owner_user_id is null;
