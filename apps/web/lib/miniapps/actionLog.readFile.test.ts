/**
 * The action-log append against the real Box client: only the Box HTTP
 * layer is faked, and the `cat` it would run is executed by a local shell,
 * so `readFile`'s classification of real exit codes and stderr is what's
 * under test. A missing file starts a fresh log; any other failed `cat`
 * (permission denied, I/O error, killed) aborts the append, file untouched.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoxApiError } from "../box/client";

vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));

interface CommandOutcome {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

let dir: string;
/** The Box runs commands from its home; the temp dir stands in for it. */
function runLocally(shellCommand: string): CommandOutcome {
  const run = spawnSync("sh", ["-c", shellCommand], { cwd: dir, encoding: "utf8" });
  return { exitCode: run.status ?? -1, stdout: run.stdout, stderr: run.stderr };
}
let nextRead: CommandOutcome | null = null;
const writes: { path: string; content: string }[] = [];
const commands: string[] = [];

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;
  if (url.endsWith("/commands")) {
    const shellCommand = body["command"] ?? "";
    commands.push(shellCommand);
    const outcome = nextRead ?? runLocally(shellCommand);
    return new Response(
      JSON.stringify({
        exitCode: outcome.exitCode,
        stdout: outcome.stdout ?? "",
        stderr: outcome.stderr ?? "",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (url.endsWith("/files")) {
    writes.push({ path: body["path"] ?? "", content: body["content"] ?? "" });
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  throw new Error(`unexpected Box call ${url}`);
});

const supabase = {
  rpc: async (fn: string) => {
    if (fn === "miniapp_state_lease") return { data: true, error: null };
    if (fn === "miniapp_state_release") return { data: true, error: null };
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
} as unknown as SupabaseClient;

const entry = (action: string) => ({
  action,
  payload: null,
  role: "owner",
  at: "2026-09-04T00:00:00.000Z",
});

const LOG_DIR = ".hermes/miniapps/party";
const LOG_FILE = `${LOG_DIR}/actions.json`;

async function appendFailure(action: string): Promise<unknown> {
  const { appendActionLogEntry } = await import("./actionLog");
  return appendActionLogEntry(supabase, "u1", "party", entry(action), { attempts: 1 }).then(
    () => null,
    (e: unknown) => e
  );
}

beforeEach(() => {
  process.env["BOX_API_KEY"] = "test-key";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  writes.length = 0;
  commands.length = 0;
  nextRead = null;
  dir = mkdtempSync(join(tmpdir(), "airv2-actionlog-"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  try {
    chmodSync(join(dir, LOG_DIR), 0o700);
  } catch {
    // only the permission test locks it
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("appendActionLogEntry through the real readFile", () => {
  it("a genuinely missing log file starts a fresh one", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    await appendActionLogEntry(supabase, "u1", "party", entry("first"), { attempts: 1 });
    expect(commands[0]).toMatch(/^LC_ALL=C cat '/);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!.content)).toEqual([entry("first")]);
  });

  it("appends to an existing log", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    mkdirSync(join(dir, LOG_DIR), { recursive: true });
    writeFileSync(join(dir, LOG_FILE), JSON.stringify([entry("kept")]));
    await appendActionLogEntry(supabase, "u1", "party", entry("next"), { attempts: 1 });
    expect(JSON.parse(writes[0]!.content)).toEqual([entry("kept"), entry("next")]);
  });

  it("a log behind an unreadable directory aborts the append instead of restarting it", async () => {
    mkdirSync(join(dir, LOG_DIR), { recursive: true });
    writeFileSync(join(dir, LOG_FILE), JSON.stringify([entry("kept")]));
    chmodSync(join(dir, LOG_DIR), 0o000);
    if (process.getuid?.() === 0) return; // root reads through directory modes
    const error = await appendFailure("lost");
    expect(error).toBeInstanceOf(BoxApiError);
    expect((error as BoxApiError).status).toBe(500);
    expect((error as BoxApiError).message).toMatch(/Permission denied/);
    expect(writes).toHaveLength(0);
  });

  it("an I/O error or a killed cat aborts the append too", async () => {
    for (const failure of [
      { exitCode: 1, stderr: `cat: ${LOG_FILE}: Input/output error` },
      { exitCode: 137 },
    ]) {
      nextRead = failure;
      const error = await appendFailure("lost");
      expect(error).toBeInstanceOf(BoxApiError);
      expect((error as BoxApiError).status).toBe(500);
    }
    expect(writes).toHaveLength(0);
  });
});
