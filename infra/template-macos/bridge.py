#!/usr/bin/env python3
"""air 2.0 — the macOS control bridge.

Namespace's CommandService only runs commands in containers, and a macOS
instance is native, so this tiny HTTP server is how the control plane reaches
the Mac: exec plus file read/write, the same three primitives the box command
API gives it (lib/compute/runtime.ts routes the "native" kind here).

Reached only through the authenticated Namespace ingress (its bearer check
stays ON for this port — see publishMacIngress), and every request must ALSO
carry the per-instance token in X-Air-Bridge-Token, so neither the workspace
token nor the bridge token alone reaches the agent's filesystem.

Endpoints (JSON):
  GET  /v1/health            → {"ready": true}   once setup.sh finished
  POST /v1/command           {"command", "timeoutSeconds"} → {exitCode, stdout, stderr}
  GET  /v1/files?path=...    → {"content"}
  PUT  /v1/files             {"path", "content"} → {"ok": true}

stdlib only: the bridge must be alive before anything is installed.
"""

import hmac
import json
import os
import pathlib
import subprocess
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ["AIR_BRIDGE_TOKEN"]
PORT = int(os.environ.get("AIR_BRIDGE_PORT", "8722"))
READY_FILE = pathlib.Path.home() / ".hermes" / ".bootstrap-complete"
MAX_BODY = 32 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    server_version = "air-bridge/1"

    def _authed(self) -> bool:
        supplied = self.headers.get("X-Air-Bridge-Token", "")
        return hmac.compare_digest(supplied, TOKEN)

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_BODY:
            raise ValueError("body too large")
        raw = self.rfile.read(length)
        parsed = json.loads(raw) if raw else {}
        if not isinstance(parsed, dict):
            raise ValueError("expected a JSON object")
        return parsed

    def do_GET(self) -> None:  # noqa: N802 (http.server API)
        if not self._authed():
            self._send(401, {"error": "unauthorized"})
            return
        url = urllib.parse.urlparse(self.path)
        if url.path == "/v1/health":
            self._send(200, {"ready": READY_FILE.exists()})
            return
        if url.path == "/v1/files":
            params = urllib.parse.parse_qs(url.query)
            path = (params.get("path") or [""])[0]
            if not path:
                self._send(400, {"error": "path is required"})
                return
            try:
                content = pathlib.Path(path).read_text(encoding="utf-8")
            except OSError as error:
                self._send(404, {"error": str(error)})
                return
            self._send(200, {"content": content})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self._authed():
            self._send(401, {"error": "unauthorized"})
            return
        if urllib.parse.urlparse(self.path).path != "/v1/command":
            self._send(404, {"error": "not found"})
            return
        try:
            body = self._body()
            command = body["command"]
            timeout = float(body.get("timeoutSeconds", 60))
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self._send(400, {"error": str(error)})
            return
        try:
            result = subprocess.run(
                ["/bin/bash", "-lc", command],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=pathlib.Path.home(),
            )
            self._send(
                200,
                {
                    "exitCode": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                },
            )
        except subprocess.TimeoutExpired:
            self._send(
                200,
                {
                    "exitCode": 124,
                    "stdout": "",
                    "stderr": f"timed out after {timeout}s",
                },
            )

    def do_PUT(self) -> None:  # noqa: N802
        if not self._authed():
            self._send(401, {"error": "unauthorized"})
            return
        if urllib.parse.urlparse(self.path).path != "/v1/files":
            self._send(404, {"error": "not found"})
            return
        try:
            body = self._body()
            path = pathlib.Path(body["path"])
            content = body["content"]
            if not isinstance(content, str):
                raise ValueError("content must be a string")
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self._send(400, {"error": str(error)})
            return
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        except OSError as error:
            self._send(500, {"error": str(error)})
            return
        self._send(200, {"ok": True})

    def log_message(self, format: str, *args: object) -> None:
        # Paths only — request bodies can carry secrets (per-box .env writes).
        sys.stderr.write(
            "%s %s\n" % (self.command, urllib.parse.urlparse(self.path).path)
        )


def main() -> None:
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
