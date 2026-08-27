"""Private task compiler (goal.md §9).

Runs without network or tools; trace content is untrusted DATA. V10 M1 ships
signal qualification and the state machine; fixture synthesis and oracle
construction land per task family in M3. Anything without a reliable
expected outcome is quarantined, never silently kept.
"""

from __future__ import annotations

import sqlite3
import time
import uuid

from . import ledger
from .receipts import emit_receipt

STRONG_SIGNALS = {
    "explicit_feedback",       # worked / failure enum tied to a trace_id
    "confirmed_correction",    # owner correction with confirmed intent
    "deterministic_state",     # observable file/calendar/artifact state
    "approval_ledger",         # gate reached / not reached, provable
    "typed_terminal_error",    # repeatable product error
    "operator_authored",       # synthetic or adversarial task
}

TASK_STATES = [
    "draft",
    "sanitized",
    "oracle_verified",
    "qualified",
    "train",
    "dev",
    "holdout",
    "retired",
    "quarantined",
]


def qualify_episode(
    conn: sqlite3.Connection,
    episode_id: str,
    family: str,
    signals: set[str],
) -> str | None:
    """Create a draft task from an episode when it carries a strong signal.

    Weak signals (silence, continuation, long output, uncalibrated judge
    preference) never qualify — callers must not pass them as signals.
    """
    strong = signals & STRONG_SIGNALS
    if not strong:
        return None
    task_id = f"task_{uuid.uuid4().hex[:16]}"
    with conn:
        conn.execute(
            "insert into tasks (task_id, family, state, source_episode_id, created_at) "
            "values (?, ?, 'draft', ?, ?)",
            (task_id, family, episode_id, time.time()),
        )
    ledger.append_event(conn, "task_drafted", task_id, {"family": family, "signals": sorted(strong)})
    return task_id


def quarantine(conn: sqlite3.Connection, task_id: str, reason: str) -> None:
    with conn:
        conn.execute(
            "update tasks set state = 'quarantined', quarantine_reason = ? where task_id = ?",
            (reason[:200], task_id),
        )
    ledger.append_event(conn, "task_quarantined", task_id, {"reason": reason[:200]})
    emit_receipt(conn, "task_quarantined", status="quarantined")


def assign_split(conn: sqlite3.Connection, task_id: str, split: str) -> None:
    """Family-and-time based split assignment. Descendants of one incident
    share a family and therefore a split — enforced here by keying the split
    on the family's existing assignment."""
    if split not in ("train", "dev", "holdout"):
        raise ValueError("bad split")
    row = conn.execute("select family, state from tasks where task_id = ?", (task_id,)).fetchone()
    if not row or row["state"] != "qualified":
        raise ValueError("task not qualified")
    existing = conn.execute(
        "select distinct split from tasks where family = ? and split is not null",
        (row["family"],),
    ).fetchall()
    taken = {r["split"] for r in existing}
    if taken and split not in taken:
        raise ValueError(
            f"family {row['family']} already assigned to {sorted(taken)} — near-duplicates stay in one split"
        )
    with conn:
        conn.execute("update tasks set split = ?, state = ? where task_id = ?", (split, split, task_id))
    ledger.append_event(conn, "task_split_assigned", task_id, {"split": split})
    emit_receipt(conn, "task_qualified", status=split)
