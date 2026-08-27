"""Privacy validator and receipt content boundary (goal.md §15, L1/L8).

Two jobs:
1. `validate_receipt` — the automated content-boundary validator every
   outbound learning row must pass. It is an ALLOWLIST: unknown keys fail.
2. `redact` — strip obvious secret shapes from text before it is persisted
   into Box-local structured logs (raw traces keep raw content; they never
   leave the Box, but local logs still redact — §16.1).
"""

from __future__ import annotations

import re
from typing import Any

RECEIPT_SCHEMA_VERSION = "air.learning-receipt.v1"

ALLOWED_EVENT_TYPES = {
    "episode_collected",
    "episode_reconciled",
    "task_qualified",
    "task_quarantined",
    "candidate_generated",
    "experiment_started",
    "experiment_completed",
    "experiment_cancelled",
    "experiment_failed",
    "candidate_proposed",
    "candidate_approved",
    "candidate_rejected",
    "profile_activated",
    "profile_rolled_back",
    "compatibility_checked",
    "export_completed",
    "deletion_completed",
    "settings_changed",
    "daemon_started",
    "daemon_error",
}

ALLOWED_KEYS = {
    "schema_version",
    "event_type",
    "idempotency_key",
    "occurred_at",
    "trace_id",
    "experiment_id",
    "candidate_id",
    "profile_id",
    "status",
    "backend",
    "air_release",
    "hermes_ref",
    "os_class",
    "served_model",
    "requested_tier",
    "aggregate",
    "error_class",
    "rollback_reason",
}

ALLOWED_AGGREGATE_KEYS = {
    "tokens",
    "cost_usd",
    "latency_ms_p95",
    "sample_count",
    "task_success_delta",
    "task_success_delta_lower95",
    "hard_gate_failures",
}

_OPAQUE_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

# Secret shapes for local-log redaction and canary detection.
_SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{16,}"),
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]{16,}"),
    re.compile(r"(?i)(api[_-]?key|token|secret|password)\s*[=:]\s*\S{8,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]


class ContentBoundaryError(ValueError):
    """A learning row tried to cross the Box boundary with disallowed content."""


def validate_receipt(receipt: dict[str, Any]) -> None:
    """Fail closed: raise ContentBoundaryError unless every field is allowlisted."""
    if not isinstance(receipt, dict):
        raise ContentBoundaryError("receipt must be an object")
    unknown = set(receipt) - ALLOWED_KEYS
    if unknown:
        raise ContentBoundaryError(f"disallowed receipt keys: {sorted(unknown)}")
    if receipt.get("schema_version") != RECEIPT_SCHEMA_VERSION:
        raise ContentBoundaryError("bad schema_version")
    if receipt.get("event_type") not in ALLOWED_EVENT_TYPES:
        raise ContentBoundaryError("unknown event_type")
    for id_key in ("idempotency_key", "trace_id", "experiment_id", "candidate_id", "profile_id"):
        value = receipt.get(id_key)
        if value is not None and not _OPAQUE_ID.match(str(value)):
            raise ContentBoundaryError(f"{id_key} is not an opaque id")
    aggregate = receipt.get("aggregate")
    if aggregate is not None:
        if not isinstance(aggregate, dict):
            raise ContentBoundaryError("aggregate must be an object")
        unknown_agg = set(aggregate) - ALLOWED_AGGREGATE_KEYS
        if unknown_agg:
            raise ContentBoundaryError(f"disallowed aggregate keys: {sorted(unknown_agg)}")
        for value in aggregate.values():
            if not isinstance(value, (int, float)):
                raise ContentBoundaryError("aggregate values must be numeric")
    # Free-text style fields are bounded enums/versions; reject anything that
    # looks like content or a secret.
    for key in ("status", "error_class", "air_release", "hermes_ref", "served_model"):
        value = receipt.get(key)
        if value is None:
            continue
        text = str(value)
        if len(text) > 128 or "\n" in text or contains_secret(text):
            raise ContentBoundaryError(f"{key} failed content checks")


def contains_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in _SECRET_PATTERNS)


def redact(text: str) -> str:
    out = text
    for pattern in _SECRET_PATTERNS:
        out = pattern.sub("[REDACTED]", out)
    return out
