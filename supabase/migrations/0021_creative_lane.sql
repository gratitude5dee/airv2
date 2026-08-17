-- M16: the WZRD creative lane (/imagine /animate /zap). Postgres holds only
-- lifecycle bookkeeping — no prompt text and no media content ever land here
-- (C4); the prompt lives only in the request lifecycle and the bytes live in
-- the private creative-assets bucket.

create table creative_jobs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  channel             text not null check (channel in ('web','imessage')),
  mode                text not null check (mode in ('imagine','animate','zap')),
  status              text not null default 'routing' check (status in (
    'routing','submitted','polling','delivered','failed','refused','submit_unknown'
  )),
  -- The GMI request-queue id: a job with a known request id may be resumed
  -- by polling only; an ambiguous submission (submit_unknown) is never
  -- automatically resubmitted (C23).
  provider_request_id text,
  prompt_version      text,
  -- Written user-facing failure/refusal line only — never prompt content.
  error               text,
  created_at          timestamptz not null default now(),
  delivered_at        timestamptz
);

create index creative_jobs_user_day_idx on creative_jobs (user_id, created_at);

alter table creative_jobs enable row level security;
create policy own_creative_jobs on creative_jobs for select using (user_id = auth.uid());
