"""1Password fill path for ``air-vault op-fill`` — strictly opt-in.

This module is inert unless the owner connected a 1Password account: the
control plane's ``enableManager(..., {manager: "onepassword"})`` is the only
thing that writes ``OP_SERVICE_ACCOUNT_TOKEN`` into the box ``.env``. With no
token, ``require_connected()`` raises before ``op`` is ever spawned, so a box
whose owner never opted in never invokes the CLI and never reads a
credential.

With a token, one field resolves in-process via ``op read``: the token
travels in the child's environment (never argv), the value is captured into a
variable and handed straight to the CDP transport, and nothing but the
reference and the host is ever printed (C18/C19).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from typing import Dict, Tuple

if __package__ in (None, ""):
    from vault_store import VaultError
else:
    from .vault_store import VaultError

TOKEN_ENV = "OP_SERVICE_ACCOUNT_TOKEN"
OP_BIN = "op"
_TIMEOUT = 30.0

# op://<vault>/<item>/<field> — field may be a section path ("section/label").
_REF_RE = re.compile(r"^op://([^/\s]+)/([^/\s]+)/([^\s]+)$")


def connected() -> bool:
    """True only when the owner connected 1Password (the opt-in gesture)."""
    return bool((os.environ.get(TOKEN_ENV) or "").strip())


def require_connected() -> str:
    if not connected():
        raise VaultError(
            "op_not_connected",
            "1Password not connected — connect it from the Vault tab "
            "(Bring your own manager) before using op-fill",
        )
    return (os.environ.get(TOKEN_ENV) or "").strip()


def parse_ref(ref: str) -> Tuple[str, str, str]:
    """Split an ``op://vault/item/field`` reference; anything else refuses."""
    match = _REF_RE.match((ref or "").strip())
    if not match:
        raise VaultError(
            "bad_op_ref",
            'reference must look like "op://<vault>/<item>/<field>"',
        )
    return match.group(1), match.group(2), match.group(3)


def grant_key(vault: str, item: str) -> str:
    """Stable site-grant key for a 1Password item: ``op:<vault>/<item>``.

    The same key is written by the control plane's grant surface, so a
    1Password login is allowlisted per host exactly like a local item.
    """
    return f"op:{vault}/{item}"


def _child_env(token: str) -> Dict[str, str]:
    env = dict(os.environ)
    env[TOKEN_ENV] = token
    # A service account never has a local desktop/session to fall back on.
    env.pop("OP_SESSION", None)
    return env


def list_logins(token: str) -> list:
    """Item titles, vaults and ids for the connected account's LOGIN items.
    ``op item list`` never returns field values."""
    try:
        result = subprocess.run(
            [OP_BIN, "item", "list", "--categories", "Login", "--format", "json"],
            capture_output=True,
            text=True,
            timeout=_TIMEOUT,
            env=_child_env(token),
            check=False,
        )
    except FileNotFoundError:
        raise VaultError("op_missing", "the 1Password CLI (op) is not installed")
    except subprocess.TimeoutExpired:
        raise VaultError("op_list_failed", "1Password timed out")
    if result.returncode != 0:
        raise VaultError("op_list_failed", "1Password refused the item list")
    try:
        payload = json.loads(result.stdout or "[]")
    except ValueError:
        raise VaultError("op_list_failed", "1Password returned unreadable JSON")
    if not isinstance(payload, list):
        return []
    items = []
    for entry in payload:
        if not isinstance(entry, dict):
            continue
        title = entry.get("title")
        vault = entry.get("vault")
        vault_name = vault.get("name") if isinstance(vault, dict) else None
        if not isinstance(title, str) or not isinstance(vault_name, str):
            continue
        if "/" in title or "/" in vault_name:
            continue  # not addressable as an unambiguous op:// reference
        items.append({
            "vault": vault_name,
            "item": title,
            "grant_key": grant_key(vault_name, title),
            "ref_prefix": f"op://{vault_name}/{title}",
        })
    return sorted(items, key=lambda entry: entry["grant_key"])


def read_value(ref: str, token: str) -> str:
    """Resolve ONE field with ``op read``. The value is returned, never
    printed; stderr is surfaced only as a short failure reason."""
    try:
        result = subprocess.run(
            [OP_BIN, "read", "--no-newline", ref],
            capture_output=True,
            text=True,
            timeout=_TIMEOUT,
            env=_child_env(token),
            check=False,
        )
    except FileNotFoundError:
        raise VaultError("op_missing", "the 1Password CLI (op) is not installed")
    except subprocess.TimeoutExpired:
        raise VaultError("op_read_failed", "1Password timed out")
    if result.returncode != 0:
        reason = (result.stderr or "").strip().splitlines()
        raise VaultError(
            "op_read_failed",
            f"1Password refused: {reason[-1][:200]}" if reason else
            "1Password refused the read",
        )
    value = result.stdout
    if not value:
        raise VaultError("op_field_empty", "1Password returned no value")
    return value
