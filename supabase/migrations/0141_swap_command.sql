-- /swap joins the explicit creative commands: photo + clip/link/preset →
-- minimax/h3-max/recast on the fal lane. creative_jobs.mode learns 'swap'.
alter table creative_jobs drop constraint if exists creative_jobs_mode_check;
alter table creative_jobs add constraint creative_jobs_mode_check
  check (mode in ('imagine','animate','zap','swap','video_render','draw','freeze','twin'));
