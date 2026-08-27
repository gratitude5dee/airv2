"""TraceEnvelope v1 construction and validation (goal.md §8.1).

The envelope is Box-local `private_raw` data. Hidden chain-of-thought is
never stored (L14): only observable messages, actions, tool results, errors,
state diffs, outcomes, usage, and concise model-provided summaries.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .ledger import LEARNING_HOME

STEP_TYPES = {"message", "action", "tool_result", "error", "state_diff", "summary"}
OUTCOME_STATUSES = {"completed", "failed", "cancelled", "interrupted", "unknown"}
REDACTION_VERSION = "1"


def new_envelope(
    trace_id: str,
    episode_id: str,
    source: str,
    steps: list[dict[str, Any]],
    outcome_status: str,
    usage: dict[str, Any],
    provenance: dict[str, Any],
    consent_basis: str,
    retention_days: int = 30,
    parent_trace_id: str | None = None,
) -> dict[str, Any]:
    if source not in ("production", "evaluation"):
        raise ValueError("bad source")
    if outcome_status not in OUTCOME_STATUSES:
        raise ValueError("bad outcome status")
    for step in steps:
        if step.get("type") not in STEP_TYPES:
            raise ValueError(f"bad step type: {step.get('type')}")
    retention_until = datetime.now(timezone.utc) + timedelta(days=retention_days)
    return {
        "schema_version": "air.trace.v1",
        "trace_id": trace_id,
        "episode_id": episode_id,
        "parent_trace_id": parent_trace_id,
        "source": source,
        "steps": steps,
        "outcome": {"status": outcome_status},
        "usage": usage,
        "provenance": provenance,
        "privacy": {
            "class": "private_raw",
            "consent_basis": consent_basis,
            "retention_until": retention_until.isoformat(),
            "redaction_version": REDACTION_VERSION,
        },
    }


def write_envelope(envelope: dict[str, Any]) -> Path:
    traces_dir = LEARNING_HOME / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    path = traces_dir / f"{envelope['episode_id']}.trace.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(envelope, indent=1))
    tmp.replace(path)
    return path


def new_trace_id() -> str:
    return f"tr_{uuid.uuid4().hex}"


def new_episode_id() -> str:
    return f"ep_{int(time.time())}_{uuid.uuid4().hex[:12]}"
