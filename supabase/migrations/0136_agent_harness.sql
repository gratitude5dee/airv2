-- Agent harnesses: the agent runtime on a user's compute is a dimension
-- parallel to the compute environment. 'hermes' is the existing fleet and
-- stays the default; 'exo' is exo-agentd baked by the zap-heavy-exo template.
-- Every harness speaks the same /v1/runs + SSE contract, so nothing about the
-- hosted route columns changes — only which template is forked and which
-- per-box files carry the API key and gateway binding.
--
-- Template pointers gain the harness as a second axis: a Hermes template can
-- never serve an exo user (different units, different state dir), so a
-- harness with no registered pointer is unavailable, not silently Hermes.
-- Forward-only and idempotent.

alter table boxes add column if not exists harness text not null default 'hermes'
  check (harness in ('hermes', 'exo'));

alter table box_environment_templates
  add column if not exists harness text not null default 'hermes'
  check (harness in ('hermes', 'exo'));

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'box_environment_templates_pkey'
      and conrelid = 'box_environment_templates'::regclass
      and array_length(conkey, 1) = 2
  ) then
    alter table box_environment_templates drop constraint box_environment_templates_pkey;
    alter table box_environment_templates
      add primary key (channel, environment, harness);
  end if;
end $$;
