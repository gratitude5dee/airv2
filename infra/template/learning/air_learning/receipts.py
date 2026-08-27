"""Content-free receipt emission (goal.md §15.2).

Every receipt passes the allowlist validator before entering the outbox. A
receipt that fails validation is dropped and logged as a daemon_error —
failing closed is the point.
"""

from __future__ import annotations

import sqlite3
import sys
import uuid
from datetime import datetime, timezone

from . import ledger
from .privacy import ContentBoundaryError, validate_receipt


def emit_receipt(
    conn: sqlite3.Connection,
    event_type: str,
    *,
    trace_id: str | None = None,
    experiment_id: str | None = None,
    candidate_id: str | None = None,
    profile_id: str | None = None,
    status: str | None = None,
    backend: str | None = None,
    aggregate: dict | None = None,
    error_class: str | None = None,
    rollback_reason: str | None = None,
) -> None:
    receipt = {
        "schema_version": "air.learning-receipt.v1",
        "event_type": event_type,
        "idempotency_key": uuid.uuid4().hex,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "trace_id": trace_id,
        "experiment_id": experiment_id,
        "candidate_id": candidate_id,
        "profile_id": profile_id,
        "status": status,
        "backend": backend,
        "aggregate": aggregate,
        "error_class": error_class,
        "rollback_reason": rollback_reason,
    }
    receipt = {key: value for key, value in receipt.items() if value is not None}
    try:
        validate_receipt(receipt)
    except ContentBoundaryError as error:
        print(f"receipt dropped by content boundary: {error}", file=sys.stderr)
        ledger.append_event(conn, "receipt_dropped", None, {"error": str(error)[:200]})
        return
    ledger.enqueue_receipt(conn, receipt)
