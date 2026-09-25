"""Contract enforcement for learning-receipt.v1 (goal.md §2, §15.2, L1).

The schema in packages/learning-contracts is the seam between this daemon
and the web control plane. These tests pin both directions:

- every valid fixture validates against the schema AND passes the
  daemon's own content-boundary check;
- every invalid fixture is rejected by the schema AND by the daemon's
  own content-boundary check (fail closed);
- receipts the daemon actually emits (emit_receipt -> outbox) validate
  against the schema, so a drift in receipts.py fails here.

Install the test extra first: pip install '.[test]' (pinned jsonschema —
the daemon itself stays stdlib-only, C24).
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("AIR_LEARNING_HOME", tempfile.mkdtemp(prefix="air-learning-test-"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jsonschema  # noqa: E402 — test-only dep, never on the box (C24)

from air_learning import ledger  # noqa: E402
from air_learning.privacy import ContentBoundaryError, validate_receipt  # noqa: E402
from air_learning.receipts import emit_receipt  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[4]
CONTRACTS = REPO_ROOT / "packages" / "learning-contracts"
SCHEMA = json.loads((CONTRACTS / "schemas" / "learning-receipt.v1.json").read_text())
VALID_DIR = CONTRACTS / "fixtures" / "receipts" / "valid"
INVALID_DIR = CONTRACTS / "fixtures" / "receipts" / "invalid"

VALIDATOR = jsonschema.Draft7Validator(SCHEMA)


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


@pytest.fixture()
def conn(tmp_path):
    connection = ledger.connect(tmp_path / "ledger.db")
    yield connection
    connection.close()


@pytest.mark.parametrize("fixture", sorted(VALID_DIR.glob("*.json")), ids=lambda p: p.name)
def test_valid_fixture_matches_schema(fixture):
    errors = list(VALIDATOR.iter_errors(_load(fixture)))
    assert errors == [], f"{fixture.name}: {[e.message for e in errors]}"


@pytest.mark.parametrize("fixture", sorted(VALID_DIR.glob("*.json")), ids=lambda p: p.name)
def test_valid_fixture_passes_content_boundary(fixture):
    validate_receipt(_load(fixture))  # must not raise


@pytest.mark.parametrize("fixture", sorted(INVALID_DIR.glob("*.json")), ids=lambda p: p.name)
def test_invalid_fixture_fails_schema(fixture):
    assert not VALIDATOR.is_valid(_load(fixture)), f"{fixture.name} unexpectedly valid"


@pytest.mark.parametrize("fixture", sorted(INVALID_DIR.glob("*.json")), ids=lambda p: p.name)
def test_invalid_fixture_fails_content_boundary(fixture):
    with pytest.raises(ContentBoundaryError):
        validate_receipt(_load(fixture))


def test_emitted_receipts_validate(conn):
    """The daemon's own outbox is schema-shaped for every event it emits."""
    cases = [
        ("daemon_started", {}),
        ("episode_collected", {"trace_id": "tr_01h455vek1wv2t4pz9j2y7f5xd"}),
        (
            "experiment_completed",
            {
                "experiment_id": "exp_4f6a8c2d1e0b",
                "candidate_id": "cand_8c2d1e0f9a7b",
                "status": "passed",
                "backend": "hud",
                "aggregate": {"tokens": 12, "sample_count": 3, "hard_gate_failures": 0},
            },
        ),
        (
            "profile_rolled_back",
            {"profile_id": "prof_7e1c9a04d2f8", "rollback_reason": "hard_gate"},
        ),
    ]
    for event_type, kwargs in cases:
        emit_receipt(conn, event_type, **kwargs)
    receipts = ledger.drain_receipts(conn)
    assert len(receipts) == len(cases)
    for receipt in receipts:
        errors = list(VALIDATOR.iter_errors(receipt))
        assert errors == [], f"{receipt.get('event_type')}: {[e.message for e in errors]}"
