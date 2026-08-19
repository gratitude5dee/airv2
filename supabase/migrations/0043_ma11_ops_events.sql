-- MA11 ops ledger: one append-only row per counted platform event. Serves
-- two jobs: the /api/admin/ops mini-app counters (store opens, publishes,
-- uploads + bytes, guest sessions, upload-guard rejections) and the durable
-- rate limits (launches per user, publishes per day, uploads per hour) —
-- in-memory limiters don't survive multi-instance deploys, this does.
-- user_id is nullable for anonymous events (store opens), matching the
-- miniapp_gate_events precedent.
create table ops_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  kind text not null check (kind in (
    'store_open','launch','publish','upload','upload_rejected',
    'guest_session','grant','rate_limited'
  )),
  ref text,
  bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index ops_events_kind_idx on ops_events (kind, created_at desc);
create index ops_events_user_kind_idx on ops_events (user_id, kind, created_at desc);

alter table ops_events enable row level security;
-- Default-deny; the service role is the sole reader/writer (goal.md §6).
