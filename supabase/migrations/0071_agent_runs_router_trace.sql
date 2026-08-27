-- Task-router trace columns on gateway completions: which tier the router
-- resolved, what the box asked for, the reasoning effort injected, and
-- wall-clock latency. Metadata only (C4) — no prompts or message bodies.
alter table agent_runs add column speed_tier text;
alter table agent_runs add column requested_model text;
alter table agent_runs add column reasoning_effort text;
alter table agent_runs add column latency_ms int;
