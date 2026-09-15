#!/usr/bin/env node
/*
 * kernel-cdp-relay — localhost CDP endpoint for Kernel cloud browsers.
 *
 * The remote cdp_ws_url is a bearer credential (C27): it lives only in
 * ~/.hermes/kernel/session.json (0600), written by `air-kernel browser
 * create`. This relay exposes a local DevTools HTTP+WebSocket surface at
 * 127.0.0.1:$KERNEL_CDP_PORT so agent-browser's `--cdp <port>` mode works
 * unchanged — the remote URL never enters argv, logs, or the environment.
 *
 *   GET  /json/version, /json/list  → synthetic target pointing back here
 *   WS   any path                   → piped to the remote browser endpoint
 *
 * Human control (C31): the agent-browser guard already fails closed on an
 * active owner lease; this relay is transport-only and adds no policy.
 */
"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.KERNEL_CDP_PORT || "9222", 10);
const SESSION_FILE =
  process.env.KERNEL_SESSION_FILE ||
  path.join(os.homedir(), ".hermes/kernel/session.json");
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function loadSession() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return null;
  }
}

function remoteWsUrl() {
  const session = loadSession();
  return session && typeof session.cdp_url === "string"
    ? session.cdp_url
    : null;
}

function localWs() {
  return `ws://${HOST}:${PORT}/devtools/browser`;
}

/* --------------------------------------------------- minimal WS codec */

const OPCODE_CONT = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_BIN = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Stateful parser for masked client frames -> complete messages. */
function makeClientParser(onMessage, onClose, onPing) {
  let buffer = Buffer.alloc(0);
  let fragments = [];
  let fragmentedOpcode = 0;
  return function feed(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const b0 = buffer[0];
      const b1 = buffer[1];
      const opcode = b0 & 0x0f;
      const fin = (b0 & 0x80) !== 0;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buffer.length < offset + 2) return;
        len = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (len === 127) {
        if (buffer.length < offset + 8) return;
        len = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
      }
      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + len) return;
      let payload = buffer.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i += 1) {
          payload[i] ^= mask[i & 3];
        }
      }
      buffer = buffer.subarray(offset + maskLen + len);
      if (opcode === OPCODE_CLOSE) {
        onClose();
        return;
      }
      if (opcode === OPCODE_PING) {
        onPing(payload);
        continue;
      }
      if (opcode === OPCODE_PONG) continue;
      if (opcode === OPCODE_CONT) {
        fragments.push(payload);
        if (fin) {
          onMessage(Buffer.concat(fragments), fragmentedOpcode === OPCODE_BIN);
          fragments = [];
          fragmentedOpcode = 0;
        }
        continue;
      }
      if (!fin) {
        fragments = [payload];
        fragmentedOpcode = opcode;
        continue;
      }
      onMessage(payload, opcode === OPCODE_BIN);
    }
  };
}

/* ------------------------------------------------------------------ */

const server = http.createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && (req.url === "/json/version" || req.url === "/json/version/")) {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        Browser: "AirKernel/1.0",
        "Protocol-Version": "1.3",
        webSocketDebuggerUrl: localWs(),
      })
    );
    return;
  }
  if (
    req.method === "GET" &&
    req.url &&
    (req.url === "/json" ||
      req.url === "/json/" ||
      req.url.startsWith("/json/list") ||
      req.url.startsWith("/json/new"))
  ) {
    const session = loadSession();
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify([
        {
          id: session?.kernel_session_id ?? "kernel-browser",
          type: "browser",
          url: "about:blank",
          title: "Kernel browser",
          webSocketDebuggerUrl: localWs(),
        },
      ])
    );
    return;
  }
  if (
    req.url &&
    (req.url.startsWith("/json/activate") || req.url.startsWith("/json/close"))
  ) {
    res.end("ok");
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  const remote = remoteWsUrl();
  if (!key || !remote) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash("sha1")
    .update(key + WS_GUID)
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  const upstream = new WebSocket(remote);
  upstream.binaryType = "arraybuffer";
  const writeClose = () => {
    try {
      socket.write(encodeFrame(OPCODE_CLOSE, Buffer.alloc(0)));
    } catch {}
  };
  const feed = makeClientParser(
    (message, binary) => {
      try {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(binary ? new Uint8Array(message) : message.toString("utf8"));
        }
      } catch {}
    },
    () => {
      try {
        upstream.close();
      } catch {}
    },
    (ping) => {
      try {
        socket.write(encodeFrame(OPCODE_PONG, ping));
      } catch {}
    }
  );
  socket.on("data", feed);
  socket.on("error", () => {});
  socket.on("close", () => {
    try {
      upstream.close();
    } catch {}
  });
  upstream.onmessage = (event) => {
    try {
      if (typeof event.data === "string") {
        socket.write(encodeFrame(OPCODE_TEXT, Buffer.from(event.data, "utf8")));
      } else {
        socket.write(encodeFrame(OPCODE_BIN, Buffer.from(event.data)));
      }
    } catch {}
  };
  upstream.onclose = () => writeClose();
  upstream.onerror = () => writeClose();
});

server.listen(PORT, HOST, () => {
  process.stderr.write(
    `kernel-cdp-relay listening on ${HOST}:${PORT} (session file: ${SESSION_FILE})\n`
  );
});
