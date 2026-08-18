"""`air-vault type` / `totp --type` — the V5 fill path (C19/C20/C22).

The CDP transport is faked at the browser_fill seam; test_browser_fill.py
exercises the real websocket framing against a local fake CDP server.
"""

import json

import pytest

pytest.importorskip("cryptography")

import browser_fill
import cli
import vault_store

KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
PASSWORD = "hunter2-super-secret-password"
SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    monkeypatch.setenv("AIR_VAULT_KEY", KEY)
    return tmp_path


def run(capsys, *argv):
    code = cli.main(list(argv))
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def create_item(home, capsys, kind="login", fields=None, **extra):
    item = {
        "kind": kind,
        "name": "Test",
        "fields": fields or {"username": "me", "password": PASSWORD},
    }
    item.update(extra)
    inbox = vault_store.inbox_dir(home)
    inbox.mkdir(parents=True, exist_ok=True)
    path = inbox / "nonce.json"
    path.write_text(json.dumps({"version": 1, "operations": [
        {"op": "create", "item": item},
    ]}))
    code, out, err = run(capsys, "apply", str(path))
    assert code == 0, err
    return json.loads(out)["results"][0]["id"]


def grant(home, item_id, hosts):
    vault_dir = home / "vault"
    vault_dir.mkdir(parents=True, exist_ok=True)
    (vault_dir / "site_grants.json").write_text(
        json.dumps({"version": 1, "grants": {item_id: hosts}})
    )


@pytest.fixture
def fake_browser(monkeypatch):
    """Stub the CDP transport: record what would be typed, control the URL."""
    state = {"url": "https://www.grubhub.com/login", "typed": []}

    def list_targets(port):
        return [
            {"type": "page", "url": "chrome://newtab/"},
            {"type": "page", "url": state["url"],
             "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/1"},
        ]

    monkeypatch.setattr(browser_fill, "list_targets", list_targets)
    monkeypatch.setattr(
        browser_fill, "insert_text",
        lambda target, text: state["typed"].append(text),
    )
    return state


def test_type_fills_granted_site_and_never_prints_value(
    home, capsys, fake_browser
):
    item_id = create_item(home, capsys)
    grant(home, item_id, ["grubhub.com"])
    code, out, err = run(capsys, "type", item_id, "--field", "password")
    assert code == 0, err
    # C19: the only output is the value-free receipt line.
    assert out == f"typed {item_id}/password into grubhub.com\n"
    assert PASSWORD not in out and PASSWORD not in err
    assert fake_browser["typed"] == [PASSWORD]


def test_type_grant_covers_subdomains(home, capsys, fake_browser):
    item_id = create_item(home, capsys)
    grant(home, item_id, ["grubhub.com"])
    fake_browser["url"] = "https://accounts.grubhub.com/sso"
    code, out, _ = run(capsys, "type", item_id, "--field", "password")
    assert code == 0
    assert "into accounts.grubhub.com" in out


def test_type_refuses_ungranted_host(home, capsys, fake_browser):
    # The refusal is the CLI's, not the model's (C19 guard is code).
    item_id = create_item(home, capsys)
    grant(home, item_id, ["grubhub.com"])
    fake_browser["url"] = "https://evil.example/login"
    code, out, err = run(capsys, "type", item_id, "--field", "password")
    assert code == 1
    assert json.loads(err)["error"] == "site_not_granted"
    assert fake_browser["typed"] == []
    assert PASSWORD not in out and PASSWORD not in err


def test_type_refuses_when_no_grants_file(home, capsys, fake_browser):
    item_id = create_item(home, capsys)
    code, _, err = run(capsys, "type", item_id, "--field", "password")
    assert code == 1
    assert json.loads(err)["error"] == "site_not_granted"
    assert fake_browser["typed"] == []


def test_type_refuses_card_fields_without_ticket(home, capsys, fake_browser):
    # C20 seam: card fills are refuse-always until V6 mints fill tickets.
    card_number = "4242424242424242"
    item_id = create_item(
        home, capsys, kind="card",
        fields={"number": card_number, "cvv": "123"},
    )
    grant(home, item_id, ["amazon.com"])
    fake_browser["url"] = "https://www.amazon.com/checkout"
    code, out, err = run(capsys, "type", item_id, "--field", "number")
    assert code == 1
    assert json.loads(err)["error"] == "fill_ticket_required"
    assert fake_browser["typed"] == []
    assert card_number not in out and card_number not in err


def test_type_unknown_field(home, capsys, fake_browser):
    item_id = create_item(home, capsys)
    code, _, err = run(capsys, "type", item_id, "--field", "nope")
    assert code == 1
    assert json.loads(err)["error"] == "field_not_found"


def test_totp_type_delivers_code_not_stdout(home, capsys, fake_browser):
    item_id = create_item(home, capsys, totp_seed=SEED)
    grant(home, item_id, ["grubhub.com"])
    code, out, err = run(capsys, "totp", item_id, "--type")
    assert code == 0, err
    assert out == f"typed {item_id}/totp into grubhub.com\n"
    [typed] = fake_browser["typed"]
    assert len(typed) == 6 and typed.isdigit()
    assert typed not in out


def test_totp_type_respects_grants(home, capsys, fake_browser):
    item_id = create_item(home, capsys, totp_seed=SEED)
    fake_browser["url"] = "https://evil.example/2fa"
    code, _, err = run(capsys, "totp", item_id, "--type")
    assert code == 1
    assert json.loads(err)["error"] == "site_not_granted"
    assert fake_browser["typed"] == []


def test_type_browser_unreachable_is_machine_readable(
    home, capsys, monkeypatch
):
    item_id = create_item(home, capsys)
    grant(home, item_id, ["grubhub.com"])

    def unreachable(port):
        raise vault_store.VaultError(
            "browser_unreachable", "debug endpoint not reachable"
        )

    monkeypatch.setattr(browser_fill, "list_targets", unreachable)
    code, out, err = run(capsys, "type", item_id, "--field", "password")
    assert code == 1
    assert json.loads(err)["error"] == "browser_unreachable"
    assert PASSWORD not in out and PASSWORD not in err
