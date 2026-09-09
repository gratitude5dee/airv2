# OpenViking live check: isolated Linux/systemd hosts and a real ascii.dev Box

This is runtime evidence from the pinned OpenViking server (0.4.16, SDK 0.1.7)
running under the template's real `openviking.service`, `openviking-index.service`
and `openviking-index.timer` units on three hosts with systemd as PID 1: the
local VM, a fresh Tenki Cloud VM, and a disposable ascii.dev Box forked from
the template candidate. The first two are isolated Linux evidence only. The
Box run (below) adds the provider transitions — `stop()` around a live claim,
`resume()`, boot-id change, replay — but not the sweeper driving them from the
control plane, fleet compatibility, or product acceptance.

The runner is `infra/template/openviking/livecheck.py`; the host is provisioned
by `infra/template/openviking/replica-provision.sh`, which installs only the
deep-memory slice of the template (same package pins, same unit files) and is
what `.github/workflows/box-replica.yml` runs on a Tenki `4c-8g` VM. Reports are
metadata only: counts, URIs of synthetic fixtures, exit codes, seconds, bytes,
RSS. No document content leaves the host.

## Local run (Ubuntu 22.04 VM, systemd 249, kernel 6.8, 8 scenarios)

| Scenario | Result | Key metadata |
| --- | --- | --- |
| units_and_health | pass | `/health` healthy, version 0.4.16, service `active/running`, timer active, index service `oneshot` |
| synchronous_index_and_search | pass | 43 KB document indexed synchronously in 2.4 s; `find` returns hits under the URI |
| queued_index_timer_replay | pass | `--no-wait` enqueue; `idle-check` → `can_stop:false, pending:1`; timer replayed in 18 s |
| interrupted_index_recovery | pass | 3.3 MB document; server SIGKILLed mid-index (peak server RSS 695 MB); index service exited 1, queue entry survived, no receipt written; `Restart=always` restarted the server; timer replayed in 170 s; receipt advanced; content searchable; final status 1030 leaves, pending 0 |
| stop_claim_coordination | pass | claim refused inside the 20-minute grace (`reason:grace`); granted after grace; second claimant refused (`reason:claimed`); enqueue under a live claim stays durable and the worker defers (`reason:stop_claimed`); foreign token cannot release; owner token releases; queue replays in 24 s |
| stale_claim_and_corrupt_state | pass | claim from another boot id ignored; corrupt `pending.json` → exit 1 and no stop permission, claim also refused |
| rm_and_clear | pass | `rm` removes and the URI is gone; `rm` of the thread root cancels the queued descendant and the timer does not resurrect it; `clear --scope resources` removes the root; status shows 0 leaves; no cleared content chunk surfaces in `find`; no stale hit resolves |
| user_md_compare_and_swap | pass | empty-file revision write succeeds; stale revision exits with the conflict status and does not overwrite; no temp file left; fresh revision succeeds |

Three earlier runs of the same harness (7/8) failed only `rm_and_clear`; the
fixes below came out of those runs.

## Fresh-VM run (Tenki Cloud `tenki-standard-medium-4c-8g`, 8 scenarios)

GitHub Actions run 34268232169 on branch `codex/airv3-review-checkpoint`
(commit `1ac4cd7`), `.github/workflows/box-replica.yml`, report artifact
`livecheck-report`. The VM is a fresh Ubuntu 24.04 image with systemd 255 as
PID 1 (kernel 6.18), provisioned from scratch by `replica-provision.sh`
(pinned server built with `--no-binary llama-cpp-python`). **8/8 pass.**

| Scenario | Seconds | Key metadata |
| --- | --- | --- |
| units_and_health | 12.6 | service `active/running`, `NRestarts=0` on a fresh host |
| synchronous_index_and_search | 3.7 | 43 KB indexed in 3.5 s, 10 hits |
| queued_index_timer_replay | 24.2 | timer replayed in 24 s |
| interrupted_index_recovery | 348.0 | 3.3 MB document; peak server RSS 681 MB at SIGKILL; `NRestarts=1`; timer replayed in 305 s; 1030 leaves, pending 0 |
| stop_claim_coordination | 41.6 | same grant/refuse/defer/release sequence; released queue replayed in 21 s |
| stale_claim_and_corrupt_state | 0.2 | fail-closed as locally |
| rm_and_clear | 148.9 | cleared content unreadable, 0 content hits; two dangling `.abstract.md` vectors still listed after 120 s (informational, none dereference) |
| user_md_compare_and_swap | 0.0 | pass |

Differences from the local VM: replay of the interrupted 3.3 MB document took
305 s here versus 170 s locally (embedding on 4 vCPU without a warm cache);
the dangling abstract vectors had not drained after 120 s on either host in
the fresh-store case. Two earlier runs of the workflow failed in provisioning
only (runner `XDG_CONFIG_HOME` and the checkout's `uv.toml` leaking into the
box user's `uv`), fixed by giving the box user a clean environment and cwd.

## Real ascii.dev Box (`bx_8mgkj4kb`, Hetzner 4 vCPU / 8 GB, 8 scenarios)

A disposable fork of the template candidate `bx_xf5q64x7`, converged to the
checkpoint template with `infra/template/sync-box.sh` (release stamp
`livecheck-03d188d`, `verify-box: OK`; the deployed `ovctl.py`/`livecheck.py`
hashes match the tree). Ubuntu 24.04.4, systemd 255, kernel `6.8.0-117`.
Everything below was driven over the provider command API
(`infra/template/boxctl.sh cmd|stop|resume|get`), the same endpoint the
sweeper uses. Fixtures are synthetic; no owner content was read or exported.

**Full run after a clean start (pending 0): 8/8 pass.**

| Scenario | Seconds | Key metadata |
| --- | --- | --- |
| units_and_health | 1.0 | service `active/running`, `NRestarts=0`, timer active, index service `oneshot` |
| synchronous_index_and_search | 6.4 | 43 KB indexed in 6.0 s, 10 hits |
| queued_index_timer_replay | 15.4 | timer replayed in 15 s |
| interrupted_index_recovery | 647.9 | 3.3 MB document; peak server RSS 660 MB at SIGKILL; index service exited 1, queue survived, no receipt; `NRestarts=1`; timer replayed in 595 s; receipt advanced, pending 0 |
| stop_claim_coordination | 32.9 | grace refusal, grant, second claimant refused, enqueue-under-claim durable, worker `deferred/stop_claimed`, foreign token refused, owner release, replay |
| stale_claim_and_corrupt_state | 0.4 | fail-closed as on the other hosts |
| rm_and_clear | 155.1 | rm/root-rm/cancelled descendant/clear as on the other hosts |
| user_md_compare_and_swap | 0.1 | pass |

A first full run on the same Box, before the queue was clean, was **6/8**:
`interrupted_index_recovery` and `stop_claim_coordination` failed because the
forked image carried an old queued archive partition
(`…/imessage-history/threads/<id>/2024-03`) whose replay kept failing
(`RemoteProtocolError`, `ConnectError`, `DeadlineExceededError`) and held the
worker for the whole 900 s window. A focused rerun of `stop_claim_coordination`
once that entry had drained passed (62.9 s). The 6/8 is kept here as evidence
that a poisoned queue entry blocks every scenario behind it.

The interrupted 3.3 MB replay is slower here (595 s) than on Tenki (305 s) or
locally (170 s): same vCPU count, but the Box was also running Hermes, the
gateway and the ascii runtime alongside the embedder.

### Provider `stop()`/`resume()` around a live claim (two cycles)

Sequence per cycle, all over the command API: `ovctl stop-claim
--grace-seconds 1` → granted; `ovctl add-resource <fixture> --to
viking://resources/context/livecheck-lifecycle --no-wait` → `pending:true`;
`ovctl resume-pending` → `{"deferred":true,"reason":"stop_claimed","pending":1}`;
`idle-check` → `can_stop:false, pending:1, stop_claimed:true`; provider `stop`.

| Observation | Cycle 1 | Cycle 2 |
| --- | --- | --- |
| provider states after `stop` | `archiving` → `archived` (`snapshotCompletedAt` advanced during archiving) | same |
| `resume` call → box `idle` | 50 s | 90 s |
| boot id changed | yes | yes |
| `openviking.service` / `-index.timer` / `hermes-gateway` at `idle` | all `inactive` | all `inactive` |
| services `active` after `idle` | not sampled | ≈78 s |
| `pending.json` and `stop-claim.json` survived the snapshot | yes | yes |
| stale claim (old boot id) ignored by `idle-check` (`stop_claimed:false`) | yes | yes |
| queued work replayed after resume | **no** — see below | yes, within ≈15 s of the timer becoming active; `find` under the URI returned 5 hits (4 content parts + `.abstract.md`); `ovctl rm` then removed it |

Cycle 1 used a fixture under `/tmp`, which the provider snapshot does not
preserve. After resume `openviking-index.service` failed on every timer tick
with no journal line (the missing-path branch returned `False` silently), the
entry never drained, and `idle-check` kept answering `can_stop:false` —
the Box could never have slept again. Production writers stage under
`~/.hermes/context/…`, which is on the persisted disk, but any deleted source
(a forgotten import chunk, a cleared archive partition) would pin a Box awake
the same way. `ovctl resume-pending` now drops an entry whose source no longer
exists and journals `{"dropped": <uri>, "reason": "source_missing"}` (metadata
only). Deploying that `ovctl.py` to the resumed Box cleared the stuck entry on
the next tick and `pending` returned to 0.

Cycle 2 repeated the run with the fixture under `~/.hermes/context/` and the
fixed worker; the deferred work replayed after the provider resume and was
searchable.

Also observed: the Box API reports `idle` roughly a minute before the
restored units are running. `ensureBoxAwake` already waits for `idle` and then
probes Hermes `/api/health` with a 180 s deadline; the ≈78 s to active services
measured here consumed under half of that budget, on one sample.

Not covered by the Box run: the sweeper (`apps/web/app/api/cron/sweep`)
issuing the claim and the stop itself (it needs the control plane with a
Supabase row for this Box; only `ovctl` was driven over the command API),
old boxes without the claim command, and any owner-corpus recall/coverage.
`/tmp` is not preserved across a provider stop/resume; nothing in the template
relies on it, but `livecheck.py` had to be re-uploaded to `~` for the second
run.

## Real Tenki Box through the provider facade (`tenki:2c8ddcce…`, 4 vCPU / 8 GB)

A fork of the Tenki template (built from `infra/template/setup.sh` by
`apps/web/scripts/tenki-template.mjs`) driven through `lib/box/client.ts`,
i.e. the same `fork`/`command`/`hostRoute`/`stop`/`resume`/`getBox`/`deleteBox`
calls the control plane makes, with `ovctl.py` from the working tree.

Template state at fork: `hermes-gateway`, `hermes-dashboard`, `openviking`,
`openviking-index.timer`, `taskrouter`, `air-learningd` all `active`;
`hermes-host` correctly skipped (`ConditionPathExists=~/.ascii/host`); Hermes
`/api/health` 200 through an `exposePort` route (`hosted_token = ""`). The
same 8 livecheck scenarios passed 8/8.

Provider transitions around a live claim, same `ovctl` sequence as the ascii
Box run:

| Observation | ascii.dev Box | Tenki Box |
| --- | --- | --- |
| `stop()` wall time | provider `archiving` → `archived` (async) | 12–14 s (async snapshot of the live VM, tagged, session closed) |
| `resume()` call → Box ready | 50–90 s, services active ≈78 s later | ≈5 s, services already active (memory restore, no boot) |
| boot id after resume | changed | **unchanged** (`629932f6…`, the template's; every fork reports it) |
| `pending.json` / `stop-claim.json` survived | yes | yes |
| hosted route after resume | same URL | new URL; `hostRoute()` re-exposes, health 200 |
| claim after resume, `ovctl` without `resumed` | void (stale boot id) | **live** — worker deferred; queue drained 844 s after resume, when the TTL lapsed |
| claim after resume via `ensureBoxAwake` (`ovctl resumed`) | n/a (boot voids it) | gone; `idle-check` `stop_claimed:false`; queue drained 32 s after wake |

The second-to-last row is the defect: on a provider that restores memory the
boot id is not a resume signal, so the claim's only bound was its TTL and a
resumed Box sat with deferred indexing for up to 15 minutes. `ovctl resumed`
(voids any claim; a resume means its stop completed) plus the wake path
issuing it after `waitForBox` closed it; the last row is that run, made
through the real `ensureBoxAwake` with a fake Supabase client whose row
started `stopped` with a stale `hosted_url` (writes observed: `stop_after`,
`state=starting`, `hosted_url`, `state=ready`, one `box_state_events` row).
On an old Box the command exits 2 and is ignored; on ascii it is redundant.

Still not covered on Tenki: the sweeper driving claim+stop from the control
plane, a real provisioned user Box (only disposable forks), the agent-suite
evaluation, and the missing periodic snapshot (see `infra/template/UPGRADE.md`).

## Server behaviour observed (0.4.16) and what changed because of it

- **`rm` is idempotent.** Deleting an absent URI succeeds instead of raising
  `NotFoundError`, so the typed-absence branch in `ovctl rm`/`clear` is a
  defence for other server versions, not the path that fires here.
- **Vector deletion lags storage deletion.** Immediately after a waited `rm`
  or `clear`, `ls`/`stat` of the removed URIs fail with `NotFoundError` and no
  content chunk surfaces in `find`, but dangling vectors for the deleted
  directories' `.abstract.md` keep appearing as low-score hits for minutes
  (observed 5–15 min before draining). They do not dereference. Consumers
  must treat a `find` hit as a pointer and read through it, never as content.
- **A racing semantic refresh can re-create a cleared root.** The server's
  `SemanticProcessor` refreshes a parent directory's abstract when children
  change (`trigger: parent_refresh`/`content_delete`). In one run that refresh
  raced the delete and `viking://resources/context/.abstract.md` was readable
  again after `clear` had returned. On this host the abstract body is the
  placeholder `[Directory overview is not ready]` (no LLM configured); on a
  Box with an LLM it would be a derived summary of the cleared content.
  `ovctl clear` now waits for the server to settle (`wait_processed`, bounded
  by `CLEAR_SETTLE_SECONDS`), re-checks each cleared root and removes it again
  if it resolves, reporting it under `resurrected`. The re-check also runs when
  `wait_processed` is unavailable.
- **The timer can hold the worker lock when a synchronous add arrives.**
  The synchronous path now waits for the lock instead of returning
  `pending:true`; timer replay stays non-blocking.
- **Worker and `rm`/`clear` failures now carry the exception class name**
  (`InternalError`, `ConnectionError`, …) alongside the URI. Messages are never
  emitted, so no document content reaches the journal or the control plane.

## What this does and does not cover

Covered on an isolated systemd host: unit start and health, synchronous and
queued indexing, interrupted-index durability and restart recovery, receipt
semantics, stop-claim grant/refuse/release and its interaction with the durable
worker, stale/corrupt state fail-closed behaviour, `rm`/`clear` semantics
including cancelled descendants, and the USER.md compare-and-swap shell.

Covered on the real Box in addition: the same 8 scenarios, provider
`stop()`/`resume()` around a live claim with the queue replaying after the
boot-id change, and the missing-source poison-entry failure mode.

Covered on a real Tenki Box through the provider facade: the same 8
scenarios, snapshot-based `stop()`/`resume()` around a live claim, the
unchanged-boot-id claim persistence and its fix via the wake path, and hosted
route re-exposure.

Not covered: the sweeper issuing the claim/stop from the control plane against
either Box, old boxes without the claim command in a real fleet, first-index time
on a freshly forked user Box, the Tenki agent-suite evaluation, and any
recall/coverage measurement on an owner corpus. MEM-21 stays `in_progress` (box side and provider transitions measured;
sweeper path not) and the archive findings (MEM-01/18/19) stay unverified;
MEM-26's clear behaviour is `implemented` with the caveats above, not
`verified`.
