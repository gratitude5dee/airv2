/**
 * The action-log append against the real Box client: only the Box HTTP
 * layer is faked, so `readFile`'s exit-code classification is the one under
 * test. A missing file starts a fresh log; any other failed `cat` (permission
 * denied, I/O error, killed) aborts the append and leaves the file alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoxApiError, READ_FILE_MISSING_EXIT } from "../box/client";

vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));

interface CommandOutcome {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

const LOG_PATH = "/home/user/.hermes/miniapps/party/actions.json";
let nextRead: CommandOutcome = { exitCode: READ_FILE_MISSING_EXIT };
const writes: { path: string; content: string }[] = [];
const commands: string[] = [];

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;
  if (url.endsWith("/commands")) {
    commands.push(body["command"] ?? "");
    return new Response(
      JSON.stringify({
        exitCode: nextRead.exitCode,
        stdout: nextRead.stdout ?? "",
        stderr: nextRead.stderr ?? "",
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

beforeEach(() => {
  process.env["BOX_API_KEY"] = "test-key";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  writes.length = 0;
  commands.length = 0;
  nextRead = { exitCode: READ_FILE_MISSING_EXIT };
});
afterEach(() => vi.unstubAllGlobals());

describe("appendActionLogEntry through the real readFile", () => {
  it("a genuinely missing log file starts a fresh one", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    await appendActionLogEntry(supabase, "u1", "party", entry("first"), { attempts: 1 });
    expect(commands[0]).toContain(`|| exit ${READ_FILE_MISSING_EXIT}; cat`);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!.content)).toEqual([entry("first")]);
  });

  it("appends to an existing log", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    nextRead = { exitCode: 0, stdout: JSON.stringify([entry("kept")]) };
    await appendActionLogEntry(supabase, "u1", "party", entry("next"), { attempts: 1 });
    expect(JSON.parse(writes[0]!.content)).toEqual([entry("kept"), entry("next")]);
  });

  it("any other failed cat aborts the append instead of writing a one-entry log", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    for (const failure of [
      { exitCode: 1, stderr: `cat: ${LOG_PATH}: Permission denied` },
      { exitCode: 1, stderr: `cat: ${LOG_PATH}: Input/output error` },
      { exitCode: 137 },
    ]) {
      nextRead = failure;
      const error = await appendActionLogEntry(supabase, "u1", "party", entry("lost"), {
        attempts: 1,
      }).then(
        () => null,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(BoxApiError);
      expect((error as BoxApiError).status).toBe(500);
    }
    expect(writes).toHaveLength(0);
  });
});
