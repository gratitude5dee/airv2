"""Unit tests for the encrypted store: envelope, CLI-shape operations, TOTP."""

import json
import os
import stat

import pytest

pytest.importorskip("cryptography")

import vault_store
from vault_store import VaultError

KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
OTHER_KEY = "ff" * 32

# Sealed with apps/web/lib/crypto/secretbox.ts semantics (node crypto
# aes-256-gcm, iv 0102..0c) — proves cross-language envelope parity.
TS_SEALED = (
    "v1:0102030405060708090a0b0c:ff225d11bc00d1aa7260addbefa68c5d:"
    "0c1370cc9c3ad5209891cfb84189766a07ebd192"
)


def test_envelope_roundtrip():
    sealed = vault_store.seal("hello vault", KEY)
    assert sealed.startswith("v1:")
    assert vault_store.open_sealed(sealed, KEY) == "hello vault"


def test_envelope_parity_with_secretbox_ts():
    assert vault_store.open_sealed(TS_SEALED, KEY) == "vault-parity-fixture"


def test_wrong_key_is_store_locked():
    sealed = vault_store.seal("x", KEY)
    with pytest.raises(VaultError) as exc:
        vault_store.open_sealed(sealed, OTHER_KEY)
    assert exc.value.code == "store_locked"


def test_corrupt_envelope_is_store_corrupt():
    for bad in ("", "v2:aa:bb:cc", "v1:zz:bb:cc", "v1:aa:bb", "garbage"):
        with pytest.raises(VaultError) as exc:
            vault_store.open_sealed(bad, KEY)
        assert exc.value.code == "store_corrupt"


def test_invalid_key_rejected():
    with pytest.raises(VaultError) as exc:
        vault_store.seal("x", "deadbeef")
    assert exc.value.code == "key_invalid"


def test_save_load_store_roundtrip_mode_600(tmp_path):
    path = tmp_path / "vault" / "store.enc"
    store = vault_store.empty_store()
    store["items"].append({"id": "a", "kind": "note", "name": "n", "fields": {}})
    vault_store.save_store(path, store, KEY)
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600
    loaded = vault_store.load_store(path, KEY)
    assert loaded["items"][0]["id"] == "a"
    # On-disk bytes are ciphertext only.
    raw = path.read_text()
    assert "note" not in raw and raw.startswith("v1:")


def test_load_missing_store(tmp_path):
    with pytest.raises(VaultError) as exc:
        vault_store.load_store(tmp_path / "nope.enc", KEY)
    assert exc.value.code == "store_missing"


def test_apply_operations_crud():
    store = vault_store.empty_store()
    results = vault_store.apply_operations(store, [
        {"op": "create", "item": {"kind": "api_key", "name": "OpenAI",
                                  "fields": {"value": "sk-test-abcdef1234"},
                                  "env_var": "MY_API_KEY"}},
    ])
    item_id = results[0]["id"]
    assert results[0]["status"] == "created"
    assert results[0]["item"]["masked"] == "sk-\u20261234"
    assert "sk-test-abcdef1234" not in json.dumps(results)

    results = vault_store.apply_operations(store, [
        {"op": "update", "id": item_id,
         "item": {"name": "OpenAI prod", "fields": {"value": "sk-live-zzzz9999"}}},
    ])
    assert results[0]["item"]["name"] == "OpenAI prod"
    assert store["items"][0]["fields"]["value"] == "sk-live-zzzz9999"

    vault_store.apply_operations(store, [{"op": "delete", "id": item_id}])
    assert store["items"] == []


def test_apply_field_null_deletes_key():
    store = vault_store.empty_store()
    [created] = vault_store.apply_operations(store, [
        {"op": "create", "item": {"kind": "login", "name": "Gmail",
                                  "fields": {"username": "a@b.c",
                                             "password": "hunter2hunter2"}}},
    ])
    vault_store.apply_operations(store, [
        {"op": "update", "id": created["id"], "item": {"fields": {"password": None}}},
    ])
    assert "password" not in store["items"][0]["fields"]


def test_apply_rejects_protected_env_var():
    store = vault_store.empty_store()
    with pytest.raises(VaultError) as exc:
        vault_store.apply_operations(store, [
            {"op": "create", "item": {"kind": "api_key", "name": "evil",
                                      "fields": {"value": "x" * 20},
                                      "env_var": "AIR_VAULT_KEY"}},
        ])
    assert exc.value.code == "env_var_protected"


def test_apply_rejects_invalid_and_duplicate_env_var():
    store = vault_store.empty_store()
    with pytest.raises(VaultError) as exc:
        vault_store.apply_operations(store, [
            {"op": "create", "item": {"kind": "api_key", "name": "bad",
                                      "fields": {"value": "y" * 20},
                                      "env_var": "1BAD NAME"}},
        ])
    assert exc.value.code == "env_var_invalid"

    vault_store.apply_operations(store, [
        {"op": "create", "item": {"kind": "api_key", "name": "one",
                                  "fields": {"value": "a" * 20},
                                  "env_var": "SHARED_VAR"}},
    ])
    with pytest.raises(VaultError) as exc:
        vault_store.apply_operations(store, [
            {"op": "create", "item": {"kind": "api_key", "name": "two",
                                      "fields": {"value": "b" * 20},
                                      "env_var": "SHARED_VAR"}},
        ])
    assert exc.value.code == "env_var_taken"


def test_masked_for_card_and_login():
    assert vault_store.masked_for(
        {"kind": "card", "fields": {"number": "4242424242424242"}}
    ) == "\u2022\u2022\u2022\u2022 4242"
    assert vault_store.masked_for(
        {"kind": "login", "fields": {"username": "a@b.c", "password": "s3cret!!"}}
    ) == "a@b.c"
    assert vault_store.masked_for({"kind": "note", "fields": {"note": "x"}}) is None


def test_env_name_validation_parity():
    """Parity with agent.secret_sources.base.is_valid_env_name."""
    base = pytest.importorskip("agent.secret_sources.base")
    for name in ("GOOD", "_ok", "A1_B2", "1bad", "BAD NAME", "", "BAD-NAME",
                 "lower_ok", "WITH.DOT"):
        assert vault_store.is_valid_env_name(name) == base.is_valid_env_name(name)


def test_totp_rfc6238_vector():
    # RFC 6238 SHA-1 test seed ("12345678901234567890" base32) at T=59s.
    seed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert vault_store.totp_code(seed, at=59, digits=8) == "94287082"
    assert vault_store.totp_code(seed, at=59) == "287082"


def test_totp_invalid_seed():
    with pytest.raises(VaultError) as exc:
        vault_store.totp_code("!!!not-base32!!!")
    assert exc.value.code == "totp_seed_invalid"


def test_secret_values_excludes_non_secret_fields():
    store = {"version": 1, "items": [{
        "id": "a", "kind": "login", "name": "Gmail",
        "fields": {"username": "person@example.com", "password": "p" * 16},
        "totp_seed": "GEZDGNBVGY3TQOJQ",
    }]}
    values = vault_store.secret_values(store)
    assert "p" * 16 in values
    assert "GEZDGNBVGY3TQOJQ" in values
    assert "person@example.com" not in values
