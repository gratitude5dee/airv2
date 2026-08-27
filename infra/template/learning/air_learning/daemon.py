"""air-learningd: the Box-local learning coordinator (goal.md §7).

Runs as an unprivileged service. Exposes a versioned local Unix socket only —
no public route, no host tunnel, no Supabase credential, no provider key.
The control plane reaches it exclusively through the existing compute
abstraction by invoking `learningctl`, which talks to this socket.

Protocol: one JSON object per connection, `{"v": 1, "method": ..., "params": {...}}`;
reply is `{"ok": true, "result": ...}` or `{"ok": false, "error": ..., "error_class": ...}`.
"""

from __future__ import annotations

import json
import os
import signal
import socket
import socketserver
import sys
import threading
import time
from pathlib import Path

from . import __version__, candidates, collector, kernel, ledger, promotion
from .receipts import emit_receipt

SOCKET_PATH = ledger.LEARNING_HOME / "learningd.sock"
PROTOCOL_VERSION = 1
MAX_REQUEST_BYTES = 1_000_000

_conn_lock = threading.Lock()


def _db():
    return ledger.connect()


def handle_request(request: dict) -> dict:
    if request.get("v") != PROTOCOL_VERSION:
        return {"ok": False, "error": "unsupported protocol version", "error_class": "bad_request"}
    method = request.get("method")
    params = request.get("params") or {}
    with _conn_lock:
        conn = _db()
        try:
            if method == "status":
                settings = ledger.get_settings(conn)
                pointer = candidates.read_active_pointer()
                return {
                    "ok": True,
                    "result": {
                        "daemon_version": __version__,
                        "protocol": PROTOCOL_VERSION,
                        "mode": settings.get("mode"),
                        "settings": settings,
                        "counts": ledger.counts(conn),
                        "active_profile_id": pointer.get("profile_id") if pointer else None,
                        "promotion_policy_version": promotion.POLICY_VERSION,
                    },
                }
            if method == "settings.set":
                for key, value in params.items():
                    ledger.set_setting(conn, str(key), str(value))
                ledger.append_event(conn, "settings_changed", None, {"keys": sorted(params)})
                emit_receipt(conn, "settings_changed")
                return {"ok": True, "result": ledger.get_settings(conn)}
            if method == "turn.completed":
                episode_id = collector.collect_turn(
                    conn,
                    trace_id=params["trace_id"],
                    session_id=params.get("session_id"),
                    outcome_status=params.get("outcome", "unknown"),
                    steps=params.get("steps", []),
                    usage=params.get("usage", {}),
                    provenance=params.get("provenance", {}),
                )
                return {"ok": True, "result": {"episode_id": episode_id}}
            if method == "feedback.record":
                feedback_id = collector.record_feedback(
                    conn,
                    trace_id=params["trace_id"],
                    reason=params["reason"],
                    rating=params.get("rating"),
                    correction_path=params.get("correction_path"),
                )
                return {"ok": True, "result": {"feedback_id": feedback_id}}
            if method == "receipts.drain":
                return {"ok": True, "result": ledger.drain_receipts(conn, int(params.get("limit", 100)))}
            if method == "receipts.ack":
                keys = params.get("idempotency_keys", [])
                if not isinstance(keys, list) or not all(isinstance(k, str) for k in keys):
                    return {"ok": False, "error_class": "invalid_params", "error": "idempotency_keys must be a list of strings"}
                return {"ok": True, "result": {"acked": ledger.ack_receipts(conn, keys)}}
            if method == "candidates.list":
                rows = conn.execute(
                    "select candidate_id, parent_profile_id, state, summary, created_at, updated_at "
                    "from candidates order by created_at desc limit 50"
                ).fetchall()
                return {"ok": True, "result": [dict(row) for row in rows]}
            if method == "candidate.approve":
                candidates.set_state(conn, params["candidate_id"], "approved")
                profile_id = candidates.activate(conn, params["candidate_id"])
                return {"ok": True, "result": {"profile_id": profile_id}}
            if method == "candidate.reject":
                candidates.set_state(conn, params["candidate_id"], "rejected")
                emit_receipt(conn, "candidate_rejected", candidate_id=params["candidate_id"])
                return {"ok": True, "result": {}}
            if method == "profile.rollback":
                restored = candidates.rollback(conn, params.get("reason", "owner_rejection"))
                return {"ok": True, "result": {"restored_profile_id": restored}}
            if method == "experiment.run":
                result = kernel.run(conn, params["spec"])
                return {"ok": True, "result": result}
            return {"ok": False, "error": f"unknown method: {method}", "error_class": "bad_request"}
        except kernel.KernelError as error:
            return {"ok": False, "error": str(error), "error_class": error.error_class}
        except (KeyError, ValueError) as error:
            return {"ok": False, "error": str(error), "error_class": "bad_request"}
        finally:
            conn.close()


class _Handler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        raw = self.rfile.readline(MAX_REQUEST_BYTES)
        try:
            request = json.loads(raw)
        except json.JSONDecodeError:
            response = {"ok": False, "error": "invalid json", "error_class": "bad_request"}
        else:
            response = handle_request(request)
        self.wfile.write((json.dumps(response) + "\n").encode())


class _Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True


def _maintenance_loop(stop: threading.Event) -> None:
    """Reconciliation and retention sweeps (goal.md §7.1, §15.1)."""
    while not stop.wait(300):
        try:
            with _conn_lock:
                conn = _db()
                try:
                    collector.reconcile_incomplete(conn)
                    collector.expire_raw(conn)
                finally:
                    conn.close()
        except Exception as error:
            print(f"maintenance error: {error}", file=sys.stderr)


def serve() -> None:
    ledger.LEARNING_HOME.mkdir(parents=True, exist_ok=True)
    os.chmod(ledger.LEARNING_HOME, 0o700)
    SOCKET_PATH.unlink(missing_ok=True)
    conn = _db()
    try:
        collector.reconcile_incomplete(conn)
        ledger.append_event(conn, "daemon_started", None, {"version": __version__})
        emit_receipt(conn, "daemon_started")
    finally:
        conn.close()

    server = _Server(str(SOCKET_PATH), _Handler)
    os.chmod(SOCKET_PATH, 0o600)
    stop = threading.Event()
    thread = threading.Thread(target=_maintenance_loop, args=(stop,), daemon=True)
    thread.start()

    def shutdown(signum, frame):
        stop.set()
        server.shutdown()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    print(f"air-learningd {__version__} listening on {SOCKET_PATH}")
    server.serve_forever()
    SOCKET_PATH.unlink(missing_ok=True)


def call(method: str, params: dict | None = None, timeout: float = 60) -> dict:
    """Client helper used by learningctl."""
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(timeout)
    client.connect(str(SOCKET_PATH))
    payload = json.dumps({"v": PROTOCOL_VERSION, "method": method, "params": params or {}}) + "\n"
    client.sendall(payload.encode())
    chunks = []
    while True:
        chunk = client.recv(65536)
        if not chunk:
            break
        chunks.append(chunk)
        if chunk.endswith(b"\n"):
            break
    client.close()
    return json.loads(b"".join(chunks))


if __name__ == "__main__":
    serve()
