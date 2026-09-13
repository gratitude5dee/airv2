-- GMI Cloud as a chat-lane family (docs/goal-gmi-models.md).
--
-- 1. entitlements_model_family_check widens to 'gmi'. The family resolves
--    per tier at the inference gateway — fast → zai-org/GLM-5.3-Flash,
--    balanced → openai/gpt-5.6-luna, deep → openai/gpt-6-astra — so a box's
--    delegated children (delegation.model = "fast") always land on the cheap
--    lane whatever the owner's parent model is. The family/tier names remain
--    the only thing a box ever sees (ARCHITECTURE.md §2.5a).
--
-- 2. gmi_model carries the OPTIONAL single-model pin — like
--    openrouter_model / venice_model, validated against the server-side
--    GMI_MODELS catalog on every write and every gateway read. The pin binds
--    the owner-visible tier only; "fast" requests still resolve to GLM
--    unconditionally (the child lane stays cheap).

alter table entitlements
  drop constraint if exists entitlements_model_family_check;
alter table entitlements
  add constraint entitlements_model_family_check
    check (model_family in ('openai','ox-alpha','inkling','inkling-small','anthropic','minimax-m3','minimax-m2.7','openrouter','venice','gmi'));
alter table entitlements
  add column if not exists gmi_model text;
