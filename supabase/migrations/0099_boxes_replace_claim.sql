-- Operator box replacement (POST /api/admin/boxes/reprovision) claims the
-- user's row here while a fork is in flight. It lives outside `state`, which
-- the box lifecycle (wake, prewarm, idle stop) rewrites freely and so cannot
-- hold a lock. A claim older than the route's request budget belongs to a
-- request that can no longer be running and may be taken over.
alter table boxes add column if not exists replace_claimed_at timestamptz;
