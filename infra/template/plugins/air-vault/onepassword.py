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

# References address vault and item by their opaque 1Password ids (26
# lowercase base32 characters), never by name: two logins can share a title
# in one vault, but never an id, so ids keep the grant deterministic. `op
# read` accepts id-form references directly. The field may be a section path
# ("section/label").
_OP_ID = r"[a-z0-9]{26}"
_OP_ID_RE = re.compile(rf"^{_OP_ID}$")
_REF_RE = re.compile(rf"^op://({_OP_ID})/({_OP_ID})/([^\s](?:.*[^\s])?)$")


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
    """Split an ``op://<vault-id>/<item-id>/<field>`` reference.

    Name-form references are refused: take the ``ref_prefix`` from
    ``air-vault op-list`` and append the field.
    """
    match = _REF_RE.match((ref or "").strip())
    if not match:
        raise VaultError(
            "bad_op_ref",
            'reference must look like "op://<vault-id>/<item-id>/<field>" — '
            "use the ref_prefix from `air-vault op-list`",
        )
    return match.group(1), match.group(2), match.group(3)


def grant_key(item_id: str) -> str:
    """Stable site-grant key for a 1Password item: ``op:<item-id>``.

    Keyed on the opaque item id — not the mutable vault/title strings — so
    duplicate titles stay distinct and renames don't orphan a grant. The
    same key is written by the control plane's grant surface, so a
    1Password login is allowlisted per host exactly like a local item.
    """
    return f"op:{item_id}"


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
        item_id = entry.get("id")
        title = entry.get("title")
        vault = entry.get("vault") if isinstance(entry.get("vault"), dict) else {}
        vault_id = vault.get("id")
        vault_name = vault.get("name")
        if not isinstance(item_id, str) or not _OP_ID_RE.match(item_id):
            continue
        if not isinstance(vault_id, str) or not _OP_ID_RE.match(vault_id):
            continue
        if not isinstance(title, str) or not isinstance(vault_name, str):
            continue
        # Vault/title are display labels only; identity is the item id.
        items.append({
            "id": item_id,
            "vault": vault_name,
            "item": title,
            "grant_key": grant_key(item_id),
            "ref_prefix": f"op://{vault_id}/{item_id}",
        })
    return sorted(items, key=lambda entry: entry["grant_key"])


def read_value(ref: str, token: str) -> str:
    """Resolve ONE field with ``op read``. The value is returned, never
    printed, and ``op``'s own output never reaches the error message."""
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
        # `op`'s stderr is never relayed: it can echo the reference and other
        # account detail into logs and transcripts (C18).
        raise VaultError(
            "op_read_failed",
            "1Password refused the read — check the reference and the service "
            "account's vault access",
        )
    value = result.stdout
    if not value:
        raise VaultError("op_field_empty", "1Password returned no value")
    return value
