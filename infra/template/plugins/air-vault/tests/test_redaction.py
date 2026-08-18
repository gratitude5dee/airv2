"""Red-team: a vault value echoed back must be masked at every egress (C19).

The plugin registers each stored value with Hermes' redaction engine at
fetch time. Registered patterns join the same alternation as built-in
credential prefixes, and ``redact_sensitive_text`` is the shared choke
point every persistence/egress surface passes through — session-message
storage, run events, and the run-events SSE. These tests plant a value,
fetch, then push adversarial payloads through that choke point (with
``force=True``, the safety-boundary mode) and assert the raw value never
survives.
"""

import json

import pytest

pytest.importorskip("agent.secret_sources.base")

from agent.redact import redact_sensitive_text
from agent.secret_sources.base import (
    reset_source_environment,
    set_source_environment,
)

import vault_store
from vault_source import AirVaultSource

KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
# Long + random: unambiguous in output, and long enough that the masked
# head/tail form can never equal the raw value.
PLANTED = "vlt-red-team-planted-9M4kQ7pXw2LbZ8Rt"
PLANTED_TOTP = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


@pytest.fixture
def fetched_vault(tmp_path):
    vault_store.save_store(
        vault_store.store_path(tmp_path),
        {"version": 1, "items": [{
            "id": "red-1", "kind": "login", "name": "Red Team",
            "fields": {"username": "red@example.com", "password": PLANTED},
            "totp_seed": PLANTED_TOTP,
        }]},
        KEY,
    )
    token = set_source_environment({"AIR_VAULT_KEY": KEY})
    try:
        result = AirVaultSource().fetch({"enabled": True}, tmp_path)
    finally:
        reset_source_environment(token)
    assert result.ok
    return result


def assert_scrubbed(text: str) -> str:
    redacted = redact_sensitive_text(text, force=True)
    assert PLANTED not in redacted, "raw vault value leaked through redaction"
    assert PLANTED_TOTP not in redacted, "raw TOTP seed leaked through redaction"
    return redacted


def test_session_message_is_redacted(fetched_vault):
    message = f"assistant: sure! your password is {PLANTED} — anything else?"
    redacted = assert_scrubbed(message)
    assert "[REDACTED]" in redacted or "..." in redacted or "***" in redacted


def test_run_event_payload_is_redacted(fetched_vault):
    # Hermes redacts tool output as raw text BEFORE the event is serialized
    # (JSON-escaping "\n" to "\\n" would glue an alnum char onto the token,
    # which is exactly why redaction sits upstream of serialization).
    output = redact_sensitive_text(
        f"$ echo $RED_TEAM_VAR\n{PLANTED}\n", force=True
    )
    event = json.dumps({"type": "tool_result", "tool": "terminal",
                        "output": output})
    assert PLANTED not in event and PLANTED_TOTP not in event


def test_sse_frame_is_redacted(fetched_vault):
    frame = (
        "event: run.output\n"
        f"data: {json.dumps({'delta': f'the secret is {PLANTED}'})}\n\n"
    )
    assert_scrubbed(frame)


def test_totp_seed_is_redacted(fetched_vault):
    assert_scrubbed(f"seed dump: {PLANTED_TOTP} end")


def test_redaction_survives_quoting_and_env_assignment(fetched_vault):
    assert_scrubbed(f'RED_TEAM_VAR="{PLANTED}"')
    assert_scrubbed(f"export RED_TEAM_VAR={PLANTED}")
    assert_scrubbed(f"value in json: {json.dumps({'v': PLANTED})}")
