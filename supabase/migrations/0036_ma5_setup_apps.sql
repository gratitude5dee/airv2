-- MA5 wave 1: the setup four ship. The onboarding/connect/settings renderers
-- exist now, so their registry rows leave draft (vault shipped published in
-- 0034). First-party rows only — owner rows are untouched.
update mini_apps
   set status = 'published', updated_at = now()
 where slug in ('onboarding', 'connect', 'settings')
   and owner_user_id is null;

-- MA5 #2 card-manager affordance: the owner may mark one card as the default
-- for purchase flows. Metadata-only (a flag on the existing mirror row — the
-- card values stay box-side, C4/C18 unchanged).
alter table vault_items
  add column if not exists default_for_purchases boolean not null default false;
