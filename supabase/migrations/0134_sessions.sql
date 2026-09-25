-- R-SEC-07: revocable web sessions. The air_session JWT was stateless for
-- 30 days — logout cleared the cookie but nothing could kill a stolen
-- token, and the account-deletion flow (SECURITY-DECISIONS §8.4) could not
-- revoke anything. Each issued token now carries a `sid` claim naming one
-- row here; sessionUserId accepts only sessions whose row is unrevoked.
--
-- Deletion flow: users.id cascade drops a deleted account's sessions with
-- the user row. Rows are written at login/signup and revoked_at is stamped
-- at logout; nothing else ever updates them.

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  issued_at  timestamptz not null default now(),
  revoked_at timestamptz
);

create index sessions_user_idx on sessions (user_id)
  where revoked_at is null;

alter table sessions enable row level security;
-- Default-deny: the service role is the sole reader/writer; sessions are
-- issued and checked inside server routes only.
