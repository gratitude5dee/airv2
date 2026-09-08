# OpenViking completion contract inspection

This is a source inspection and local regression report, not a live recall
or interrupted-box evaluation.

The template pins OpenViking 0.4.16 and openviking-sdk 0.1.7. The SDK release
wheel was read from the [PyPI release metadata](https://pypi.org/pypi/openviking-sdk/0.1.7/json)
without installing or executing it. `add_resource` sends `wait` and `timeout`,
then returns the response's `result` dictionary. Its HTTP response handler
checks the outer error envelope, not failure statuses nested in that result.

The [pinned server resource service](https://raw.githubusercontent.com/volcengine/OpenViking/v0.4.16/openviking/service/resource_service.py)
waits for the resource task when requested. Completed tasks return their
result without a task ID. Cancellation and task failure can return result
dictionaries with cancellation/error statuses. Therefore, lack of an SDK
exception alone does not prove successful indexing.

`ovctl` now rejects failed, cancelled, pending, empty, and malformed receipts;
requires a resource URI; rejects outstanding task IDs on the synchronous
path; and checks reported queue errors. Strict ingestion is requested to
avoid silently accepting partial parse failures. Rejected results preserve
the durable entry for another attempt. No result bodies are logged.

Local tests cover successful receipts, cancellation, nested failures,
outstanding task IDs, malformed results, queue errors, and an actual durable
entry retained on cancellation and cleared on a subsequent successful result.
All 13 box-side Python tests pass. A nonblocking service-start hook dispatches
the worker after each OpenViking restart; the timer provides retries.

Still required: inspect SDK transport timeouts against the worker budget,
test the units on Linux, verify live successful receipts, coordinate the idle
stop with queue drain, and measure first-index time, interrupted recovery,
and recall coverage on an isolated box. MEM-21 remains unverified.

## Idle-stop guard implementation

The sweeper now asks `ovctl idle-check` before changing a box to stopping.
Pending work denies shutdown. The worker atomically records completion time
before clearing each matching queue generation; shutdown remains deferred
for 20 minutes after the latest completion. A failed receipt write leaves
the queue entry intact. The receipt survives process restarts. Command errors
or corrupt state deny shutdown and increment the sweep's `indexingDeferred`
counter rather than being interpreted as an empty queue.

Validation: 16 Python tests pass, including pending→completed→idle behavior,
new work after a completed generation, failed receipt writes, and corrupt
receipts. Eleven targeted sweeper/guard web tests pass; full typecheck and
targeted lint pass.

Rollout and concurrency remain unresolved: older boxes without `idle-check`
will be deferred until synced. The probe and provider stop are separate
operations, so an enqueue between them still requires a coordinated shutdown
claim. Durable replay protects the pending entry across that interruption,
but this does not yet prove the stronger never-stop-during-indexing invariant.
Do not deploy this control-plane gate ahead of the matching box update or
mark MEM-21 complete from these local tests.
