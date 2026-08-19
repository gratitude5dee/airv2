-- MA4: server-side reservation for presigned public-media uploads. The
-- presign leg pre-charges the declared size and records it here; the confirm
-- leg consumes the row exactly once and reconciles against the STORED charge,
-- never a client-supplied value. Abandoned presigns can be swept by
-- created_at and their charge released.
create table pending_uploads (
  key text primary key,
  user_id uuid not null references users(id) on delete cascade,
  charged_bytes bigint not null,
  created_at timestamptz not null default now()
);
create index pending_uploads_user_idx on pending_uploads(user_id);
alter table pending_uploads enable row level security;
