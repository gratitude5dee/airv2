#!/usr/bin/env python3
"""[air] calendar-sync — the box-resident calendar pipeline (V3).

Pulls every configured source, parses raw ICS defensively (all inbound
calendar bytes are hostile input, I5), normalizes into the canonical event
shape, and atomically rewrites ~/.hermes/calendar/events.json. Event content
never leaves the box; the control plane only reads this file per-request.

Commands:
  pull            sync all sources + the inbox into events.json
  approve <ref>   confirm the pending inbox event materialized from <ref>
  dismiss <ref>   tombstone <ref> so re-syncs cannot resurrect it

Sources (~/.hermes/calendar/sources.json, mode 600):
  [{"id": "...", "provider": "apple_ics"|"calcom", "secret": "..."}]
  - apple_ics: secret is the private https ICS URL
  - calcom:    secret is the cal.com API key
Google Calendar events arrive via the Composio toolkit: the sync job prompt
asks the agent to write ~/.hermes/calendar/google.json (already normalized).
Email invites are raw .ics files in ~/.hermes/calendar/inbox/ (pending until
their calendar_add decision resolves).
"""

import hashlib
import ipaddress
import json
import os
import re
import socket
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

CAL_DIR = os.path.expanduser("~/.hermes/calendar")
EVENTS_PATH = os.path.join(CAL_DIR, "events.json")
SOURCES_PATH = os.path.join(CAL_DIR, "sources.json")
GOOGLE_PATH = os.path.join(CAL_DIR, "google.json")
INBOX_DIR = os.path.join(CAL_DIR, "inbox")

MAX_FETCH_BYTES = 1_000_000  # hostile input: hard cap on any fetched ICS
MAX_EVENTS_PER_SOURCE = 500
FETCH_TIMEOUT = 20
FIELD_MAX = 512

ALLOWED_SOURCES = ("google", "apple_ics", "calcom", "email")


def load_json(path, fallback):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return json.load(f)
    except (OSError, ValueError):
        return fallback


def atomic_write(path, payload):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".events-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, sort_keys=True)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def clean(value):
    """Sanitize a hostile text field: strings only, control chars out."""
    if not isinstance(value, str):
        return ""
    return re.sub(r"[\x00-\x1f\x7f]", " ", value)[:FIELD_MAX].strip()


# ── ICS parsing (defensive, stdlib-only) ─────────────────────────────────────

def unfold(text):
    return re.sub(r"\r?\n[ \t]", "", text)


def parse_ics_datetime(value, params):
    """RFC 5545 DATE / DATE-TIME → (iso8601, all_day). None when malformed."""
    value = value.strip()
    if re.fullmatch(r"\d{8}", value):
        try:
            dt = datetime.strptime(value, "%Y%m%d")
        except ValueError:
            return None
        return dt.strftime("%Y-%m-%d"), True
    match = re.fullmatch(r"(\d{8})T(\d{6})(Z?)", value)
    if not match:
        return None
    try:
        dt = datetime.strptime(match.group(1) + match.group(2), "%Y%m%d%H%M%S")
    except ValueError:
        return None
    if match.group(3) == "Z":
        return dt.replace(tzinfo=timezone.utc).isoformat(), False
    # Floating / TZID times are kept naive-local; TZID resolution is not
    # attempted from hostile input.
    return dt.isoformat(), False


def parse_ics(text, source, source_ref):
    """Extract normalized events from raw ICS text. Never raises."""
    events = []
    if not isinstance(text, str) or len(text) > MAX_FETCH_BYTES:
        return events
    for block in re.findall(
        r"BEGIN:VEVENT\r?\n(.*?)\r?\nEND:VEVENT", unfold(text), re.S
    )[:MAX_EVENTS_PER_SOURCE]:
        props = {}
        for line in block.splitlines():
            if ":" not in line:
                continue
            key, _, value = line.partition(":")
            name, _, params = key.partition(";")
            props.setdefault(name.upper(), (value, params))
        start = props.get("DTSTART")
        if not start:
            continue
        parsed_start = parse_ics_datetime(start[0], start[1])
        if not parsed_start:
            continue
        starts_at, all_day = parsed_start
        end = props.get("DTEND")
        ends_at = starts_at
        if end:
            parsed_end = parse_ics_datetime(end[0], end[1])
            if parsed_end:
                ends_at = parsed_end[0]
        uid = clean(props.get("UID", ("", ""))[0]) or hashlib.sha256(
            (starts_at + block[:200]).encode()
        ).hexdigest()[:16]
        attendees = len(re.findall(r"^ATTENDEE[;:]", block, re.M))
        events.append(
            {
                "id": f"{source}:{hashlib.sha256((source_ref + uid).encode()).hexdigest()[:16]}",
                "source": source,
                "source_ref": source_ref,
                "title": clean(props.get("SUMMARY", ("(no title)", ""))[0])
                or "(no title)",
                "starts_at": starts_at,
                "ends_at": ends_at,
                "all_day": all_day,
                "location": clean(props.get("LOCATION", ("", ""))[0]) or None,
                "attendees_count": attendees,
                "url": None,
                "status": "confirmed",
            }
        )
    return events


# ── Sources ──────────────────────────────────────────────────────────────────

def url_is_safe(url):
    """https only, and the host must not resolve to a private/internal address
    (SSRF guard: a source URL or a redirect must not reach link-local
    metadata services or the box's internal network)."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or 443)
    except OSError:
        return False
    for info in infos:
        try:
            address = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if not address.is_global:
            return False
    return True


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Re-validate every redirect target with url_is_safe."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not url_is_safe(newurl):
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, headers=None):
    """Bounded, SSRF-guarded https GET. Returns None on any failure."""
    if not url_is_safe(url):
        print("WARN fetch refused: unsafe url", file=sys.stderr)
        return None
    request = urllib.request.Request(url, headers=headers or {})
    opener = urllib.request.build_opener(_SafeRedirectHandler())
    try:
        with opener.open(request, timeout=FETCH_TIMEOUT) as response:
            return response.read(MAX_FETCH_BYTES + 1)[:MAX_FETCH_BYTES].decode(
                "utf-8", errors="replace"
            )
    except Exception as error:  # noqa: BLE001 — any fetch failure is non-fatal
        print(f"WARN fetch failed for source: {type(error).__name__}", file=sys.stderr)
        return None


def pull_apple(source):
    """Returns the source's events, or None when the fetch failed (so the
    caller keeps the previously synced events instead of blanking them)."""
    text = fetch(source["secret"])
    if text is None:
        return None
    return parse_ics(text, "apple_ics", source["id"])


def pull_calcom(source):
    # v2 API: the key travels in a header, never in the URL (query strings
    # end up in proxy/access logs).
    body = fetch(
        "https://api.cal.com/v2/bookings",
        headers={
            "Authorization": "Bearer " + source["secret"],
            "cal-api-version": "2024-08-13",
        },
    )
    if body is None:
        return None
    try:
        parsed = json.loads(body)
        bookings = parsed.get("data") or parsed.get("bookings") or []
        if not isinstance(bookings, list):
            bookings = []
    except ValueError:
        return []
    events = []
    for booking in bookings[:MAX_EVENTS_PER_SOURCE]:
        if not isinstance(booking, dict):
            continue
        starts = clean(str(booking.get("startTime", "")))
        if not starts:
            continue
        uid = clean(str(booking.get("uid") or booking.get("id") or starts))
        events.append(
            {
                "id": f"calcom:{hashlib.sha256((source['id'] + uid).encode()).hexdigest()[:16]}",
                "source": "calcom",
                "source_ref": source["id"],
                "title": clean(str(booking.get("title", ""))) or "(no title)",
                "starts_at": starts,
                "ends_at": clean(str(booking.get("endTime", ""))) or starts,
                "all_day": False,
                "location": clean(str(booking.get("location", ""))) or None,
                "attendees_count": len(booking.get("attendees") or []),
                "url": None,
                "status": "confirmed",
            }
        )
    return events


def pull_google():
    """Composio-fetched events, pre-normalized by the agent into google.json."""
    data = load_json(GOOGLE_PATH, [])
    if isinstance(data, dict):
        data = data.get("events", [])
    if not isinstance(data, list):
        return []
    events = []
    for item in data[:MAX_EVENTS_PER_SOURCE]:
        if not isinstance(item, dict):
            continue
        starts = clean(str(item.get("starts_at", "")))
        title = clean(str(item.get("title", "")))
        if not starts:
            continue
        uid = clean(str(item.get("id") or title + starts))
        events.append(
            {
                "id": f"google:{hashlib.sha256(uid.encode()).hexdigest()[:16]}",
                "source": "google",
                "source_ref": "composio",
                "title": title or "(no title)",
                "starts_at": starts,
                "ends_at": clean(str(item.get("ends_at", ""))) or starts,
                "all_day": bool(item.get("all_day", False)),
                "location": clean(str(item.get("location", ""))) or None,
                "attendees_count": int(item.get("attendees_count") or 0),
                "url": None,
                "status": "confirmed",
            }
        )
    return events


def pull_inbox(tombstones, confirmed):
    """Emailed .ics drops: pending until their calendar_add decision lands."""
    events = []
    if not os.path.isdir(INBOX_DIR):
        return events
    for name in sorted(os.listdir(INBOX_DIR))[:MAX_EVENTS_PER_SOURCE]:
        path = os.path.join(INBOX_DIR, name)
        if not os.path.isfile(path) or path in tombstones:
            continue
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read(MAX_FETCH_BYTES)
        except OSError:
            continue
        for event in parse_ics(text, "email", path):
            event["status"] = "confirmed" if path in confirmed else "pending"
            events.append(event)
    return events


# ── Commands ─────────────────────────────────────────────────────────────────

def load_state():
    state = load_json(EVENTS_PATH, {})
    if not isinstance(state, dict):
        state = {}
    state.setdefault("events", [])
    state.setdefault("tombstones", [])
    state.setdefault("confirmed", [])
    return state


def save_state(state, events):
    atomic_write(
        EVENTS_PATH,
        {
            "events": events,
            "tombstones": state["tombstones"],
            "confirmed": state["confirmed"],
            "synced_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def cmd_pull():
    os.makedirs(INBOX_DIR, exist_ok=True)
    state = load_state()
    sources = load_json(SOURCES_PATH, [])
    if not isinstance(sources, list):
        sources = []
    events = pull_google()
    for source in sources:
        if not isinstance(source, dict) or not isinstance(source.get("secret"), str):
            continue
        pulled = None
        if source.get("provider") == "apple_ics":
            pulled = pull_apple(source)
        elif source.get("provider") == "calcom":
            pulled = pull_calcom(source)
        else:
            continue
        if pulled is None:
            # Fetch failed: keep the previously synced events for this source
            # rather than blanking them until the next successful sync.
            pulled = [
                e
                for e in state["events"]
                if isinstance(e, dict) and e.get("source_ref") == source.get("id")
            ]
        events.extend(pulled)
    events.extend(pull_inbox(set(state["tombstones"]), set(state["confirmed"])))
    # de-dup by id, keep first occurrence
    seen = set()
    merged = []
    for event in events:
        if event["id"] in seen or event["source"] not in ALLOWED_SOURCES:
            continue
        seen.add(event["id"])
        merged.append(event)
    save_state(state, merged)
    print(f"synced {len(merged)} events")


def cmd_approve(ref):
    state = load_state()
    if ref not in state["confirmed"]:
        state["confirmed"].append(ref)
    events = state["events"]
    for event in events:
        if event.get("source_ref") == ref:
            event["status"] = "confirmed"
    save_state(state, events)
    print("approved")


def cmd_dismiss(ref):
    state = load_state()
    if ref not in state["tombstones"]:
        state["tombstones"].append(ref)
    state["confirmed"] = [c for c in state["confirmed"] if c != ref]
    events = [e for e in state["events"] if e.get("source_ref") != ref]
    save_state(state, events)
    print("dismissed")


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "pull"
    if command == "pull":
        cmd_pull()
    elif command == "approve" and len(sys.argv) > 2:
        cmd_approve(sys.argv[2])
    elif command == "dismiss" and len(sys.argv) > 2:
        cmd_dismiss(sys.argv[2])
    else:
        print(__doc__, file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
