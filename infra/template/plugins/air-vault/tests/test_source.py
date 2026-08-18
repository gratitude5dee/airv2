"""AirVaultSource contract tests: vendored conformance + spec unit tests."""

from pathlib import Path

import pytest

pytest.importorskip("agent.secret_sources.base")

from agent.secret_sources.base import ErrorKind, FetchResult, SecretSource
from agent.secret_sources.registry import (
    _reset_registry_for_tests,
    apply_all,
    register_source,
)

import vault_store
from conformance import SecretSourceConformance
from vault_source import AirVaultSource

KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
CFG = {"enabled": True}


def write_store(home: Path, items, key: str = KEY) -> None:
    vault_store.save_store(
        vault_store.store_path(home), {"version": 1, "items": items}, key
    )


def fetch(home: Path, env: dict) -> FetchResult:
    from agent.secret_sources.base import (
        reset_source_environment,
        set_source_environment,
    )

    token = set_source_environment(env)
    try:
        return AirVaultSource().fetch(CFG, home)
    finally:
        reset_source_environment(token)


class TestAirVaultConformance(SecretSourceConformance):
    @pytest.fixture
    def source(self):
        return AirVaultSource()


def test_protected_env_vars():
    assert AirVaultSource().protected_env_vars(CFG) == frozenset({"AIR_VAULT_KEY"})


def test_missing_key_not_configured(tmp_path):
    result = fetch(tmp_path, {})
    assert not result.ok and result.error_kind is ErrorKind.NOT_CONFIGURED
    assert not result.secrets


def test_missing_store_not_configured(tmp_path):
    result = fetch(tmp_path, {"AIR_VAULT_KEY": KEY})
    assert not result.ok and result.error_kind is ErrorKind.NOT_CONFIGURED


def test_corrupt_store_internal(tmp_path):
    path = vault_store.store_path(tmp_path)
    path.parent.mkdir(parents=True)
    path.write_text("v1:zz:not:hex")
    result = fetch(tmp_path, {"AIR_VAULT_KEY": KEY})
    assert not result.ok and result.error_kind is ErrorKind.INTERNAL


def test_wrong_key_internal(tmp_path):
    write_store(tmp_path, [], key="ff" * 32)
    result = fetch(tmp_path, {"AIR_VAULT_KEY": KEY})
    assert not result.ok and result.error_kind is ErrorKind.INTERNAL


def test_empty_store_ok_no_secrets(tmp_path):
    write_store(tmp_path, [])
    result = fetch(tmp_path, {"AIR_VAULT_KEY": KEY})
    assert result.ok and result.secrets == {}


def test_mapped_items_only_and_env_name_validation(tmp_path):
    write_store(tmp_path, [
        {"id": "1", "kind": "api_key", "name": "good",
         "fields": {"value": "sk-good-value-123456"}, "env_var": "GOOD_VAR"},
        {"id": "2", "kind": "api_key", "name": "no-binding",
         "fields": {"value": "sk-unbound-987654321"}},
        {"id": "3", "kind": "api_key", "name": "bad-name",
         "fields": {"value": "sk-bad-name-11111111"}, "env_var": "1BAD NAME"},
        {"id": "4", "kind": "api_key", "name": "empty",
         "fields": {}, "env_var": "EMPTY_VAR"},
    ])
    result = fetch(tmp_path, {"AIR_VAULT_KEY": KEY})
    assert result.ok
    assert result.secrets == {"GOOD_VAR": "sk-good-value-123456"}
    assert "1BAD NAME" in result.skipped and "EMPTY_VAR" in result.skipped
    assert len(result.warnings) == 2


def test_fetch_never_raises_on_weird_store(tmp_path):
    path = vault_store.store_path(tmp_path)
    path.parent.mkdir(parents=True)
    path.write_text(vault_store.seal("[1,2,3]", KEY))
    result = fetch(tmp_path, {"AIR_VAULT_KEY": KEY})
    assert isinstance(result, FetchResult) and not result.ok


class FakeBitwardenSource(SecretSource):
    """Bulk source claiming the same var — mapped AIR Vault must win."""

    name = "bitwarden"
    label = "Bitwarden"
    shape = "bulk"

    def fetch(self, cfg, home_path):
        result = FetchResult()
        result.secrets = {"SHARED_VAR": "bitwarden-value-000000",
                          "BW_ONLY_VAR": "bitwarden-only-111111"}
        return result


@pytest.fixture
def clean_registry(monkeypatch):
    _reset_registry_for_tests()
    monkeypatch.setattr(
        "agent.secret_sources.registry._ensure_builtin_sources", lambda: None
    )
    yield
    _reset_registry_for_tests()


def test_apply_all_round_trip_provenance(tmp_path, clean_registry):
    write_store(tmp_path, [
        {"id": "1", "kind": "api_key", "name": "OpenAI",
         "fields": {"value": "sk-roundtrip-424242"}, "env_var": "ROUND_TRIP_VAR"},
    ])
    assert register_source(AirVaultSource())
    env = {"AIR_VAULT_KEY": KEY}
    report = apply_all({"air_vault": {"enabled": True}}, tmp_path, environ=env)
    assert env["ROUND_TRIP_VAR"] == "sk-roundtrip-424242"
    applied = report.provenance["ROUND_TRIP_VAR"]
    assert applied.source == "air_vault" and applied.shape == "mapped"
    [sr] = [s for s in report.sources if s.name == "air_vault"]
    assert sr.label == "AIR Vault"  # rendered as "(from AIR Vault)"
    assert "ROUND_TRIP_VAR" in sr.applied


def test_first_claim_wins_against_fake_bitwarden(tmp_path, clean_registry):
    write_store(tmp_path, [
        {"id": "1", "kind": "api_key", "name": "shared",
         "fields": {"value": "air-vault-value-9999"}, "env_var": "SHARED_VAR"},
    ])
    # Register bulk first: mapped sources still apply before bulk ones.
    assert register_source(FakeBitwardenSource())
    assert register_source(AirVaultSource())
    env = {"AIR_VAULT_KEY": KEY}
    report = apply_all(
        {"air_vault": {"enabled": True}, "bitwarden": {"enabled": True}},
        tmp_path, environ=env,
    )
    assert env["SHARED_VAR"] == "air-vault-value-9999"
    assert report.provenance["SHARED_VAR"].source == "air_vault"
    assert env["BW_ONLY_VAR"] == "bitwarden-only-111111"
    [bw] = [s for s in report.sources if s.name == "bitwarden"]
    assert "SHARED_VAR" in bw.skipped_claimed
    assert any("SHARED_VAR" in c for c in report.conflicts)


def test_air_vault_key_survives_hostile_store_entry(tmp_path, clean_registry):
    # The CLI refuses to bind AIR_VAULT_KEY, so craft the hostile store
    # directly — the orchestrator's protected-var guard is the backstop.
    write_store(tmp_path, [
        {"id": "1", "kind": "api_key", "name": "hostile",
         "fields": {"value": "attacker-key-00000000"},
         "env_var": "AIR_VAULT_KEY"},
    ])
    assert register_source(AirVaultSource())
    env = {"AIR_VAULT_KEY": KEY}
    report = apply_all({"air_vault": {"enabled": True}}, tmp_path, environ=env)
    assert env["AIR_VAULT_KEY"] == KEY
    [sr] = [s for s in report.sources if s.name == "air_vault"]
    assert "AIR_VAULT_KEY" in sr.skipped_protected
    assert "AIR_VAULT_KEY" not in report.provenance
