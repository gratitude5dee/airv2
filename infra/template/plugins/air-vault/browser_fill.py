"""Browser fill transport for ``air-vault type`` (V5, C19).

Delivers a vault value into the focused input of the box's Chromium via CDP
``Input.insertText`` against the local debug endpoint. The port comes from
``AIR_BROWSER_DEBUG_PORT`` when set, otherwise it is discovered from the
agent-browser daemon Chrome's ``DevToolsActivePort`` file (the daemon
launches with ``--remote-debugging-port=0``). The value goes process → CDP
socket → browser; it never enters the model transcript, tool output, run
events, or logs.

Deliberately stdlib-only (socket + urllib): a dependency-free minimal
WebSocket client is enough for one localhost request/response exchange, and
it keeps the fill path auditable end to end.
"""

from __future__ import annotations

import base64
import glob
import json
import os
import socket
import struct
import urllib.request
from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit

if __package__ in (None, ""):
    from vault_store import VaultError
else:
    from .vault_store import VaultError

DEFAULT_DEBUG_PORT = 9222
_TIMEOUT = 10.0


def debug_port() -> int:
    raw = os.environ.get("AIR_BROWSER_DEBUG_PORT", "")
    try:
        port = int(raw)
    except ValueError:
        return DEFAULT_DEBUG_PORT
    return port if 0 < port < 65536 else DEFAULT_DEBUG_PORT


def discovered_ports() -> List[int]:
    """CDP ports of running daemon Chromes, newest profile first. The daemon
    launches Chrome with ``--remote-debugging-port=0``; Chrome writes the
    chosen port to ``DevToolsActivePort`` in its temp profile dir."""
    entries = []
    for path in glob.glob("/tmp/agent-browser-chrome-*/DevToolsActivePort"):
        try:
            first_line = open(path).readline().strip()
            port = int(first_line)
        except (OSError, ValueError):
            continue
        if 0 < port < 65536:
            entries.append((os.path.getmtime(path), port))
    return [port for _, port in sorted(entries, reverse=True)]


def list_targets(port: int) -> List[Dict[str, Any]]:
    """Page targets from the local debug endpoint's /json list, falling back
    to ports discovered from DevToolsActivePort files."""
    for candidate in [port, *[p for p in discovered_ports() if p != port]]:
        url = f"http://127.0.0.1:{candidate}/json/list"
        try:
            with urllib.request.urlopen(url, timeout=_TIMEOUT) as response:
                targets = json.loads(response.read().decode("utf-8"))
        except (OSError, ValueError):
            continue
        return targets if isinstance(targets, list) else []
    raise VaultError(
        "browser_unreachable",
        "the browser's debug endpoint is not reachable — is the browser "
        "running?",
    )


def frontmost_page(targets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """The frontmost real page: the debug endpoint lists the most recently
    active target first; internal pages are skipped."""
    for target in targets:
        if not isinstance(target, dict) or target.get("type") != "page":
            continue
        url = str(target.get("url") or "")
        if url.startswith(("chrome://", "devtools://", "chrome-extension://")):
            continue
        return target
    raise VaultError("no_page", "no page is open in the headed browser")


def page_host(target: Dict[str, Any]) -> str:
    host = (urlsplit(str(target.get("url") or "")).hostname or "").lower()
    if not host:
        raise VaultError("no_page", "the frontmost page has no host")
    return host[4:] if host.startswith("www.") else host


def host_granted(host: str, granted_hosts: Optional[List[str]]) -> bool:
    """Exact or subdomain match against the item's granted host list."""
    if not isinstance(granted_hosts, list):
        return False
    for raw in granted_hosts:
        if not isinstance(raw, str):
            continue
        grant = raw.strip().lower()
        if grant.startswith("www."):
            grant = grant[4:]
        if grant and (host == grant or host.endswith("." + grant)):
            return True
    return False


class _WebSocket:
    """Minimal RFC 6455 client for one localhost CDP exchange."""

    def __init__(self, url: str):
        parts = urlsplit(url)
        host = parts.hostname or "127.0.0.1"
        port = parts.port or 80
        path = parts.path or "/"
        self._sock = socket.create_connection((host, port), timeout=_TIMEOUT)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self._sock.sendall(handshake.encode("ascii"))
        response = b""
        while b"\r\n\r\n" not in response:
            chunk = self._sock.recv(4096)
            if not chunk:
                break
            response += chunk
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            self.close()
            raise VaultError(
                "browser_unreachable", "CDP websocket handshake failed"
            )

    def send_text(self, text: str) -> None:
        payload = text.encode("utf-8")
        header = bytearray([0x81])  # FIN + text opcode
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", length)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", length)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self._sock.sendall(bytes(header) + masked)

    def _read_exact(self, count: int) -> bytes:
        data = b""
        while len(data) < count:
            chunk = self._sock.recv(count - len(data))
            if not chunk:
                raise VaultError(
                    "browser_unreachable", "CDP websocket closed unexpectedly"
                )
            data += chunk
        return data

    def recv_text(self) -> str:
        while True:
            first, second = self._read_exact(2)
            opcode = first & 0x0F
            length = second & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._read_exact(8))[0]
            if second & 0x80:  # masked server frame (nonstandard) — unmask
                mask = self._read_exact(4)
                payload = bytes(
                    b ^ mask[i % 4]
                    for i, b in enumerate(self._read_exact(length))
                )
            else:
                payload = self._read_exact(length)
            if opcode == 0x9:  # ping → pong, keep waiting
                self._sock.sendall(b"\x8a\x80" + os.urandom(4))
                continue
            if opcode == 0x8:
                raise VaultError(
                    "browser_unreachable", "CDP websocket closed unexpectedly"
                )
            return payload.decode("utf-8")

    def close(self) -> None:
        try:
            self._sock.close()
        except OSError:
            pass


def cdp_call(ws_url: str, method: str, params: Dict[str, Any]) -> None:
    """One CDP command over a fresh connection; raises on error replies."""
    ws = _WebSocket(ws_url)
    try:
        ws.send_text(json.dumps({"id": 1, "method": method, "params": params}))
        while True:
            reply = json.loads(ws.recv_text())
            if not isinstance(reply, dict) or reply.get("id") != 1:
                continue  # events interleave with the command reply
            if "error" in reply:
                # CDP error messages never echo Input.insertText params.
                message = str(
                    (reply.get("error") or {}).get("message") or "CDP error"
                )
                raise VaultError("fill_failed", f"browser refused: {message}")
            return
    finally:
        ws.close()


def insert_text(target: Dict[str, Any], text: str) -> None:
    """Type into the focused input of the target page via Input.insertText."""
    ws_url = str(target.get("webSocketDebuggerUrl") or "")
    if not ws_url:
        raise VaultError("no_page", "the frontmost page has no debug socket")
    cdp_call(ws_url, "Input.insertText", {"text": text})
