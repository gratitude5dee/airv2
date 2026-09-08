# OpenViking live check on an isolated Linux/systemd host

This is runtime evidence from the pinned OpenViking server (0.4.16, SDK 0.1.7)
running under the template's real `openviking.service`, `openviking-index.service`
and `openviking-index.timer` units on a fresh Linux host with systemd as PID 1.
It is **not** evidence from an ascii.dev Box: provider stop/resume transitions,
fleet compatibility and product acceptance are still unmeasured. The ascii.dev
account was out of usage (HTTP 402 `billing_required`) when this was run.

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

Not covered: ascii.dev `stop()`/`resume()` transitions around a live claim,
the sweeper calling `ovctl` over the provider command API, old boxes without
the claim command in a real fleet, first-index time on the actual Box image,
and any recall/coverage measurement on an owner corpus. MEM-21 and the archive
findings (MEM-01/18/19) therefore stay unverified; MEM-26's clear behaviour is
`implemented` with the caveats above, not `verified`.
