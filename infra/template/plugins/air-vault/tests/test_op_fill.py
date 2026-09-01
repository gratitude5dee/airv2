"""`air-vault op-fill` — the opt-in 1Password fill path.

Two properties matter here. First, opt-in: with no OP_SERVICE_ACCOUNT_TOKEN
(the state of every box whose owner never connected 1Password) the command
refuses before it can spawn `op`. Second, the value crosses only through the
same audited CDP transport, under the same per-site grant, and never reaches
stdout/stderr.
"""

import json
import subprocess

import pytest

pytest.importorskip("cryptography")

import browser_fill
import cli
import onepassword

SECRET = "op-hunter2-never-printed"
REF = "op://Private/GitHub/password"
GRANT_KEY = "op:Private/GitHub"


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    monkeypatch.delenv(onepassword.TOKEN_ENV, raising=False)
    return tmp_path


def run(capsys, *argv):
    code = cli.main(list(argv))
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def grant(home, key, hosts):
    vault_dir = home / "vault"
    vault_dir.mkdir(parents=True, exist_ok=True)
    (vault_dir / "site_grants.json").write_text(
        json.dumps({"version": 1, "grants": {key: hosts}})
    )


@pytest.fixture
def connected(monkeypatch):
    monkeypatch.setenv(onepassword.TOKEN_ENV, "ops_service_account_token")


@pytest.fixture
def fake_browser(monkeypatch):
    state = {"url": "https://github.com/login", "typed": []}

    def list_targets(port):
        return [
            {"type": "page", "url": state["url"],
             "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/1"},
        ]

    monkeypatch.setattr(browser_fill, "list_targets", list_targets)
    monkeypatch.setattr(
        browser_fill, "insert_text",
        lambda target, text: state["typed"].append(text),
    )
    return state


@pytest.fixture
def fake_op(monkeypatch):
    """Stub `op read`, recording argv and the env it was handed."""
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append({"cmd": cmd, "env": kwargs.get("env") or {}})
        return subprocess.CompletedProcess(cmd, 0, SECRET, "")

    monkeypatch.setattr(onepassword.subprocess, "run", fake_run)
    return calls


def test_op_fill_refuses_when_not_connected(home, capsys, fake_op, fake_browser):
    # The opt-in guard: no token means the owner never connected 1Password,
    # so nothing runs — not the browser lookup, not `op`.
    code, out, err = run(capsys, "op-fill", "--ref", REF)
    assert code == 1
    payload = json.loads(err)
    assert payload["error"] == "op_not_connected"
    assert "1Password not connected" in payload["message"]
    assert fake_op == []
    assert fake_browser["typed"] == []
    assert out == ""


def test_op_fill_refuses_ungranted_host(
    home, capsys, connected, fake_op, fake_browser
):
    grant(home, GRANT_KEY, ["github.com"])
    fake_browser["url"] = "https://evil.example/login"
    code, out, err = run(capsys, "op-fill", "--ref", REF)
    assert code == 1
    assert json.loads(err)["error"] == "site_not_granted"
    # The host gate runs before resolution: an ungranted page never even
    # causes a 1Password read.
    assert fake_op == []
    assert fake_browser["typed"] == []
    assert SECRET not in out and SECRET not in err


def test_op_fill_refuses_without_grants_file(
    home, capsys, connected, fake_op, fake_browser
):
    code, _, err = run(capsys, "op-fill", "--ref", REF)
    assert code == 1
    assert json.loads(err)["error"] == "site_not_granted"
    assert fake_op == []


def test_op_fill_types_into_granted_host_without_printing_value(
    home, capsys, connected, fake_op, fake_browser
):
    grant(home, GRANT_KEY, ["github.com"])
    code, out, err = run(capsys, "op-fill", "--ref", REF)
    assert code == 0, err
    assert out == f"typed {REF} into github.com\n"
    assert SECRET not in out and SECRET not in err
    assert fake_browser["typed"] == [SECRET]
    # The token travels in the child env, never in argv.
    [call] = fake_op
    assert call["cmd"] == ["op", "read", "--no-newline", REF]
    assert call["env"][onepassword.TOKEN_ENV] == "ops_service_account_token"
    assert not any("ops_service_account_token" in part for part in call["cmd"])


def test_op_fill_grant_covers_subdomains(
    home, capsys, connected, fake_op, fake_browser
):
    grant(home, GRANT_KEY, ["github.com"])
    fake_browser["url"] = "https://gist.github.com/auth"
    code, out, _ = run(capsys, "op-fill", "--ref", REF)
    assert code == 0
    assert "into gist.github.com" in out


def test_op_fill_rejects_malformed_ref(
    home, capsys, connected, fake_op, fake_browser
):
    for bad in ["github.com", "op://Private/GitHub", "op:///GitHub/password"]:
        code, _, err = run(capsys, "op-fill", "--ref", bad)
        assert code == 1, bad
        assert json.loads(err)["error"] == "bad_op_ref", bad
    assert fake_op == []


def test_op_fill_surfaces_op_failure_without_leaking(
    home, capsys, connected, fake_browser, monkeypatch
):
    def failing(cmd, **kwargs):
        return subprocess.CompletedProcess(cmd, 1, "", "[ERROR] item not found")

    monkeypatch.setattr(onepassword.subprocess, "run", failing)
    grant(home, GRANT_KEY, ["github.com"])
    code, out, err = run(capsys, "op-fill", "--ref", REF)
    assert code == 1
    assert json.loads(err)["error"] == "op_read_failed"
    assert fake_browser["typed"] == []
    assert SECRET not in out and SECRET not in err


def test_grant_key_is_stable_and_field_independent():
    vault, item, field = onepassword.parse_ref("op://Private/GitHub/username")
    assert (vault, item, field) == ("Private", "GitHub", "username")
    assert onepassword.grant_key(vault, item) == GRANT_KEY
    assert onepassword.grant_key(
        *onepassword.parse_ref("op://Private/GitHub/password")[:2]
    ) == GRANT_KEY


def test_op_list_returns_names_only_and_needs_the_opt_in(
    home, capsys, monkeypatch
):
    code, out, err = run(capsys, "op-list")
    assert code == 1 and json.loads(err)["error"] == "op_not_connected"
    assert out == ""

    monkeypatch.setenv(onepassword.TOKEN_ENV, "ops_service_account_token")
    listing = json.dumps([
        {"id": "abc", "title": "GitHub", "vault": {"name": "Private"}},
        {"id": "def", "title": "Bank / Joint", "vault": {"name": "Private"}},
    ])
    monkeypatch.setattr(
        onepassword.subprocess, "run",
        lambda cmd, **kw: subprocess.CompletedProcess(cmd, 0, listing, ""),
    )
    code, out, err = run(capsys, "op-list")
    assert code == 0
    assert json.loads(out) == {"items": [{
        "vault": "Private", "item": "GitHub",
        "grant_key": GRANT_KEY, "ref_prefix": "op://Private/GitHub",
    }]}
