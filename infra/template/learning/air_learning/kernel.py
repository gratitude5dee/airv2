"""EvaluationKernel: the only product-facing evaluation interface (goal.md §6.1).

Owns backend selection, budget enforcement, paired ordering, lineage, and
receipts. Backends are adapters; V10 M2 ships the native adapter, M5/M6 wire
HUD and Harbor behind the same spec. A backend that is not yet enabled is a
typed `backend_unavailable` failure, never a silent skip (L13).
"""

from __future__ import annotations

import json
import sqlite3
import time

from . import ledger
from .adapters import AdapterError, harbor, hud, native
from .ledger import LEARNING_HOME
from .receipts import emit_receipt

ADAPTERS = {"native": native, "hud": hud, "harbor": harbor}


class KernelError(Exception):
    def __init__(self, error_class: str, message: str):
        super().__init__(message)
        self.error_class = error_class


def _validate_spec(spec: dict) -> None:
    required = (
        "schemaVersion",
        "experimentId",
        "tasksetRef",
        "baselineRef",
        "candidateRef",
        "graderSetRef",
        "fixtureSetRef",
        "requiredCapabilities",
        "seeds",
        "privacyPolicyRef",
        "budget",
    )
    missing = [key for key in required if key not in spec]
    if missing:
        raise KernelError("invalid_spec", f"missing spec fields: {missing}")
    if spec["schemaVersion"] != "air.experiment.v1":
        raise KernelError("invalid_spec", "bad schemaVersion")
    budget = spec["budget"]
    for key in ("maxTrials", "maxTokens", "maxCostUsd", "maxWallTimeSec"):
        if not isinstance(budget.get(key), (int, float)) or budget[key] <= 0:
            raise KernelError("invalid_spec", f"bad budget.{key}")


def select_backend(spec: dict) -> str:
    """goal.md §6.2: exactly one backend owns a job."""
    capabilities = set(spec.get("requiredCapabilities", []))
    if capabilities & {"display", "shell", "subagent"}:
        return "native"
    return "native"  # HUD/Harbor selection activates in M5/M6


def run(conn: sqlite3.Connection, spec: dict) -> dict:
    _validate_spec(spec)
    settings = ledger.get_settings(conn)
    if settings.get("evaluation_kill_switch") == "1":
        raise KernelError("kill_switch", "evaluation kill switch is on")
    if settings.get("mode") in ("off", "observe"):
        raise KernelError("mode_forbids_evaluation", f"mode is {settings.get('mode')}")

    experiment_id = spec["experimentId"]
    backend = select_backend(spec)
    jobs_dir = LEARNING_HOME / "jobs" / experiment_id
    jobs_dir.mkdir(parents=True, exist_ok=True)
    spec_path = jobs_dir / "spec.json"
    spec_path.write_text(json.dumps(spec, indent=1))

    with conn:
        conn.execute(
            "insert or replace into experiments (experiment_id, backend, status, spec_path, created_at) "
            "values (?, ?, 'running', ?, ?)",
            (experiment_id, backend, str(spec_path), time.time()),
        )
    ledger.append_event(conn, "experiment_started", experiment_id, {"backend": backend})
    emit_receipt(conn, "experiment_started", experiment_id=experiment_id, backend=backend)

    try:
        result = ADAPTERS[backend].run_experiment(spec)
    except AdapterError as error:  # typed terminal failure, fail closed
        error_class = error.error_class
        with conn:
            conn.execute(
                "update experiments set status = 'failed', finished_at = ? where experiment_id = ?",
                (time.time(), experiment_id),
            )
        ledger.append_event(conn, "experiment_failed", experiment_id, {"error_class": error_class})
        emit_receipt(
            conn, "experiment_failed", experiment_id=experiment_id,
            backend=backend, error_class=error_class,
        )
        raise KernelError(error_class, str(error)) from error

    result_path = jobs_dir / "result.json"
    result_path.write_text(json.dumps(result, indent=1))
    with conn:
        conn.execute(
            "update experiments set status = ?, result_path = ?, finished_at = ? where experiment_id = ?",
            (result["status"], str(result_path), time.time(), experiment_id),
        )
    ledger.append_event(conn, "experiment_completed", experiment_id, {"status": result["status"]})
    confidence = result.get("confidence") or {}
    emit_receipt(
        conn,
        "experiment_completed",
        experiment_id=experiment_id,
        backend=backend,
        status=result["status"],
        aggregate={
            "sample_count": confidence.get("pairedTrials", 0),
            "hard_gate_failures": sum(1 for g in result.get("hardGates", []) if not g.get("passed")),
        },
    )
    return result
