-- MA3: agent-staged app drafts surface as a Needs-you decision. The agent
-- can stage a draft; the status flip to published is ALWAYS the owner acting
-- on this decision (or the Publish surface) — never the agent directly.
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'miniapp_publish'));
