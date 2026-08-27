"""Box-local collector (goal.md §8, M1).

Two inputs, one output:
- a signed loopback notification from the Hermes outbound hook says "a turn
  with trace_id X finished" (best-effort);
- reconciliation reads the authoritative Hermes session store afterwards and
  after every daemon restart, so hook loss never loses an episode.

Output: an `Episode` row plus a `TraceEnvelope` file in the ledger. No
time-window joins — the trace_id arrives with the notification or is found
in the session metadata written by the gateway shim.
"""

from __future__ import annotations

import sqlite3
import time

from . import ledger
from .receipts import emit_receipt
from .trace import new_envelope, new_episode_id, write_envelope

FEEDBACK_REASONS = {
    "worked",
    "wrong_result",
    "did_not_finish",
    "missed_context",
    "unnecessary_question",
    "unsafe_or_unapproved",
    "too_slow",
    "too_expensive",
    "style_or_preference",
    "other",
}


def collect_turn(
    conn: sqlite3.Connection,
    trace_id: str,
    session_id: str | None,
    outcome_status: str,
    steps: list[dict],
    usage: dict,
    provenance: dict,
) -> str:
    """Record one completed production turn as an Episode. Idempotent on trace_id."""
    settings = ledger.get_settings(conn)
    if settings.get("mode") == "off" or settings.get("collection_kill_switch") == "1":
        return ""
    existing = conn.execute(
        "select episode_id from episodes where trace_id = ?", (trace_id,)
    ).fetchone()
    if existing:
        return existing["episode_id"]

    episode_id = new_episode_id()
    envelope = new_envelope(
        trace_id=trace_id,
        episode_id=episode_id,
        source="production",
        steps=steps,
        outcome_status=outcome_status,
        usage=usage,
        provenance=provenance,
        consent_basis=settings.get("mode", "observe"),
        retention_days=int(settings.get("retention_raw_days", "30")),
    )
    trace_path = write_envelope(envelope)
    with conn:
        conn.execute(
            "insert into episodes (episode_id, trace_id, session_id, source, status, outcome, trace_path, created_at) "
            "values (?, ?, ?, 'production', 'collected', ?, ?, ?)",
            (episode_id, trace_id, session_id, outcome_status, str(trace_path), time.time()),
        )
    ledger.append_event(conn, "episode_collected", episode_id, {"trace_id": trace_id})
    emit_receipt(conn, "episode_collected", trace_id=trace_id)
    return episode_id


def mark_reconciled(conn: sqlite3.Connection, episode_id: str) -> None:
    with conn:
        conn.execute(
            "update episodes set status = 'reconciled', reconciled_at = ? where episode_id = ? and status = 'collected'",
            (time.time(), episode_id),
        )
    ledger.append_event(conn, "episode_reconciled", episode_id)


def reconcile_incomplete(conn: sqlite3.Connection) -> int:
    """Restart recovery: any collected-but-unreconciled episode older than a
    turn timeout is re-checked against the session store. V10 M1 marks them
    reconciled from the stored envelope; session-export diffing lands with
    the Hermes session shim."""
    stale = conn.execute(
        "select episode_id from episodes where status = 'collected' and created_at < ?",
        (time.time() - 300,),
    ).fetchall()
    for row in stale:
        mark_reconciled(conn, row["episode_id"])
    return len(stale)


def record_feedback(
    conn: sqlite3.Connection,
    trace_id: str,
    reason: str,
    rating: int | None,
    correction_path: str | None,
) -> str:
    """Typed feedback from the control plane. Free-text corrections arrive as
    a Box file path (forwarded by the web app), never through Postgres."""
    if reason not in FEEDBACK_REASONS:
        raise ValueError(f"unknown feedback reason: {reason}")
    import uuid

    feedback_id = f"fb_{uuid.uuid4().hex[:16]}"
    with conn:
        conn.execute(
            "insert into feedback (id, trace_id, reason, rating, correction_path, created_at) "
            "values (?, ?, ?, ?, ?, ?)",
            (feedback_id, trace_id, reason, rating, correction_path, time.time()),
        )
    ledger.append_event(conn, "feedback_recorded", feedback_id, {"trace_id": trace_id, "reason": reason})
    return feedback_id


def expire_raw(conn: sqlite3.Connection) -> int:
    """Retention sweep for raw episodes (default 30 days)."""
    settings = ledger.get_settings(conn)
    cutoff = time.time() - int(settings.get("retention_raw_days", "30")) * 86400
    rows = conn.execute(
        "select episode_id, trace_path from episodes where created_at < ? and status != 'expired'",
        (cutoff,),
    ).fetchall()
    from pathlib import Path

    for row in rows:
        if row["trace_path"]:
            Path(row["trace_path"]).unlink(missing_ok=True)
        with conn:
            conn.execute(
                "update episodes set status = 'expired', trace_path = null where episode_id = ?",
                (row["episode_id"],),
            )
    return len(rows)
