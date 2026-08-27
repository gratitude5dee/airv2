"""Unit tests for the Box-local learning plane (goal.md V10)."""

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

os.environ["AIR_LEARNING_HOME"] = tempfile.mkdtemp(prefix="air-learning-test-")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from air_learning import (  # noqa: E402
    candidates,
    collector,
    daemon,
    kernel,
    ledger,
    promotion,
    task_compiler,
)
from air_learning.privacy import (  # noqa: E402
    ContentBoundaryError,
    contains_secret,
    redact,
    validate_receipt,
)


@pytest.fixture()
def conn(tmp_path):
    connection = ledger.connect(tmp_path / "ledger.db")
    yield connection
    connection.close()


PROVENANCE = {
    "air_release": "sha256:" + "0" * 64,
    "hermes_ref": "abc123",
    "profile_id": None,
    "served_model": "gpt-x",
}


def _receipt(**extra):
    base = {
        "schema_version": "air.learning-receipt.v1",
        "event_type": "daemon_started",
        "idempotency_key": "k" * 16,
        "occurred_at": "2026-01-01T00:00:00Z",
    }
    base.update(extra)
    return base


class TestLedger:
    def test_wal_and_foreign_keys(self, conn):
        assert conn.execute("pragma journal_mode").fetchone()[0] == "wal"
        assert conn.execute("pragma foreign_keys").fetchone()[0] == 1

    def test_migrations_are_idempotent(self, tmp_path):
        first = ledger.connect(tmp_path / "ledger.db")
        first.close()
        second = ledger.connect(tmp_path / "ledger.db")
        assert second.execute("select count(*) from settings").fetchone()[0] >= 0
        second.close()

    def test_default_mode_is_observe(self, conn):
        assert ledger.get_settings(conn)["mode"] == "observe"

    def test_event_idempotency(self, conn):
        ledger.append_event(conn, "settings_changed", idempotency_key="same-key")
        ledger.append_event(conn, "settings_changed", idempotency_key="same-key")
        count = conn.execute(
            "select count(*) from lineage_events where idempotency_key = 'same-key'"
        ).fetchone()[0]
        assert count == 1

    def test_drain_is_peek_until_acked(self, conn):
        ledger.enqueue_receipt(conn, _receipt(idempotency_key="rcpt-1"))
        first = ledger.drain_receipts(conn)
        assert [r["idempotency_key"] for r in first] == ["rcpt-1"]
        # not acked yet: the receipt is redelivered
        again = ledger.drain_receipts(conn)
        assert [r["idempotency_key"] for r in again] == ["rcpt-1"]
        assert ledger.ack_receipts(conn, ["rcpt-1"]) == 1
        assert ledger.drain_receipts(conn) == []
        # acking again is a no-op
        assert ledger.ack_receipts(conn, ["rcpt-1"]) == 0


class TestPrivacy:
    def test_valid_receipt_passes(self):
        validate_receipt(_receipt())

    def test_unknown_key_rejected(self):
        with pytest.raises(ContentBoundaryError):
            validate_receipt(_receipt(prompt="raw content"))

    def test_unknown_event_type_rejected(self):
        with pytest.raises(ContentBoundaryError):
            validate_receipt(_receipt(event_type="private_dump"))

    def test_secret_canary_rejected(self):
        with pytest.raises(ContentBoundaryError):
            validate_receipt(_receipt(status="sk-" + "a" * 40))

    def test_contains_secret_and_redact(self):
        text = "token sk-" + "a" * 40 + " end"
        assert contains_secret(text)
        assert "sk-" + "a" * 40 not in redact(text)


class TestCollector:
    def test_collect_turn_creates_episode(self, conn):
        episode_id = collector.collect_turn(
            conn, "tr_1", "sess", "completed", [{"type": "message"}], {"prompt_tokens": 3}, PROVENANCE
        )
        row = conn.execute(
            "select trace_id, status from episodes where episode_id = ?", (episode_id,)
        ).fetchone()
        assert row["trace_id"] == "tr_1"

    def test_feedback_reason_enum_enforced(self, conn):
        with pytest.raises(ValueError):
            collector.record_feedback(conn, "tr_1", "not_a_reason", None, None)
        feedback_id = collector.record_feedback(conn, "tr_1", "wrong_result", 2, None)
        assert feedback_id.startswith("fb_")


class TestTaskCompiler:
    def _qualified_task(self, conn, family="calendar"):
        episode_id = collector.collect_turn(
            conn, "tr_q", None, "failed", [], {}, PROVENANCE
        )
        task_id = task_compiler.qualify_episode(
            conn, episode_id, family, {"explicit_feedback"}
        )
        conn.execute("update tasks set state = 'qualified' where task_id = ?", (task_id,))
        conn.commit()
        return task_id

    def test_weak_signals_never_qualify(self, conn):
        episode_id = collector.collect_turn(conn, "tr_w", None, "completed", [], {}, PROVENANCE)
        assert task_compiler.qualify_episode(conn, episode_id, "general", set()) is None

    def test_family_split_leakage_blocked(self, conn):
        first = self._qualified_task(conn)
        second = self._qualified_task(conn)
        task_compiler.assign_split(conn, first, "train")
        with pytest.raises(ValueError):
            task_compiler.assign_split(conn, second, "holdout")


class TestCandidates:
    MANIFEST = {
        "schema_version": "air.policy-overlay.v1",
        "parent_profile_id": None,
        "baseline_release": "sha256:" + "0" * 64,
        "hermes_compatibility": {
            "tested_refs": ["abc123"],
            "overlay_schema": "air.policy-overlay.v1",
        },
        "changes": {"skill_order": ["calendar", "general"]},
        "source_evidence": [],
        "optimizer_version": "v1",
    }

    def test_executable_patch_rejected(self):
        bad = dict(self.MANIFEST)
        bad["changes"] = {"patch": "import os"}
        with pytest.raises(ValueError):
            candidates.validate_manifest(bad)

    def test_protected_policy_rejected(self):
        bad = dict(self.MANIFEST)
        bad["changes"] = {"approval_policy": "never_ask"}
        with pytest.raises(ValueError):
            candidates.validate_manifest(bad)

    def test_activate_and_rollback_are_atomic(self, conn):
        candidate_id = candidates.create_candidate(conn, self.MANIFEST, "reorder skills")
        candidates.set_state(conn, candidate_id, "approved")
        profile_id = candidates.activate(conn, candidate_id)
        pointer = candidates.read_active_pointer()
        assert pointer["profile_id"] == profile_id
        restored = candidates.rollback(conn, "owner_rejection")
        assert restored is None  # baseline: no parent profile
        assert candidates.read_active_pointer() is None

    def test_unapproved_candidate_cannot_activate(self, conn):
        candidate_id = candidates.create_candidate(conn, self.MANIFEST, "reorder skills")
        with pytest.raises(ValueError):
            candidates.activate(conn, candidate_id)


class TestPromotion:
    def test_fails_closed_on_empty_result(self):
        ok, reasons = promotion.evaluate({"hardGates": [], "confidence": {}, "scoreVectors": []})
        assert not ok
        assert reasons

    def test_hard_gate_failure_blocks(self):
        result = {
            "hardGates": [{"gate": "secret_integrity", "passed": False}],
            "confidence": {"task_success_delta_lower95": 0.1},
            "scoreVectors": [{}],
        }
        ok, reasons = promotion.evaluate(result)
        assert not ok
        assert any("secret_integrity" in reason for reason in reasons)


class TestKernel:
    SPEC = {
        "schemaVersion": "air.experiment.v1",
        "experimentId": "exp_1",
        "tasksetRef": "olr:t",
        "baselineRef": "olr:b",
        "candidateRef": "olr:c",
        "graderSetRef": "olr:g",
        "fixtureSetRef": "olr:f",
        "requiredCapabilities": [],
        "seeds": [1],
        "privacyPolicyRef": "olr:p",
        "budget": {"maxTrials": 1, "maxTokens": 10, "maxCostUsd": 0.1, "maxWallTimeSec": 5},
    }

    def test_observe_mode_forbids_evaluation(self, conn):
        with pytest.raises(kernel.KernelError) as info:
            kernel.run(conn, self.SPEC)
        assert info.value.error_class == "mode_forbids_evaluation"

    def test_unavailable_backend_is_typed(self, conn):
        ledger.set_setting(conn, "mode", "suggest")
        spec = dict(self.SPEC)
        spec["requiredCapabilities"] = ["browser"]
        with pytest.raises(kernel.KernelError) as info:
            kernel.run(conn, spec)
        assert info.value.error_class in ("backend_unavailable", "twin_unavailable")


class TestDaemonProtocol:
    def test_bad_protocol_version_rejected(self):
        response = daemon.handle_request({"v": 999, "method": "status"})
        assert not response["ok"]
        assert response["error_class"] == "bad_request"

    def test_status_shape(self):
        response = daemon.handle_request({"v": daemon.PROTOCOL_VERSION, "method": "status"})
        assert response["ok"]
        result = response["result"]
        assert result["mode"] in ("off", "observe", "suggest", "auto_safe")
        assert set(result["counts"]) >= {"episodes", "feedback", "candidates", "profiles"}

    def test_unknown_method_rejected(self):
        response = daemon.handle_request({"v": daemon.PROTOCOL_VERSION, "method": "nope"})
        assert not response["ok"]

    def test_responses_are_json_serializable(self):
        response = daemon.handle_request({"v": daemon.PROTOCOL_VERSION, "method": "status"})
        json.dumps(response)
