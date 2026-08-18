"""browser_fill transport: target selection, host matching, real WS framing."""

import base64
import hashlib
import json
import socket
import struct
import threading

import pytest

import browser_fill
from browser_fill import VaultError


# ── target selection / host parsing ─────────────────────────────────────────

def test_frontmost_page_skips_internal_targets():
    targets = [
        {"type": "iframe", "url": "https://ad.example/"},
        {"type": "page", "url": "chrome://newtab/"},
        {"type": "page", "url": "devtools://devtools/bundled/x.html"},
        {"type": "page", "url": "https://www.grubhub.com/login"},
        {"type": "page", "url": "https://second.example/"},
    ]
    assert browser_fill.frontmost_page(targets)["url"] == (
        "https://www.grubhub.com/login"
    )


def test_frontmost_page_none_open():
    with pytest.raises(VaultError) as exc:
        browser_fill.frontmost_page([{"type": "page", "url": "chrome://x/"}])
    assert exc.value.code == "no_page"


def test_page_host_normalizes_www():
    target = {"url": "https://www.GrubHub.com/login?next=/"}
    assert browser_fill.page_host(target) == "grubhub.com"


def test_page_host_missing():
    with pytest.raises(VaultError):
        browser_fill.page_host({"url": "about:blank"})


def test_host_granted_exact_and_subdomain():
    assert browser_fill.host_granted("grubhub.com", ["grubhub.com"])
    assert browser_fill.host_granted("sso.grubhub.com", ["grubhub.com"])
    assert browser_fill.host_granted("grubhub.com", ["www.grubhub.com"])
    assert not browser_fill.host_granted("evilgrubhub.com", ["grubhub.com"])
    assert not browser_fill.host_granted("grubhub.com.evil.example",
                                         ["grubhub.com"])
    assert not browser_fill.host_granted("grubhub.com", None)
    assert not browser_fill.host_granted("grubhub.com", [])


def test_debug_port_env(monkeypatch):
    monkeypatch.setenv("AIR_BROWSER_DEBUG_PORT", "9333")
    assert browser_fill.debug_port() == 9333
    monkeypatch.setenv("AIR_BROWSER_DEBUG_PORT", "bogus")
    assert browser_fill.debug_port() == 9222


# ── real websocket exchange against a fake CDP endpoint ─────────────────────

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def _read_frame(conn):
    header = conn.recv(2)
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack(">H", conn.recv(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", conn.recv(8))[0]
    mask = conn.recv(4) if header[1] & 0x80 else b""
    payload = b""
    while len(payload) < length:
        payload += conn.recv(length - len(payload))
    if mask:
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    return payload


def _send_text(conn, text):
    payload = text.encode("utf-8")
    conn.sendall(bytes([0x81, len(payload)]) + payload)


def _fake_cdp_server(result_by_method, received):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]

    def serve():
        conn, _ = server.accept()
        request = b""
        while b"\r\n\r\n" not in request:
            request += conn.recv(4096)
        key = ""
        for line in request.decode("latin-1").split("\r\n"):
            if line.lower().startswith("sec-websocket-key:"):
                key = line.split(":", 1)[1].strip()
        accept = base64.b64encode(
            hashlib.sha1((key + WS_GUID).encode()).digest()
        ).decode()
        conn.sendall(
            (
                "HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
            ).encode()
        )
        message = json.loads(_read_frame(conn).decode("utf-8"))
        received.append(message)
        # Interleave an event before the reply, as real CDP does.
        _send_text(conn, json.dumps({"method": "Page.frameNavigated"}))
        reply = {"id": message["id"]}
        reply.update(result_by_method.get(message["method"], {"result": {}}))
        _send_text(conn, json.dumps(reply))
        conn.close()
        server.close()

    threading.Thread(target=serve, daemon=True).start()
    return port


def test_insert_text_over_real_websocket():
    received = []
    port = _fake_cdp_server({"Input.insertText": {"result": {}}}, received)
    target = {
        "webSocketDebuggerUrl": f"ws://127.0.0.1:{port}/devtools/page/1"
    }
    browser_fill.insert_text(target, "s3cret-value")
    [message] = received
    assert message["method"] == "Input.insertText"
    assert message["params"] == {"text": "s3cret-value"}


def test_cdp_error_is_machine_readable_and_value_free():
    received = []
    port = _fake_cdp_server(
        {"Input.insertText": {"error": {"message": "No target with given id"}}},
        received,
    )
    target = {
        "webSocketDebuggerUrl": f"ws://127.0.0.1:{port}/devtools/page/1"
    }
    with pytest.raises(VaultError) as exc:
        browser_fill.insert_text(target, "s3cret-value")
    assert exc.value.code == "fill_failed"
    assert "s3cret-value" not in str(exc.value)


def test_insert_text_requires_debug_socket():
    with pytest.raises(VaultError) as exc:
        browser_fill.insert_text({"url": "https://x.example/"}, "value")
    assert exc.value.code == "no_page"
