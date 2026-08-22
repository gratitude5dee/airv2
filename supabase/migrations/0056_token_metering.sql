-- Token metering for the operator dashboard: the gateway already computes
-- cost from the upstream usage chunk, but the token counts themselves were
-- discarded. Persist them alongside cost_usd so per-user prompt/completion
-- volume is readable control-plane-side (metadata only — C4). Forward-only.

alter table agent_runs add column prompt_tokens int;
alter table agent_runs add column completion_tokens int;
