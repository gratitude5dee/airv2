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
* ``air-vault totp <id> [--type]``      current TOTP code (``--type`` delivers
                                        it into the focused browser field
                                        instead of printing it)
* ``air-vault type <id> --field <f>``   fill the focused browser field via CDP
                                        (V5); prints only
                                        ``typed <item>/<field> into <host>``
* ``air-vault op-list``                 names/vaults of the owner's 1Password
                                        logins — never a value
* ``air-vault op-fill --ref op://v/i/f``  same fill, resolved from the owner's
                                        1Password account — only when they
                                        connected one (opt-in)

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
    import browser_fill
    import fill_ticket
    import onepassword
    import vault_store
else:
    from . import browser_fill
    from . import fill_ticket
    from . import onepassword
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
    code = vault_store.totp_code(seed)
    if args.type_into_browser:
        host = _deliver_to_browser(args.id, code)
        print(f"typed {args.id}/totp into {host}")
        return 0
    sys.stdout.write(code)
    return 0


def _site_grants(home: Path) -> dict:
    """Owner-written per-site allowlist: {item_id: [host, ...]} under a
    versioned envelope. Missing/corrupt file means no grants (default off)."""
    path = home / "vault" / "site_grants.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    grants = payload.get("grants") if isinstance(payload, dict) else None
    return grants if isinstance(grants, dict) else {}


def _granted_target(grant_key: str):
    """CLI-enforced guards (C19/C22 are code, not prompt): the frontmost
    page's host must be granted for this item in site_grants.json before any
    value crosses into the browser. Returns (target, host)."""
    port = browser_fill.debug_port()
    target = browser_fill.frontmost_page(browser_fill.list_targets(port))
    host = browser_fill.page_host(target)
    grants = _site_grants(_home_path())
    if not browser_fill.host_granted(host, grants.get(grant_key)):
        raise VaultError(
            "site_not_granted",
            f"{host} is not granted for this item — flip 'Allow agent "
            "sign-in' for it in the Browser tab's Site access panel",
        )
    return target, host


def _deliver_to_browser(item_id: str, value: str) -> str:
    """Type a resolved value into the granted frontmost page; returns the
    host typed into."""
    target, host = _granted_target(item_id)
    browser_fill.insert_text(target, value)
    return host


def _deliver_card_field(home: Path, item_id: str, field: str, value: str) -> str:
    """V6 (C20): card fields require-and-burn the owner-approved fill
    ticket. The ticket — not site_grants — binds the host: it names the one
    site the owner approved. Guards, in order: live unexpired ticket for
    this item; field is a card group not yet typed (CVV strictly last);
    frontmost page host matches the ticket host. The ticket loads BEFORE
    the browser is touched and the host checks BEFORE the value crosses
    (I5/C9: a hostile page on another host gets a refusal, nothing typed).
    CVV burns the ticket; nothing is cached anywhere."""
    ticket = fill_ticket.load_ticket(home, item_id)
    group = fill_ticket.check_field(ticket, field)
    port = browser_fill.debug_port()
    target = browser_fill.frontmost_page(browser_fill.list_targets(port))
    host = browser_fill.page_host(target)
    fill_ticket.check_host(ticket, host)
    browser_fill.insert_text(target, fill_ticket.dry_run_value(ticket, field, host, value))
    fill_ticket.record_typed(home, item_id, ticket, group)
    return host


def cmd_type(args: argparse.Namespace) -> int:
    # V5: the value resolves in-process and crosses to the browser over CDP —
    # it never touches stdout, argv, run events, or the model transcript
    # (C19). Every guard here is code, not prompt.
    home = _home_path()
    store = _load(home, _key())
    item = _find(store, args.id)
    value = (item.get("fields") or {}).get(args.field)
    if not isinstance(value, str) or not value:
        raise VaultError("field_not_found", f"item has no field {args.field!r}")
    if item.get("kind") == "card":
        host = _deliver_card_field(home, args.id, args.field, value)
    else:
        host = _deliver_to_browser(args.id, value)
    print(f"typed {args.id}/{args.field} into {host}")
    return 0


def cmd_op_list(args: argparse.Namespace) -> int:
    # Names, vaults and reference prefixes only — `op item list` carries no
    # field values, and none are resolved here.
    token = onepassword.require_connected()
    print(json.dumps({"items": onepassword.list_logins(token)}))
    return 0


def cmd_op_fill(args: argparse.Namespace) -> int:
    # Opt-in guard first: with no OP_SERVICE_ACCOUNT_TOKEN in the box env the
    # owner never connected 1Password, and `op` is never spawned. The host
    # gate then runs BEFORE the value is resolved, so an ungranted page never
    # causes a read (same order of guards as the card path).
    token = onepassword.require_connected()
    vault_name, item_name, _field = onepassword.parse_ref(args.ref)
    target, host = _granted_target(onepassword.grant_key(vault_name, item_name))
    value = onepassword.read_value(args.ref, token)
    browser_fill.insert_text(target, value)
    print(f"typed {args.ref} into {host}")
    return 0


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
    p_totp.add_argument("--type", action="store_true", dest="type_into_browser")
    p_totp.set_defaults(func=cmd_totp)

    p_type = sub.add_parser("type")
    p_type.add_argument("id")
    p_type.add_argument("--field", required=True)
    p_type.set_defaults(func=cmd_type)

    p_op_list = sub.add_parser("op-list")
    p_op_list.set_defaults(func=cmd_op_list)

    p_op = sub.add_parser("op-fill")
    p_op.add_argument("--ref", required=True)
    p_op.set_defaults(func=cmd_op_fill)

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
