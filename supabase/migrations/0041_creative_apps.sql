-- V9 Session F (MA7): the creative three — image editor, video editor,
-- analytics. Renderer modules exist at lib/miniapps/apps/{image,video,
-- analytics}.tsx, so flip their 0034 registry rows draft → published.
-- Forward-only; no new tables — documents live box-side (C4) and analytics
-- is a read-only surface over ledgers that already exist.

update mini_apps
set status = 'published', updated_at = now()
where slug in ('image', 'video', 'analytics')
  and owner_user_id is null;

-- Video renders run inside the user's box (the template creative plugin owns
-- ffmpeg; no render bytes transit Postgres) but are metered through the same
-- creative job ledger as generation: a 'video_render' job counts against the
-- daily cap and lands a cost_events row on delivery.
alter table creative_jobs drop constraint creative_jobs_mode_check;
alter table creative_jobs
  add constraint creative_jobs_mode_check
  check (mode in ('imagine', 'animate', 'zap', 'video_render'));
