-- Preserve the provider family and model that actually served each metered
-- completion, including requests that fell back from another family.
-- Forward-only.

alter table agent_runs add column model_family text;
alter table agent_runs add column model text;
