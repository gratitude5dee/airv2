-- R-P0-5: enable RLS on the six public tables that never had it.
-- Default deny, no policies — only the control plane's service role reads
-- or writes these tables (convention from 0072, matching 0068's comment).
alter table template_releases          enable row level security;
alter table box_channels               enable row level security;
alter table sync_jobs                  enable row level security;
alter table sync_job_boxes             enable row level security;
alter table box_environment_templates  enable row level security;
alter table miniapp_slug_holds         enable row level security;
