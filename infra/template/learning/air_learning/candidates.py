"""PolicyOverlay candidates and atomic profile activation (goal.md §12).

Candidates are data. The allowlist below mirrors
packages/learning-contracts/schemas/policy-overlay.v1.json — security,
approval, entitlement, payment, and data-sharing fields do not exist here by
design (L5). Activation is one atomic pointer rename of
`active-profile.json`; the prior profile stays on disk for rollback.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path

from . import ledger
from .ledger import LEARNING_HOME
from .receipts import emit_receipt

ACTIVE_POINTER = LEARNING_HOME / "active-profile.json"

ALLOWED_CHANGE_KEYS = {
    "prompt_addenda",
    "skill_order",
    "tool_routing_hints",
    "recovery_order",
    "memory_retrieval",
    "clarification_thresholds",
    "retry_policy",
    "timeout_budget_sec",
    "step_budget",
    "model_hints",
    "style_preferences",
}

MAX_CANDIDATES_PER_CYCLE = 4

STATES = [
    "draft",
    "schema_valid",
    "shadowed",
    "evaluated",
    "proposed",
    "approved",
    "canary",
    "active",
]
TERMINAL_STATES = {"rejected", "inconclusive", "quarantined", "incompatible", "rolled_back", "superseded"}


class OverlayValidationError(ValueError):
    pass


def validate_manifest(manifest: dict) -> None:
    if manifest.get("schema_version") != "air.policy-overlay.v1":
        raise OverlayValidationError("bad schema_version")
    changes = manifest.get("changes")
    if not isinstance(changes, dict) or not changes:
        raise OverlayValidationError("changes must be a non-empty object")
    unknown = set(changes) - ALLOWED_CHANGE_KEYS
    if unknown:
        raise OverlayValidationError(f"disallowed overlay fields: {sorted(unknown)}")
    blob = json.dumps(changes)
    if len(blob) > 65536:
        raise OverlayValidationError("overlay too large")
    for banned in ("http://", "https://", "file://", "$(", "`", "sudo ", "rm -rf"):
        if banned in blob:
            raise OverlayValidationError(f"overlay contains banned content: {banned!r}")
    compat = manifest.get("hermes_compatibility") or {}
    if not compat.get("tested_refs"):
        raise OverlayValidationError("missing hermes_compatibility.tested_refs")


def create_candidate(conn: sqlite3.Connection, manifest: dict, summary: str) -> str:
    validate_manifest(manifest)
    candidate_id = manifest.get("candidate_id") or f"cand_{uuid.uuid4().hex[:16]}"
    manifest["candidate_id"] = candidate_id
    candidate_dir = LEARNING_HOME / "candidates" / candidate_id
    candidate_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = candidate_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=1))
    now = time.time()
    with conn:
        conn.execute(
            "insert into candidates (candidate_id, parent_profile_id, state, manifest_path, summary, created_at, updated_at) "
            "values (?, ?, 'schema_valid', ?, ?, ?, ?)",
            (candidate_id, manifest.get("parent_profile_id"), str(manifest_path), summary[:500], now, now),
        )
    ledger.append_event(conn, "candidate_generated", candidate_id)
    emit_receipt(conn, "candidate_generated", candidate_id=candidate_id, status="schema_valid")
    return candidate_id


def set_state(conn: sqlite3.Connection, candidate_id: str, state: str) -> None:
    if state not in STATES and state not in TERMINAL_STATES:
        raise ValueError(f"unknown state: {state}")
    with conn:
        conn.execute(
            "update candidates set state = ?, updated_at = ? where candidate_id = ?",
            (state, time.time(), candidate_id),
        )
    ledger.append_event(conn, f"candidate_{state}", candidate_id)


def activate(conn: sqlite3.Connection, candidate_id: str) -> str:
    """Approved candidate -> immutable profile dir -> atomic pointer flip."""
    row = conn.execute(
        "select manifest_path, state from candidates where candidate_id = ?", (candidate_id,)
    ).fetchone()
    if not row:
        raise ValueError("unknown candidate")
    if row["state"] not in ("approved", "canary"):
        raise ValueError(f"candidate not approved (state={row['state']})")
    manifest = json.loads(Path(row["manifest_path"]).read_text())
    validate_manifest(manifest)

    profile_id = f"prof_{uuid.uuid4().hex[:16]}"
    profile_dir = LEARNING_HOME / "profiles" / profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / "overlay.json").write_text(json.dumps(manifest, indent=1))

    previous = read_active_pointer()
    pointer = {
        "profile_id": profile_id,
        "candidate_id": candidate_id,
        "previous_profile_id": previous.get("profile_id") if previous else None,
        "overlay_path": str(profile_dir / "overlay.json"),
        "activated_at": time.time(),
    }
    tmp = ACTIVE_POINTER.with_suffix(".json.tmp")
    with open(tmp, "w") as handle:
        json.dump(pointer, handle)
        handle.flush()
        os.fsync(handle.fileno())
    tmp.replace(ACTIVE_POINTER)

    with conn:
        conn.execute(
            "insert into profiles (profile_id, parent_profile_id, candidate_id, status, dir_path, activated_at) "
            "values (?, ?, ?, 'active', ?, ?)",
            (profile_id, pointer["previous_profile_id"], candidate_id, str(profile_dir), time.time()),
        )
        if pointer["previous_profile_id"]:
            conn.execute(
                "update profiles set status = 'superseded' where profile_id = ?",
                (pointer["previous_profile_id"],),
            )
    set_state(conn, candidate_id, "active")
    emit_receipt(conn, "profile_activated", candidate_id=candidate_id, profile_id=profile_id)
    return profile_id


def rollback(conn: sqlite3.Connection, reason: str = "owner_rejection") -> str | None:
    """Restore the previous profile pointer (or the signed global baseline)."""
    current = read_active_pointer()
    if not current:
        return None
    previous_id = current.get("previous_profile_id")
    if previous_id:
        row = conn.execute("select dir_path from profiles where profile_id = ?", (previous_id,)).fetchone()
        pointer = {
            "profile_id": previous_id,
            "candidate_id": None,
            "previous_profile_id": None,
            "overlay_path": str(Path(row["dir_path"]) / "overlay.json") if row else None,
            "activated_at": time.time(),
        }
        tmp = ACTIVE_POINTER.with_suffix(".json.tmp")
        with open(tmp, "w") as handle:
            json.dump(pointer, handle)
            handle.flush()
            os.fsync(handle.fileno())
        tmp.replace(ACTIVE_POINTER)
        with conn:
            conn.execute("update profiles set status = 'active' where profile_id = ?", (previous_id,))
    else:
        ACTIVE_POINTER.unlink(missing_ok=True)  # back to the signed global baseline
    with conn:
        conn.execute(
            "update profiles set status = 'rolled_back', rolled_back_at = ? where profile_id = ?",
            (time.time(), current["profile_id"]),
        )
    ledger.append_event(conn, "profile_rolled_back", current["profile_id"], {"reason": reason})
    emit_receipt(
        conn,
        "profile_rolled_back",
        profile_id=current["profile_id"],
        rollback_reason=reason if reason in (
            "hard_gate", "integrity_error", "task_family_regression",
            "owner_rejection", "incompatible_update", "kill_switch",
        ) else "owner_rejection",
    )
    return previous_id


def read_active_pointer() -> dict | None:
    try:
        return json.loads(ACTIVE_POINTER.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None
