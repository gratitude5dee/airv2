# Test plan — PR #126 (data durability P1: idempotent conversions, presign sweep, indexes)

Environment: prod build of apps/web on :3999, env pointed at a local mock PostgREST on :4545 (logs every request+body to /tmp/mock126.log). `CRON_SECRET=testcron126`. No real DB touched (migration 0047 not applied live — mock stands in). All shell/curl based → no screen recording.

Static gates (already done in setup):
- `npm test -- --run`: 85 files / 715 tests passed (includes new conversions.test.ts + sweep.test.ts)
- `npm run typecheck`: clean; `npm run lint`: 0 errors, 3 pre-existing warnings

## T1: conversions route requires event_id (new 400 path)
Mock: `ad_accounts` GET returns one row `{id:"acct1", user_id:"u1", conversion_token:"tok123"}`.
1. POST /api/ads/conversions with `{token:"tok123",account_ref:"a",creative_ref:"c",event:"purchase"}` (no event_id).
   - PASS: HTTP 400 `{"error":"missing fields"}` AND mock log shows NO request to `ad_conversions` (old code would have inserted and returned 200).
2. Same body + `event_id:"evt-1"`.
   - PASS: HTTP 200 `{"ok":true}`; mock log shows POST `/rest/v1/ad_conversions?on_conflict=account_id%2Cevent_id...` with `Prefer` containing `resolution=ignore-duplicates`, body containing `event_id:"evt-1"`, `account_id:"acct1"`.
3. Replay exact same body (mock returns 200 empty array as PostgREST does for ignored duplicates).
   - PASS: HTTP 200 (no 500), request again carries on_conflict params — retried postback doesn't error.

## T2: cron sweep releases abandoned presign reservations
Mock: `pending_uploads` DELETE with `created_at=lt.<cutoff>` returns 2 stale rows: `{user_id:"u1",charged_bytes:5000}`, `{user_id:"u1",charged_bytes:0}`. `user_buckets` GET for u1 returns `{bytes_used:9000}`; PATCH logged. Other sweep tables (`boxes`, `flush_jobs`, `inbound_events`, `batch_queue`) return `[]`.
1. GET /api/cron/sweep with `Authorization: Bearer wrongsecret`.
   - PASS: HTTP 401 `{"error":"unauthorized"}`, no mock traffic.
2. GET with `Authorization: Bearer testcron126`.
   - PASS: HTTP 200 JSON contains `"uploadsReleased":2` (new field — old code has no key at all); mock log shows DELETE `pending_uploads` with `created_at=lt.<~now-600s>` (cutoff within a minute of now-10min) and `select=user_id,charged_bytes`; exactly ONE `user_buckets` PATCH with `bytes_used:4000` (9000−5000; the 0-byte row must NOT trigger a second PATCH).

## T3 (untested by design): live conflict path on real DB
Migration 0047/0048 must not be applied to production per instructions — real-DB duplicate-drop behavior is covered only by unit tests; report as untested/blocked.
