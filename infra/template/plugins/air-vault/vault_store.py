"""AIR Vault store — box-local encrypted secret storage.

Envelope: ``v1:<iv hex>:<tag hex>:<ciphertext hex>`` — AES-256-GCM with a
12-byte random IV and a 32-byte key (64 hex chars), byte-for-byte compatible
with ``apps/web/lib/crypto/secretbox.ts`` (which the control plane uses for
its own sealed columns; the vault key itself never leaves the box).

Store file: ``~/.hermes/vault/store.enc`` (mode 600). Plaintext shape::

    {
      "version": 1,
      "items": [
        {
          "id": "...", "kind": "login|card|api_key|note|identity",
          "name": "...", "fields": {"...": "..."},
          "env_var": "...",          # optional — inject-as-env binding
          "totp_seed": "...",        # optional — base32 TOTP seed
          "created_at": "...", "updated_at": "..."
        }
      ]
    }

This module is deliberately standalone (stdlib + cryptography, which is a
Hermes core dependency) so the CLI and the secret source share one
implementation.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac as hmac_mod
import json
import os
import re
import struct
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

STORE_VERSION = 1
KINDS = ("login", "card", "api_key", "note", "identity")
ENV_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PROTECTED_ENV_VARS = frozenset({"AIR_VAULT_KEY"})

# Field names whose values are user-visible labels/handles, not secrets.
NON_SECRET_FIELDS = frozenset(
    {"username", "email", "site_url", "url", "label", "expiry_month", "expiry_year"}
)


class VaultError(Exception):
    """Machine-readable vault failure: ``code`` is stable, message is prose."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code

    def to_json(self) -> str:
        return json.dumps({"error": self.code, "message": str(self)})


def key_bytes(hex_key: str) -> bytes:
    try:
        key = bytes.fromhex((hex_key or "").strip())
    except ValueError:
        raise VaultError("key_invalid", "AIR_VAULT_KEY is not valid hex")
    if len(key) != 32:
        raise VaultError("key_invalid", "AIR_VAULT_KEY must be 32 bytes of hex")
    return key


def seal(plaintext: str, hex_key: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = key_bytes(hex_key)
    iv = os.urandom(12)
    sealed = AESGCM(key).encrypt(iv, plaintext.encode("utf-8"), None)
    data, tag = sealed[:-16], sealed[-16:]
    return f"v1:{iv.hex()}:{tag.hex()}:{data.hex()}"


def open_sealed(sealed: str, hex_key: str) -> str:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    parts = (sealed or "").strip().split(":")
    if len(parts) != 4 or parts[0] != "v1" or not all(parts[1:]):
        raise VaultError("store_corrupt", "unrecognized sealed envelope format")
    try:
        iv = bytes.fromhex(parts[1])
        tag = bytes.fromhex(parts[2])
        data = bytes.fromhex(parts[3])
    except ValueError:
        raise VaultError("store_corrupt", "sealed envelope is not valid hex")
    key = key_bytes(hex_key)
    try:
        return AESGCM(key).decrypt(iv, data + tag, None).decode("utf-8")
    except InvalidTag:
        raise VaultError(
            "store_locked", "store cannot be decrypted with AIR_VAULT_KEY"
        )


def store_path(home_path: Path) -> Path:
    return Path(home_path) / "vault" / "store.enc"


def inbox_dir(home_path: Path) -> Path:
    return Path(home_path) / "vault" / ".inbox"


def load_store(path: Path, hex_key: str) -> Dict[str, Any]:
    if not Path(path).is_file():
        raise VaultError("store_missing", f"no vault store at {path}")
    sealed = Path(path).read_text(encoding="utf-8")
    plaintext = open_sealed(sealed, hex_key)
    try:
        store = json.loads(plaintext)
    except (ValueError, TypeError):
        raise VaultError("store_corrupt", "decrypted store is not valid JSON")
    if not isinstance(store, dict) or not isinstance(store.get("items"), list):
        raise VaultError("store_corrupt", "decrypted store has an invalid shape")
    return store


def save_store(path: Path, store: Dict[str, Any], hex_key: str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.parent.chmod(0o700)
    except OSError:
        pass
    sealed = seal(json.dumps(store, separators=(",", ":")), hex_key)
    tmp = path.with_name(path.name + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(sealed)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
    os.chmod(path, 0o600)


def empty_store() -> Dict[str, Any]:
    return {"version": STORE_VERSION, "items": []}


def shred_file(path: Path) -> None:
    """Best-effort overwrite-then-unlink for inbox payload files."""
    path = Path(path)
    try:
        size = path.stat().st_size
        with open(path, "r+b") as fh:
            fh.write(b"\x00" * size)
            fh.flush()
            os.fsync(fh.fileno())
    except OSError:
        pass
    try:
        path.unlink()
    except OSError:
        pass


def is_valid_env_name(name: str) -> bool:
    """Parity with ``agent.secret_sources.base.is_valid_env_name``."""
    return bool(name) and bool(ENV_NAME_RE.match(name))


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def masked_for(item: Dict[str, Any]) -> Optional[str]:
    """Display tail only — never enough to reconstruct a value (C18)."""
    fields = item.get("fields") or {}
    kind = item.get("kind")
    if kind == "card":
        number = str(fields.get("number") or "")
        return f"\u2022\u2022\u2022\u2022 {number[-4:]}" if len(number) >= 4 else None
    if kind == "api_key":
        value = str(injection_value(item) or "")
        if len(value) >= 10:
            return f"{value[:3]}\u2026{value[-4:]}"
        return "\u2026" if value else None
    if kind == "login":
        username = str(fields.get("username") or "")
        return username or None
    return None


def injection_value(item: Dict[str, Any]) -> Optional[str]:
    """The value an ``env_var`` binding injects: first of value/key/password/token."""
    fields = item.get("fields") or {}
    for name in ("value", "key", "password", "token"):
        value = fields.get(name)
        if isinstance(value, str) and value:
            return value
    return None


def secret_values(store: Dict[str, Any]) -> List[str]:
    """Every value in the store that must never appear in logs/transcripts."""
    values: List[str] = []
    for item in store.get("items", []):
        fields = item.get("fields") or {}
        for name, value in fields.items():
            if name in NON_SECRET_FIELDS:
                continue
            if isinstance(value, str) and value:
                values.append(value)
        seed = item.get("totp_seed")
        if isinstance(seed, str) and seed:
            values.append(seed)
    return values


def item_metadata(item: Dict[str, Any]) -> Dict[str, Any]:
    """Metadata-only view (list output, apply report, Postgres mirror)."""
    return {
        "id": item.get("id"),
        "kind": item.get("kind"),
        "name": item.get("name"),
        "masked": masked_for(item),
        "env_var": item.get("env_var"),
        "totp_enabled": bool(item.get("totp_seed")),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def totp_code(seed: str, at: Optional[float] = None, digits: int = 6,
              period: int = 30) -> str:
    """RFC 6238 TOTP (SHA-1, 6 digits, 30s) from a base32 seed."""
    normalized = re.sub(r"[\s-]", "", seed or "").upper()
    normalized += "=" * (-len(normalized) % 8)
    try:
        key = base64.b32decode(normalized, casefold=True)
    except (binascii.Error, ValueError):
        raise VaultError("totp_seed_invalid", "TOTP seed is not valid base32")
    counter = int((time.time() if at is None else at) // period)
    digest = hmac_mod.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (int.from_bytes(digest[offset:offset + 4], "big") & 0x7FFFFFFF)
    return str(code % (10 ** digits)).zfill(digits)


def _validate_item_fields(item: Dict[str, Any]) -> None:
    fields = item.get("fields")
    if fields is not None and not isinstance(fields, dict):
        raise VaultError("bad_payload", "item.fields must be an object")
    for name, value in (fields or {}).items():
        if not isinstance(name, str) or value is not None and not isinstance(value, str):
            raise VaultError("bad_payload", "field values must be strings or null")


def _validate_env_var(env_var: Any, items: List[Dict[str, Any]],
                      own_id: str) -> None:
    if env_var is None:
        return
    if not isinstance(env_var, str) or not is_valid_env_name(env_var):
        raise VaultError("env_var_invalid", f"invalid env var name: {env_var!r}")
    if env_var in PROTECTED_ENV_VARS:
        raise VaultError(
            "env_var_protected", f"{env_var} is a protected bootstrap variable"
        )
    for other in items:
        if other.get("id") != own_id and other.get("env_var") == env_var:
            raise VaultError(
                "env_var_taken", f"{env_var} is already bound to another item"
            )


def apply_operations(store: Dict[str, Any],
                     operations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Apply a create/update/delete batch in place; returns per-op results.

    Raises ``VaultError`` on the first invalid operation (the batch is applied
    to an in-memory copy by the caller, so a failed batch writes nothing).
    """
    items: List[Dict[str, Any]] = store.setdefault("items", [])
    by_id = {item.get("id"): item for item in items}
    results: List[Dict[str, Any]] = []
    for op in operations:
        if not isinstance(op, dict):
            raise VaultError("bad_payload", "each operation must be an object")
        action = op.get("op")
        if action == "create":
            item = op.get("item")
            if not isinstance(item, dict):
                raise VaultError("bad_payload", "create requires item")
            if item.get("kind") not in KINDS:
                raise VaultError("bad_payload", f"invalid kind: {item.get('kind')!r}")
            if not isinstance(item.get("name"), str) or not item["name"]:
                raise VaultError("bad_payload", "create requires item.name")
            _validate_item_fields(item)
            item_id = str(item.get("id") or uuid.uuid4())
            if item_id in by_id:
                raise VaultError("bad_payload", f"duplicate item id: {item_id}")
            _validate_env_var(item.get("env_var"), items, item_id)
            record = {
                "id": item_id,
                "kind": item["kind"],
                "name": item["name"],
                "fields": {
                    k: v for k, v in (item.get("fields") or {}).items()
                    if v is not None
                },
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            if item.get("env_var"):
                record["env_var"] = item["env_var"]
            if item.get("totp_seed"):
                record["totp_seed"] = item["totp_seed"]
            items.append(record)
            by_id[item_id] = record
            results.append({"op": "create", "id": item_id, "status": "created",
                            "item": item_metadata(record)})
        elif action == "update":
            item_id = op.get("id")
            record = by_id.get(item_id)
            if record is None:
                raise VaultError("item_not_found", f"no item with id {item_id!r}")
            patch = op.get("item")
            if not isinstance(patch, dict):
                raise VaultError("bad_payload", "update requires item")
            _validate_item_fields(patch)
            if "env_var" in patch:
                _validate_env_var(patch["env_var"], items, item_id)
            if "kind" in patch and patch["kind"] not in KINDS:
                raise VaultError("bad_payload", f"invalid kind: {patch['kind']!r}")
            for key in ("kind", "name"):
                if isinstance(patch.get(key), str) and patch[key]:
                    record[key] = patch[key]
            if "fields" in patch:
                merged = dict(record.get("fields") or {})
                for name, value in (patch["fields"] or {}).items():
                    if value is None:
                        merged.pop(name, None)
                    else:
                        merged[name] = value
                record["fields"] = merged
            for key in ("env_var", "totp_seed"):
                if key in patch:
                    if patch[key] is None:
                        record.pop(key, None)
                    else:
                        record[key] = patch[key]
            record["updated_at"] = now_iso()
            results.append({"op": "update", "id": item_id, "status": "updated",
                            "item": item_metadata(record)})
        elif action == "delete":
            item_id = op.get("id")
            record = by_id.pop(item_id, None)
            if record is None:
                raise VaultError("item_not_found", f"no item with id {item_id!r}")
            items.remove(record)
            results.append({"op": "delete", "id": item_id, "status": "deleted"})
        else:
            raise VaultError("bad_payload", f"unknown op: {action!r}")
    return results
