"""CLI behavior: verbs, machine-readable failures, argv/inbox hygiene."""

import json
import os

import pytest

pytest.importorskip("cryptography")

import cli
import vault_store

KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
SECRET = "sk-cli-test-value-1234567890"


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    monkeypatch.setenv("AIR_VAULT_KEY", KEY)
    return tmp_path


def run(capsys, *argv):
    code = cli.main(list(argv))
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def write_inbox(home, payload) -> str:
    inbox = vault_store.inbox_dir(home)
    inbox.mkdir(parents=True, exist_ok=True)
    path = inbox / "test-nonce.json"
    path.write_text(json.dumps(payload))
    return str(path)


def create_item(home, capsys, **extra):
    item = {"kind": "api_key", "name": "Test", "fields": {"value": SECRET}}
    item.update(extra)
    path = write_inbox(home, {"version": 1, "operations": [
        {"op": "create", "item": item},
    ]})
    code, out, err = run(capsys, "apply", path)
    assert code == 0, err
    return json.loads(out)["results"][0]["id"]


def test_list_empty_store(home, capsys):
    code, out, _ = run(capsys, "list", "--masked")
    assert code == 0
    assert json.loads(out) == {"version": 1, "items": []}


def test_apply_then_list_masked_never_shows_values(home, capsys):
    create_item(home, capsys, env_var="CLI_TEST_VAR")
    code, out, _ = run(capsys, "list", "--masked")
    assert code == 0
    assert SECRET not in out
    [item] = json.loads(out)["items"]
    assert item["env_var"] == "CLI_TEST_VAR"
    assert item["masked"] == "sk-\u20267890"


def test_apply_shreds_inbox_file(home, capsys):
    inbox = vault_store.inbox_dir(home)
    inbox.mkdir(parents=True, exist_ok=True)
    path = inbox / "nonce.json"
    path.write_text(json.dumps({"version": 1, "operations": []}))
    code, _, _ = run(capsys, "apply", str(path))
    assert code == 0
    assert not path.exists()


def test_apply_shreds_inbox_even_on_failure(home, capsys):
    path = write_inbox(home, {"version": 1, "operations": [{"op": "bogus"}]})
    code, _, err = run(capsys, "apply", path)
    assert code == 1
    assert json.loads(err)["error"] == "bad_payload"
    assert not os.path.exists(path)


def test_failed_apply_writes_nothing(home, capsys):
    path = write_inbox(home, {"version": 1, "operations": [
        {"op": "create", "item": {"kind": "api_key", "name": "ok",
                                  "fields": {"value": SECRET}}},
        {"op": "bogus"},
    ]})
    code, _, _ = run(capsys, "apply", path)
    assert code == 1
    code, out, _ = run(capsys, "list", "--masked")
    assert code == 0 and json.loads(out)["items"] == []


def test_get_requires_reveal(home, capsys):
    item_id = create_item(home, capsys)
    code, out, err = run(capsys, "get", item_id, "--field", "value")
    assert code == 1 and SECRET not in out
    assert json.loads(err)["error"] == "reveal_required"


def test_get_reveal_prints_exactly_one_value(home, capsys):
    item_id = create_item(home, capsys)
    code, out, _ = run(capsys, "get", item_id, "--field", "value", "--reveal")
    assert code == 0 and out == SECRET


def test_get_unknown_field_and_item(home, capsys):
    item_id = create_item(home, capsys)
    code, _, err = run(capsys, "get", item_id, "--field", "nope", "--reveal")
    assert code == 1 and json.loads(err)["error"] == "field_not_found"
    code, _, err = run(capsys, "get", "no-such-id", "--field", "value", "--reveal")
    assert code == 1 and json.loads(err)["error"] == "item_not_found"


def test_totp(home, capsys):
    item_id = create_item(home, capsys, totp_seed="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
    code, out, _ = run(capsys, "totp", item_id)
    assert code == 0 and len(out) == 6 and out.isdigit()


def test_totp_without_seed(home, capsys):
    item_id = create_item(home, capsys)
    code, _, err = run(capsys, "totp", item_id)
    assert code == 1 and json.loads(err)["error"] == "no_totp"


def test_apply_shreds_inbox_when_key_missing(home, capsys, monkeypatch):
    path = write_inbox(home, {"version": 1, "operations": [
        {"op": "create", "item": {"kind": "api_key", "name": "x",
                                  "fields": {"value": SECRET}}},
    ]})
    monkeypatch.delenv("AIR_VAULT_KEY")
    code, _, err = run(capsys, "apply", path)
    assert code == 1 and json.loads(err)["error"] == "key_missing"
    assert not os.path.exists(path)


def test_unexpected_exception_is_machine_readable(home, capsys, monkeypatch):
    def boom(args):
        raise RuntimeError("boom")

    monkeypatch.setattr(cli, "cmd_list", boom)
    code, out, err = run(capsys, "list", "--masked")
    assert code == 1 and out == ""
    assert "Traceback" not in err
    lines = [line for line in err.splitlines() if line]
    assert len(lines) == 1
    assert json.loads(lines[0])["error"] == "internal"


def test_missing_key_is_machine_readable(home, capsys, monkeypatch):
    monkeypatch.delenv("AIR_VAULT_KEY")
    code, _, err = run(capsys, "list", "--masked")
    assert code == 1 and json.loads(err)["error"] == "key_missing"


def test_corrupt_store_is_machine_readable(home, capsys):
    path = vault_store.store_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("not-an-envelope")
    code, _, err = run(capsys, "list", "--masked")
    assert code == 1 and json.loads(err)["error"] == "store_corrupt"
