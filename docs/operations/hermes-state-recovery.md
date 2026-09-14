# Hermes SQLite recovery

An iMessage read receipt or typing indicator does not establish that Hermes
generated a reply. Trace the webhook, flush job, Hermes stream, gateway usage,
and outbound send separately.

## Failure signature

`database disk image is malformed` in a Hermes stream can prevent a response
before the model request. The flush path preserves the drained messages and
reschedules delivery. It also logs database metadata and integrity status,
without logging conversation rows.

Check the affected user's exact `provider_box_id`, `flush_jobs` record, and
carried-message count. Do not reset the box, delete SQLite sidecars, export
production credentials, or clear the queue as a troubleshooting shortcut.

## Operator-triggered recovery

The service-role-only `platform_settings` key
`hermes_state_recovery/<exact-box-id>` accepts a one-shot request. Its value is:

```json
{"operation_id":"unique-lowercase-operation-id"}
```

The request is atomically consumed when that box reports SQLite corruption.
The fixed recovery script stops Hermes services, checks file holders and free
space, preserves raw database/sidecar bytes, and repairs a scratch copy.
Automatic promotion requires identical canonical table rows, an integrity
check, and a write probe. SQLite's exclusive lock and transactional backup API
protect promotion from concurrent writers. Services restart on failure too.

Recovery artifacts remain on the affected box under:

```text
/home/user/.hermes/state-recovery/<operation-id>/
```

Inspect `report.json`; do not copy transcripts into logs. Failed native repair
may stage `recovered.sql` and `recovered.db` using `.recover --ignore-freelist`.
An integrity-check result of `ok` alone does not prove data completeness.

## Approved partial-history restoration

Obtain explicit user approval before restoring history whose completeness
cannot be verified. Preserve the entire damaged database and all earlier
artifacts. The separate operator request is:

```json
{
  "operation_id":"new-unique-restoration-id",
  "restore_operation_id":"earlier-recovery-operation-id",
  "accept_partial_history":true
}
```

This path refuses empty history, initializes the recovered copy with the
installed Hermes schema, and requires Hermes' own read/write health probe.
Canonical sessions and messages must remain unchanged by initialization.
It then takes another raw backup and promotes transactionally while holding
exclusive SQLite ownership. Check `applied`, `post_restore_health`, recovered
row counts, and the service restart status.

Some system SQLite shells expose `.recover` but fail to execute it. The
approved restoration path can retry with an isolated Linux x64 SQLite 3.53.4
shell. Its official download URL and SHA3-256 digest are pinned in the script;
the system SQLite and Hermes Python runtime are not replaced.

## Verify delivery

After successful restoration, retry only the affected preserved flush job.
Confirm gateway completion with the intended provider, an iMessage run marked
`completed`, and an empty carried queue/removed flush job. Ask the user to
confirm the visible reply. A successful database repair alone is not proof
of delivery.

Retain backups until the user explicitly authorizes cleanup. Repeated
corruption warrants a separate investigation of the original corruption
cause; do not silently repeat salvage on every inbound message.
