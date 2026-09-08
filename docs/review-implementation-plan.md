# Review implementation and acceptance

The scope is all 249 findings in `review.md`. `review-findings.json` preserves
each Appendix A ID and dependency. Run `python3 scripts/review-tracker.py --check`
to check inventory consistency. This check is not a product-quality score.

## Acceptance

The requested A+/95 goal remains unproven. Completion requires reviewing every
finding against current implementation and runtime evidence, passing the full
typecheck, lint, tests and build, and validating the deployed application. Task
completion, approval gating, appropriate memory recall and honest outcomes must
be measured against representative isolated evaluation cases in both web and
iMessage lanes. Report denominators and failures; do not substitute static tests
or an average of unrelated axes for a 95% task-completion or memory-use result.
The review's 60% execution, 85% gating and 80% recall floors are intermediate
milestones, not the requested final target. External provider approvals, social
publishing parity and mail cutover checks remain explicit prerequisites.

Follow the dependency order in review sections 0 and 12: prevent silent damage;
instrument; deliver template steering; streamline sender and wake paths; unify
run evidence and approvals; isolate sessions; wire box-side memory; validate
mail and social cutovers; audit every remaining finding. Preserve the review's
security invariants and default product decisions throughout.

## Verified local progress

- Upload validation now rejects invalid timestamps and missing thread identity
  before storage/migration. Calendar validation refuses rollover dates such as
  February 30 and 24:00 rather than silently moving messages across dates.
  All 36 ingest/archive/route tests and typecheck pass locally.
- Archive concurrency: inspected migrations 0101/0102; the metadata lease
  accepts the archive namespace and renews the current holder. An overlapping
  upload test runs the real lease helper against a contention-aware RPC fake,
  proving the second writer is initially refused, both messages survive and
  the lease is released. All 20 ingest tests and typecheck pass. This does not
  substitute for concurrency verification against a deployed database/Box.
- Reindex now uses exactly the uploader's thread/month Markdown paths and
  URIs, excluding status, pending files and raw legacy chunks. It reports a
  nonzero legacy migration count and returns failure until those old files
  are migrated. Five OpenViking Python tests pass. The full Vitest run passes
  249 files and 2,532 tests (one skipped); five additional upload-route tests
  pass on their targeted run. Typecheck passes. These checks do not measure
  live recall or prove completion of background indexing.
- Latest archive cutover: `storeChunk` now acquires the metadata-only archive
  lease, preflights/migrates legacy chunks, and writes the thread/month archive
  and derived status atomically. Earlier notes below about the old writer
  remaining active are superseded. Migration preserves raw originals in an
  unindexed backup and retries from backups after interruption; unresolved
  identities produce an explicit 409. Lease contention produces retryable
  503. Nineteen ingest tests and four migration orchestration tests pass,
  including duplicate-count prevention and backup/marker recovery. Full
  route/concurrency tests, real migration, reindex alignment, unresolved
  identity resolution UX and live recall remain pending. No archive finding
  is closed by these unit tests alone.
- Archive inputs (MEM-01/MEM-18/MEM-19, in progress): added a deterministic
  thread/month merge and Markdown renderer, with stable GUID deduplication,
  edit replacement and content hashes. Upload parsing preserves extractor
  message/thread identities. Fourteen archive/ingest tests pass. The current
  writer still stores timestamped JSON; do not deploy this as the completed
  archive fix. Next: extractor attributedBody decoding and year/cursor
  selection, durable serialized merge/recovery, storage/index cutover and
  real-output recall validation. These findings remain unverified.
  Upload transport now splits by encoded UTF-8 bytes and message count,
  rejects oversized individual rows before sending, preserves extractor GUIDs,
  and defaults to a validated 365-day window exposed in onboarding. The API
  bounds streamed body reads to 4 MiB and cancels oversized requests. Three
  tests of the actual embedded Python uploader and three stream-reader tests
  pass, along with typecheck and shell syntax validation. Attributed-body
  decoding, a since cursor and durable archive storage are still outstanding.
  `archiveStore.ts` now implements retry repair using source records outside
  the indexed tree and per-partition count/content-hash receipts. Seven tests
  cover duplicate and overlapping uploads, edits, partial write recovery,
  enqueue retry, read failure and lease loss. Typecheck passes. This layer is
  not yet called by the upload route: legacy JSON migration and the caller's
  archive lease must land before the cutover. An enqueue receipt records
  acceptance only, not completed indexing (MEM-21 remains open).
  Archive writes now stage next to their destination, verify a SHA-256
  checksum, renew the caller's lease and atomically replace/fsync the file.
  Three real-filesystem tests verify Unicode/shell-safe paths and mode 0600,
  truncated-upload preservation, and lease-loss preservation. Together with
  the seven recovery tests these pass; typecheck passes. The route cutover
  still awaits legacy migration and lease wiring.
  Attributed-body decoding is now connected to the extractor: SQL includes
  archived-body rows and a pinned, checksum-verified pure-Python typedstream
  decoder reads them locally. Five uploader tests pass, including actual SQL
  against a synthetic two-row chat.db with an Apple-generated attributed
  string and plain text. Unknown/corrupt bodies stop before any upload.
  The wheel includes its source and LGPL license; provenance is recorded in
  `apps/web/public/vendor/README.md`. Real owner-corpus coverage, archive
  migration/cutover and recall evaluation are still pending.
  The extractor also accepts an optional third `SINCE_ISO_UTC` argument,
  converted to numeric SQL input after timezone validation. Selection includes
  the boundary second, retaining timestamp ties for deduplication. Six Python
  uploader/cursor tests pass. Automatic reuse of the saved cursor remains
  disconnected until the deduplicating writer replaces the current route.
  Latest broad test run: 246 files passed; the Onairos route fixture had two
  failures because its generic missing-file error no longer matches typed
  404 initialization. Corrected that fixture; all four route tests pass on
  rerun. The broad run contained 2,513 tests (one skipped). No live product
  success rate can be inferred from this local test count.
  Matching ID-less messages can now be promoted to identified records within
  a resolved thread/month, regardless of upload order, while preserving
  distinct GUIDs. Unknown legacy thread identity still requires migration
  resolution. The active importer also rejects unreadable or malformed
  stored status before writing; only a typed 404 initializes status. Fourteen
  ingest tests and fourteen merge/store tests pass. This does not close
  archive idempotency: the route still uses the original chunk writer.
  Thread hashes now distinguish stable IDs from legacy labels. Migration
  preflight resolves labels only against a unique identity in a supplied
  complete catalogue, reporting missing or ambiguous matches for resolution.
  Three preflight tests and fifteen merger/storage tests pass; typecheck
  passes. The extractor still needs to supply that complete catalogue and
  the migration runner must persist the resolved history before route cutover.
  Catalogue delivery now exists: the extractor queries all current message
  thread identities without the date filter and includes the full catalogue
  in each byte-bounded request. The parser validates and retains it, including
  ambiguous labels. Seven Python tests (actual SQL plus upload bytes) and
  nineteen ingest tests pass, with typecheck and shell syntax checks. The
  active old writer does not consume the catalogue yet; persistence belongs
  with the serialized migration/cutover operation.
- MEM-03: provisioning runs `ovctl ensure` after the per-instance credential
  merge and rolls back the fork on initialization failure. OpenViking's
  service pre-start renders configuration without restarting its own unit.
  Configuration replacement is atomic and mode 0600. Existing sync already
  runs ensure. All 29 provisioning tests, four OpenViking Python tests and
  typecheck pass; a live fork/resume and fleet convergence remain pending.
- MEM-07: cap the complete persona block at 300 characters, retaining the
  full-context pointer. Validate the resulting USER.md against its shared
  1,375-character limit before changing persona, grant or profile content.
  Only a typed Box 404 initializes a missing profile; read failures propagate.
  All 40 Onairos tests pass, including exact-limit and overflow cases. Live
  personalization and coordination with other memory writers remain pending.
- MEM-20: agent imports enqueue indexing after the source's final chunk,
  rather than replacing the index after every chunk. Manual reindex includes
  Hermes, Codex, Claude imports and Dictionary.MD at their upload URIs. The
  TypeScript chunk-order test and Python reindex test pass. Live completion,
  duplicate-final handling and the related archive changes remain pending.
- Build validation: canonicalize temporary workspace, vendor and restricted
  component roots before esbuild containment checks. This fixes macOS symlink
  path mismatches. An explicit symlink-root regression checks successful
  compilation and rejection of an import outside the workspace.
- TC-19: new-box setup and existing-box sync both reconcile one canonical
  `soul-managed.md` block. The verifier checks its full content, not merely a
  heading. Legacy template text is migrated, owner edits are retained, and
  the original file is backed up locally before atomic replacement. Six
  Python tests cover migration, repeat sync, custom content, malformed
  markers, permissions, and setup/sync/verify wiring. All three shell scripts
  pass syntax checks. Artifact release and live fleet convergence are pending.
- MS-24: kanban and to-do mutations now use the existing metadata-only
  per-resource lease across the full read-modify-write, including renewal
  before writing. Whole-document writes to these apps use the same lease.
  Persistent contention returns a retryable 503 from the mini-app; additions
  use unique IDs. Four interleaving/contention tests pass alongside all 18
  existing action-log tests. Live database/Box concurrency remains unmeasured.
- MS-19: kanban/todo document initialization occurs only on a typed Box 404.
  Network/500 and malformed JSON errors propagate before writes. Defaults are
  cloned so one user's first document cannot mutate another user's default.
  Four regression tests pass in `store.readFailure.test.ts`.
- TC-05: removed 15 whole-environment sourcing snippets in eleven skills;
  each now reads only the two gateway settings as data. All 21 template skills
  pass the no-sourcing guard in `templateSkillEnv.test.ts`. Existing live boxes
  have not been synced by this task.
- WEB-24: the runner records monotonic `agent_ms` before stop/reconciliation,
  nullable first-delta `ttft_ms`, and separate `settle_ms`. The scorer uses
  measured agent timing with explicit denominators, and labels old results as
  harness elapsed. Three timer tests and a synthetic scorer exercise pass.
  No live latency improvement has been measured.

Validation update: the locked dependency install now succeeds. Full Vitest
3.2.7 run: 243 files pass, 2,484 tests pass and one is skipped. The subsequently
added symlink regression also passes (18 build tests). Full typecheck passes;
lint previously reported zero errors and 38 warnings. The production build
also passes, with warnings including an inferred tracing root outside this
repository that still needs explicit configuration. GitHub publication,
Vercel deployment and live evaluation remain outstanding.

MEM-21 durability work in progress: `ovctl add-resource --no-wait` now
atomically persists a generation-tagged entry in `~/.openviking/pending.json`.
`resume-pending` serializes workers, retries synchronous indexing, and clears
only the generation it completed. A systemd timer installed by setup/sync
replays work after startup and failures. `ovctl status` exposes the pending
count. Forgetting serializes against replay and cancels queued descendants;
remote deletion failures now return failure instead of success.

Validation: 11 box-side Python tests pass, including queue retry, a concurrent
new generation, atomic-write failure, corrupt-state preservation, and forget
cancellation/error reporting. Setup/sync pass shell syntax checks. MEM-21 is
still incomplete: Context-card status, idle-stop coordination, enqueue-only
reindex, the specified service restart hook, actual SDK completion semantics,
and a live interrupted-index/resume evaluation remain to be verified or built.
No A+/95 score or deployed completion is claimed.

MEM-21 follow-up: the Context card and Persona memory section now display
pending work separately from server health. Missing or invalid queue counts
remain unknown, never zero. Reindex now enqueues the exact context resources
in the durable queue without contacting the SDK; its API returns HTTP 202
and the UI says queued. Full TypeScript checking passes, with targeted status
and reindex tests plus the 11 Python tests. Idle-stop coordination, service
restart-hook coverage, SDK completion semantics, and live interruption testing
remain open; the timer alone does not prove those requirements.

Checkpoint follow-up (worker timeouts, coordinated idle stop, archive
co-ship): `tests/test_timeouts.py` patches `openviking_sdk.SyncHTTPClient` and
asserts the replay worker passes `timeout=660` for the 600-second server wait
while `client()`, `status`, `export` and `recent` stay at the SDK 0.1.7 default
of 60. `add_resource` and `cmd_rm` now tolerate only the SDK's typed
`NotFoundError` before an add; any other removal error propagates and the
durable receipt stays pending (`tests/test_replace.py`). The probe-then-stop
race is closed by a box-side claim: `ovctl stop-claim` takes the worker and
queue locks, refuses while work is pending, in grace, busy or already claimed,
otherwise writes a token/boot-id/TTL claim that `resume-pending` honors by
deferring; `stop-release` removes it. The sweeper (`indexIdle.ts`,
`idleStop.ts`, `cron/sweep`) acquires the claim before provider `stop()`,
releases it on stop failure, falls back to the read-only `idle-check` probe on
boxes without `stop-claim`, and stops boxes with neither only after a bounded
20-minute legacy grace; the cron response reports every claim/deferral outcome
(`tests/test_stop_claim.py`, `indexIdle.test.ts`, `idleStop.test.ts`).
Archive: the migration preflight persists unresolved label→candidate pairs
box-side and the owner resolves them through
`GET/POST /api/me/imessage-history/resolutions`; saved resolutions merge into
`resolveLegacyThreads`. Ingest status carries a validated `cursor` returned by
GET/POST and passed to the extractor as `SINCE_ISO_UTC`; the uploader resumes
from it. Upload-ticket errors share one envelope with stable codes, a
retriable flag and `Retry-After`; `resolution_required` (409) carries only
fixed text and a resolve URL, never labels. `apps/web/next.config.ts` sets
`outputFileTracingRoot` to the workspace root and the inferred-tracing-root
build warning is gone.

Validation: 39 OpenViking Python tests pass; 11 uploader tests pass; targeted
Vitest on `lib/imessage`, `app/api/me/imessage-history` and `lib/orchestrator`
passes 204 tests in 20 files. Full Vitest: 255 files, 2,632 tests pass, one
skipped. Typecheck passes. Lint reports zero errors and the same 38
pre-existing warnings as before, after the ESLint ignore list was extended to
the remaining git-ignored esbuild bundles under `public/creator-os/` (the
generated `create.js` had produced two `no-this-alias` errors once a build had
emitted it). Production build passes. Inventory check: 249 rows, 9 implemented,
1 in progress, 239 not verified, product acceptance not measured.

Limits: these are unit-level checks with an in-memory SDK stub and mocked
box/provider calls. The idle-stop race guarantee has not been exercised on an
isolated Linux/systemd box with the real timer, units and provider `stop()`
(continue.md item 4); MEM-21 stays in progress. No owner corpus was imported,
so archive recall/coverage is unmeasured and source/manifest/enqueue receipts
do not prove searchability (item 5); MEM-01/MEM-18/MEM-19 stay not verified.
Rollout still requires the template with `stop-claim` to ship before the
claim path is exercised in production. No A+/95 score is claimed.
