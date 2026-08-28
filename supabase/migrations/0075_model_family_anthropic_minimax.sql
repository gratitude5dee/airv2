-- Onboarding's "Choose Model" card offers Anthropic and the two MiniMax
-- families alongside the GPT 5.6 family, so the entitlements check widens to
-- match lib/entitlements/models.ts. Boxes still only ever see the family
-- name; the upstream slugs resolve at the inference gateway.

alter table entitlements
  drop constraint if exists entitlements_model_family_check;
alter table entitlements
  add constraint entitlements_model_family_check
    check (model_family in ('openai','ox-alpha','inkling','inkling-small','anthropic','minimax-m3','minimax-m2.7','openrouter','venice'));
