"""V6 fill tickets, box side (C20).

The control plane mints a single-use, HMAC-signed ticket ONLY when the
owner approves a ``purchase_review`` decision, redeems its ``jti`` in the
shared ledger (the cryptographic single-use guarantee), and writes the
resulting claims file — mode 600 in a 700 directory — to
``~/.hermes/vault/.tickets/<item_id>.json``. This module is the CLI-side
enforcer: card-kind fields refuse to type without a live ticket, the
frontmost page's host must match the ticket's host, each card field group
types at most once, CVV types last and burns (shreds) the ticket.

Ticket file shape::

    {"version": 1, "item_id": "...", "host": "shop.example",
     "amount_band": "$25–$100", "jti": "...", "exp": 1700000000,
     "dry_run_hosts": ["staging.example"], "typed": ["number"]}

``typed`` is this module's progress ledger — field GROUP names only, never
a value (C18). Dry-run (§8): when the per-box env ``SHOPPING_DRY_RUN=1``
is set and the page host is NOT in ``dry_run_hosts``, the real card value
is replaced with a test-card value before it crosses into the browser, so
staging forks can rehearse checkout without a chargeable number. Dry-run
never weakens the ticket, host, or approval gates.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from vault_store import VaultError, shred_file
else:
    from .vault_store import VaultError, shred_file

TICKET_VERSION = 1

#: card field → audit/burn group; the closed set a ticket can ever type.
FIELD_GROUPS = {
    "number": "number",
    "expiry_month": "expiry",
    "expiry_year": "expiry",
    "cvv": "cvv",
    "zip": "zip",
}

#: Substituted on dry-run: the standard Visa test card. CVV/expiry are the
#: usual sandbox companions; zip is the classic test zip.
DRY_RUN_VALUES = {
    "number": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "2030",
    "cvv": "123",
    "zip": "90210",
}


def ticket_path(home: Path, item_id: str) -> Path:
    return home / "vault" / ".tickets" / f"{item_id}.json"


def _read(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError:
        raise VaultError(
            "fill_ticket_required",
            "card fields need an approved fill ticket — ask the owner to "
            "approve the purchase review first",
        )
    except ValueError:
        shred_file(path)
        raise VaultError("fill_ticket_required", "fill ticket is corrupt — refused")
    if not isinstance(payload, dict) or payload.get("version") != TICKET_VERSION:
        shred_file(path)
        raise VaultError("fill_ticket_required", "fill ticket is malformed — refused")
    return payload


def load_ticket(home: Path, item_id: str) -> dict:
    """Load and validate the live ticket for this card item.

    Expired or malformed tickets are shredded on sight so a stale approval
    can never linger (exp ≤ 10 minutes from mint, enforced control-plane
    side too).
    """
    path = ticket_path(home, item_id)
    ticket = _read(path)
    exp = ticket.get("exp")
    if not isinstance(exp, (int, float)) or exp < time.time():
        shred_file(path)
        raise VaultError(
            "fill_ticket_required",
            "the fill ticket expired — ask the owner to approve again",
        )
    if ticket.get("item_id") != item_id:
        shred_file(path)
        raise VaultError("fill_ticket_required", "fill ticket is for another item")
    if not isinstance(ticket.get("host"), str) or not ticket["host"]:
        shred_file(path)
        raise VaultError("fill_ticket_required", "fill ticket has no host")
    if not isinstance(ticket.get("typed"), list):
        ticket["typed"] = []
    return ticket


def check_host(ticket: dict, page_host: str) -> None:
    """The frontmost page must be the ticket's site (I5/C9: a hostile page
    on any other host gets a refusal and nothing typed)."""
    bound = str(ticket["host"]).lower()
    if bound.startswith("www."):
        bound = bound[4:]
    if page_host == bound or page_host.endswith("." + bound):
        return
    raise VaultError(
        "host_mismatch",
        f"the fill ticket is for {bound} but the frontmost page is "
        f"{page_host} — nothing was typed",
    )


def check_field(ticket: dict, field: str) -> str:
    """Sequence guard: only known card field groups, each at most once,
    and CVV strictly last (after the number). Returns the group name."""
    group = FIELD_GROUPS.get(field)
    if group is None:
        raise VaultError(
            "field_not_allowed",
            f"{field!r} is not a card field a fill ticket can type",
        )
    typed = [g for g in ticket["typed"] if isinstance(g, str)]
    if group in typed and group != "expiry":
        raise VaultError(
            "fill_ticket_required",
            f"the ticket already typed {group} — single use",
        )
    if group == "cvv" and "number" not in typed:
        raise VaultError(
            "cvv_not_last",
            "CVV types last — fill the card number (and expiry) first",
        )
    if group != "cvv" and "cvv" in typed:
        raise VaultError(
            "fill_ticket_required",
            "the ticket is burned — CVV was already typed",
        )
    return group


def dry_run_value(ticket: dict, field: str, page_host: str, value: str) -> str:
    """§8 dry-run: with SHOPPING_DRY_RUN=1 in the box env, substitute the
    test card on any host not explicitly allowlisted for real values."""
    if os.environ.get("SHOPPING_DRY_RUN") != "1":
        return value
    allowed = ticket.get("dry_run_hosts")
    hosts = [
        h.strip().lower()[4:] if h.strip().lower().startswith("www.") else h.strip().lower()
        for h in (allowed if isinstance(allowed, list) else [])
        if isinstance(h, str)
    ]
    for host in hosts:
        if host and (page_host == host or page_host.endswith("." + host)):
            return value
    return DRY_RUN_VALUES.get(field, value)


def record_typed(home: Path, item_id: str, ticket: dict, group: str) -> None:
    """Advance the progress ledger; CVV burns the ticket file entirely."""
    path = ticket_path(home, item_id)
    if group == "cvv":
        shred_file(path)
        return
    typed = [g for g in ticket["typed"] if isinstance(g, str)]
    if group not in typed:
        typed.append(group)
    ticket["typed"] = typed
    path.write_text(json.dumps(ticket), encoding="utf-8")
    os.chmod(path, 0o600)
