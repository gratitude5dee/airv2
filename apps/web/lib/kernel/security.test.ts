/**
 * Kernel box security behaviour (R-TQ-08): exercises the actual box-side
 * helpers instead of grepping their source.
 *
 *  - `air-kernel browser create` is spawned against a stubbed `curl`; the
 *    create response carries `cdp_url`, a live bearer credential for the
 *    remote browser — it must land in ~/.hermes/kernel/session.json and
 *    never reach stdout.
 *  - `kernel-cdp-relay.js` is spawned as a child process; a WebSocket
 *    upgrade is only answered with 101 when the owner lease allows agent
 *    control — anything else is a 503 and the socket dies.
 */
import { describe, expect, it, afterAll } from "vitest";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createConnection, type AddressInfo } from "node:net";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const template = fileURLToPath(
  new URL("../../../../infra/template/", import.meta.url)
);

/* --------------------------------------------------------- air-kernel */

function stubBin(dir: string, name: string, body: string) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function fakeHome(): string {
  return mkdtempSync(join(tmpdir(), "air-kernel-home-"));
}

const CURL_STUB = `#!/usr/bin/env bash
# Stub curl: answer the kernel-browser create with a cdp_url payload.
printf '%s' '{"ok":true,"session_id":"s1","kernel_session_id":"k1","cdp_url":"wss://remote/devtools/SECRET-CDP","live_view_available":false}'
`;

describe("air-kernel browser create", () => {
  it("writes cdp_url to the session file but never prints it", () => {
    const home = fakeHome();
    const bin = join(home, "bin");
    stubBin(bin, "curl", CURL_STUB);

    const stdout = execFileSync(
      "bash",
      [join(template, "air-kernel"), "browser", "create"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env["PATH"] ?? ""}`,
          HOME: home,
          AIR_KERNEL_BASE_URL: "http://gateway.invalid/api/gateway/v1",
          AIR_KERNEL_TOKEN: "test-token",
        },
      }
    );

    // The agent-facing output carries only the non-secret handles.
    const printed = JSON.parse(stdout.trim().split("\n").pop()!) as Record<
      string,
      unknown
    >;
    expect(printed["session_id"]).toBe("s1");
    expect(printed["kernel_session_id"]).toBe("k1");
    expect(printed).not.toHaveProperty("cdp_url");
    expect(stdout).not.toContain("cdp_url");
    expect(stdout).not.toContain("SECRET-CDP");

    // The full response — cdp_url included — is persisted for the relay.
    const sessionFile = join(home, ".hermes", "kernel", "session.json");
    const saved = JSON.parse(readFileSync(sessionFile, "utf8")) as Record<
      string,
      unknown
    >;
    expect(saved["cdp_url"]).toBe("wss://remote/devtools/SECRET-CDP");
  });

  it("fails closed when gateway credentials are absent", () => {
    const home = fakeHome();
    try {
      execFileSync("bash", [join(template, "air-kernel"), "browser", "create"], {
        encoding: "utf8",
        env: { ...process.env, HOME: home },
      });
      expect.unreachable("create without credentials must fail");
    } catch (error) {
      const failed = error as { status?: number; stderr?: string };
      expect(failed.status).toBe(75);
      expect(String(failed.stderr)).toContain("credentials unavailable");
    }
    // No session handle may be left behind on the credential-less path.
    expect(existsSync(join(home, ".hermes", "kernel", "session.json"))).toBe(
      false
    );
  });
});

/* --------------------------------------------------- kernel-cdp-relay */

interface Relay {
  child: ChildProcess;
  port: number;
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function writeSession(dir: string, cdpUrl: string | null): string {
  const file = join(dir, "session.json");
  writeFileSync(
    file,
    JSON.stringify({
      session_id: "local-s1",
      kernel_session_id: "k1",
      ...(cdpUrl ? { cdp_url: cdpUrl } : {}),
    })
  );
  return file;
}

/** Spawn the relay and wait for its listening banner on stderr. */
async function startRelay(
  port: number,
  sessionFile: string,
  gatewayBase?: string
): Promise<Relay> {
  // loadGatewayCredentials reads the env file first and returns null when
  // it is missing — even with AIR_KERNEL_* set — so the file must exist.
  const envFile = join(sessionFile, "..", ".env");
  writeFileSync(envFile, "");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: join(sessionFile, ".."),
    AIR_HERMES_ENV_FILE: envFile,
    KERNEL_CDP_PORT: String(port),
    KERNEL_SESSION_FILE: sessionFile,
  };
  if (gatewayBase) env["AIR_KERNEL_BASE_URL"] = gatewayBase;
  env["AIR_KERNEL_TOKEN"] = "test-token";
  const child = spawn("node", [join(template, "kernel-cdp-relay.js")], {
    env,
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("relay did not announce itself")),
      5000
    );
    child.stderr?.on("data", (chunk: Buffer) => {
      if (chunk.toString("utf8").includes("listening on")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code: number | null) =>
      reject(new Error(`relay exited early with ${code}`))
    );
  });
  return { child, port };
}

/** Raw HTTP/1.1 WebSocket upgrade — enough of the handshake to get a status. */
function upgradeRequest(port: number, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(port, "127.0.0.1");
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("upgrade timed out"));
    }, 4000);
    socket.on("connect", () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${port}\r\n` +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
          "Sec-WebSocket-Version: 13\r\n\r\n"
      );
    });
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const text = buffer.toString("utf8");
      if (text.includes("\r\n\r\n")) {
        clearTimeout(timer);
        socket.destroy();
        resolve(text);
      }
    });
    socket.on("error", reject);
  });
}

async function stopRelay(relay: Relay) {
  if (relay.child.exitCode !== null || relay.child.signalCode !== null) return;
  relay.child.kill("SIGTERM");
  await new Promise((resolve) => relay.child.once("exit", resolve));
}

describe("kernel-cdp-relay", () => {
  let relay: Relay;
  let home: string;
  let gateway: Server | null = null;
  let gatewayResponse = { active: false, human_control: false };

  async function startWithGateway(
    sessionUrl: string | null,
    lease: typeof gatewayResponse
  ) {
    gatewayResponse = lease;
    gateway = createServer((req, res) => {
      expect(req.url).toContain("/api/kernel/browser");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(gatewayResponse));
    });
    await new Promise<void>((resolve) => gateway!.listen(0, "127.0.0.1", resolve));
    const { port: gatewayPort } = gateway!.address() as AddressInfo;
    home = mkdtempSync(join(tmpdir(), "relay-home-"));
    const sessionFile = writeSession(home, sessionUrl);
    const port = await freePort();
    return startRelay(
      port,
      sessionFile,
      `http://127.0.0.1:${gatewayPort}`
    );
  }

  afterAll(async () => {
    if (relay) await stopRelay(relay);
    gateway?.close();
  });

  it("answers /json/version with a synthetic browser target", async () => {
    home = mkdtempSync(join(tmpdir(), "relay-home-"));
    const sessionFile = writeSession(home, "wss://remote.invalid/devtools/x");
    relay = await startRelay(await freePort(), sessionFile);

    const res = await fetch(`http://127.0.0.1:${relay.port}/json/version`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { webSocketDebuggerUrl?: string };
    expect(body.webSocketDebuggerUrl).toBe(
      `ws://127.0.0.1:${relay.port}/devtools/browser`
    );
    await stopRelay(relay);
  });

  it("503s the upgrade when there is no remote cdp_url", async () => {
    home = mkdtempSync(join(tmpdir(), "relay-home-"));
    const sessionFile = writeSession(home, null);
    relay = await startRelay(await freePort(), sessionFile);

    const head = await upgradeRequest(relay.port, "/devtools/browser");
    expect(head.startsWith("HTTP/1.1 503")).toBe(true);
    await stopRelay(relay);
  });

  it("503s the upgrade when the owner lease is held by a human", async () => {
    relay = await startWithGateway("wss://127.0.0.1:1/devtools/x", {
      active: true,
      human_control: true,
    });
    const head = await upgradeRequest(relay.port, "/devtools/browser");
    expect(head.startsWith("HTTP/1.1 503")).toBe(true);
    await stopRelay(relay);
    gateway?.close();
    gateway = null;
  });

  it("101s the upgrade when the lease is free for the agent", async () => {
    relay = await startWithGateway("wss://127.0.0.1:1/devtools/x", {
      active: false,
      human_control: false,
    });
    const head = await upgradeRequest(relay.port, "/devtools/browser");
    expect(head.startsWith("HTTP/1.1 101")).toBe(true);
    await stopRelay(relay);
    gateway?.close();
    gateway = null;
  });

  it("503s upgrades to paths other than /devtools/browser", async () => {
    home = mkdtempSync(join(tmpdir(), "relay-home-"));
    const sessionFile = writeSession(home, "wss://127.0.0.1:1/devtools/x");
    relay = await startRelay(await freePort(), sessionFile);
    const head = await upgradeRequest(relay.port, "/devtools/page/anything");
    expect(head.startsWith("HTTP/1.1 503")).toBe(true);
    await stopRelay(relay);
  });
});
