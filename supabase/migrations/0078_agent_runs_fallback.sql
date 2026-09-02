-- Gateway fallback attribution: when an OpenRouter/Venice family degrades and
-- the gateway re-dispatches to OpenAI, model_family/model already record what
-- actually served. This records what the user ASKED for, so a silent fallback
-- is visible in the receipts instead of looking like an OpenAI turn.
alter table agent_runs add column if not exists fallback_from text;

comment on column agent_runs.fallback_from is
  'Requested model family when the gateway fell back to another provider; null when the requested family served the turn.';
