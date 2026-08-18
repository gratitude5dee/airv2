"""air-vault — CLI over the encrypted box-local vault store.

Driven by the control plane through Box commands (and usable by the owner in
a box shell). Secret values NEVER travel in argv — Box command history is
logged (C18/C19):

* ``air-vault list --masked``           metadata + masked tails, no values
* ``air-vault apply <inbox-file>``      create/update/delete batch from a JSON
                                        payload the control plane wrote to
                                        ``~/.hermes/vault/.inbox/<nonce>.json``;
                                        the inbox file is shredded afterwards
* ``air-vault get <id> --field <f> --reveal``   one value, owner-reveal only
* ``air-vault totp <id>``               current TOTP code
* ``air-vault type <id> --field <f>``   fill the focused browser field (wired
                                        in V5 — exits machine-readably until then)

Apply payload shape::

    {"version": 1, "operations": [
        {"op": "create", "item": {"kind": "...", "name": "...",
                                  "fields": {...}, "env_var"?, "totp_seed"?}},
        {"op": "update", "id": "...", "item": {...partial, null deletes a key}},
        {"op": "delete", "id": "..."}
    ]}

Every failure exits non-zero with one machine-readable JSON line on stderr:
``{"error": "<code>", "message": "..."}``.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import vault_store
else:
    from . import vault_store

VaultError = vault_store.VaultError


def _home_path() -> Path:
    return Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes")


def _key() -> str:
    key = (os.environ.get("AIR_VAULT_KEY") or "").strip()
    if not key:
        raise VaultError("key_missing", "AIR_VAULT_KEY is not set")
    return key


def _load(home: Path, key: str) -> dict:
    return vault_store.load_store(vault_store.store_path(home), key)


def _find(store: dict, item_id: str) -> dict:
    for item in store.get("items", []):
        if item.get("id") == item_id:
            return item
    raise VaultError("item_not_found", f"no item with id {item_id!r}")


def cmd_list(args: argparse.Namespace) -> int:
    key = _key()
    home = _home_path()
    path = vault_store.store_path(home)
    if not path.is_file():
        print(json.dumps({"version": vault_store.STORE_VERSION, "items": []}))
        return 0
    store = _load(home, key)
    items = [vault_store.item_metadata(item) for item in store.get("items", [])]
    print(json.dumps({"version": store.get("version"), "items": items}))
    return 0


def cmd_apply(args: argparse.Namespace) -> int:
    # The inbox file holds plaintext values; every exit path — including a
    # missing/invalid key — must shred it (C18).
    inbox_file = Path(args.inbox_file)
    try:
        key = _key()
        home = _home_path()
        try:
            payload = json.loads(inbox_file.read_text(encoding="utf-8"))
        except OSError:
            raise VaultError("inbox_missing", f"cannot read {inbox_file}")
        except ValueError:
            raise VaultError("bad_payload", "inbox file is not valid JSON")
        operations = payload.get("operations") if isinstance(payload, dict) else None
        if not isinstance(operations, list):
            raise VaultError("bad_payload", "payload.operations must be a list")
        path = vault_store.store_path(home)
        store = _load(home, key) if path.is_file() else vault_store.empty_store()
        working = copy.deepcopy(store)
        results = vault_store.apply_operations(working, operations)
        vault_store.save_store(path, working, key)
    finally:
        vault_store.shred_file(inbox_file)
    print(json.dumps({"ok": True, "results": results}))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    if not args.reveal:
        raise VaultError("reveal_required", "pass --reveal to print a value")
    store = _load(_home_path(), _key())
    item = _find(store, args.id)
    value = (item.get("fields") or {}).get(args.field)
    if not isinstance(value, str):
        raise VaultError("field_not_found",
                         f"item has no field {args.field!r}")
    sys.stdout.write(value)
    return 0


def cmd_totp(args: argparse.Namespace) -> int:
    store = _load(_home_path(), _key())
    item = _find(store, args.id)
    seed = item.get("totp_seed")
    if not isinstance(seed, str) or not seed:
        raise VaultError("no_totp", "item has no TOTP seed")
    sys.stdout.write(vault_store.totp_code(seed))
    return 0


def cmd_type(args: argparse.Namespace) -> int:
    # V5 wires CDP/keystroke injection so the value bypasses the model
    # transcript entirely (C19). Until then this verb must not silently
    # fall back to printing the value.
    store = _load(_home_path(), _key())
    item = _find(store, args.id)
    if not isinstance((item.get("fields") or {}).get(args.field), str):
        raise VaultError("field_not_found", f"item has no field {args.field!r}")
    raise VaultError(
        "type_not_available",
        "browser fill is not wired yet (V5); use the reveal UI instead",
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="air-vault")
    sub = parser.add_subparsers(dest="verb", required=True)

    p_list = sub.add_parser("list")
    p_list.add_argument("--masked", action="store_true", required=True)
    p_list.set_defaults(func=cmd_list)

    p_apply = sub.add_parser("apply")
    p_apply.add_argument("inbox_file")
    p_apply.set_defaults(func=cmd_apply)

    p_get = sub.add_parser("get")
    p_get.add_argument("id")
    p_get.add_argument("--field", required=True)
    p_get.add_argument("--reveal", action="store_true")
    p_get.set_defaults(func=cmd_get)

    p_totp = sub.add_parser("totp")
    p_totp.add_argument("id")
    p_totp.set_defaults(func=cmd_totp)

    p_type = sub.add_parser("type")
    p_type.add_argument("id")
    p_type.add_argument("--field", required=True)
    p_type.set_defaults(func=cmd_type)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except VaultError as exc:
        sys.stderr.write(exc.to_json() + "\n")
        return 1
    except Exception as exc:  # noqa: BLE001 — the contract is one JSON line
        sys.stderr.write(
            VaultError("internal", f"unexpected failure: {exc}").to_json() + "\n"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
