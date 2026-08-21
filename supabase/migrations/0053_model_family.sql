-- Per-user model family, on top of the speed tiers. Ox Alpha is what a user
-- gets if they never touch the setting; the `openai` family keeps resolving
-- through speed_tier. Like the tier, the family name is the only thing a box
-- or browser ever sees — the mapping to real model ids stays in the gateway.
alter table entitlements
  add column model_family text not null default 'ox-alpha'
    check (model_family in ('openai','ox-alpha','inkling','inkling-small'));
