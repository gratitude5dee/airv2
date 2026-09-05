import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BoxApiError,
  type CommandResult,
  classifyReadFile,
  deleteBox,
  getBox,
  readFile,
  readFileCommand,
} from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  process.env["BOX_API_KEY"] = "test-key";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function boxResponse(box: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ box }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("getBox", () => {
  it("parses a running box with a hosted url", async () => {
    fetchMock.mockResolvedValueOnce(
      boxResponse({ id: "bx_1", state: "ready", url: "https://bx1.example" })
    );
    const box = await getBox("bx_1");
    expect(box.state).toBe("ready");
    expect(box.url).toBe("https://bx1.example");
  });

  it("parses a stopped box whose url is null", async () => {
    fetchMock.mockResolvedValueOnce(
      boxResponse({ id: "bx_1", state: "idle", url: null })
    );
    const box = await getBox("bx_1");
    expect(box.state).toBe("idle");
    expect(box.url).toBeUndefined();
  });

  it("parses a box with no url field at all", async () => {
    fetchMock.mockResolvedValueOnce(boxResponse({ id: "bx_1", state: "archived" }));
    const box = await getBox("bx_1");
    expect(box.url).toBeUndefined();
  });
});

describe("deleteBox", () => {
  it("confirms the delete by echoing the target id in the header the API requires", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, type: "box.deleting" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await deleteBox("bx_old");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/boxes\/bx_old$/);
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("X-Ascii-Confirm-Delete")).toBe(
      "bx_old"
    );
  });
});

function commandResponse(exitCode: number, stdout = "", stderr = ""): Response {
  return new Response(JSON.stringify({ exitCode, stdout, stderr }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function classify(path: string, result: CommandResult): BoxApiError | string {
  try {
    return classifyReadFile(path, result);
  } catch (error) {
    if (error instanceof BoxApiError) return error;
    throw error;
  }
}

/** What the Box command endpoint would hand back for `readFileCommand(path)`. */
function runLocally(path: string, env: Record<string, string> = {}): CommandResult {
  const run = spawnSync("sh", ["-c", readFileCommand(path)], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { exitCode: run.status ?? -1, stdout: run.stdout, stderr: run.stderr };
}

describe("readFile", () => {
  it("sends a C-locale cat and returns stdout on success", async () => {
    fetchMock.mockResolvedValueOnce(commandResponse(0, "[1]"));
    await expect(readFile("bx_1", "/home/user/a b.json")).resolves.toBe("[1]");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      command: string;
    };
    expect(body.command).toBe('LC_ALL=C cat "/home/user/a b.json"');
  });

  it("maps a 500 classification through to the caller", async () => {
    fetchMock.mockResolvedValueOnce(commandResponse(137, "", ""));
    await expect(readFile("bx_1", "/x")).rejects.toMatchObject({ status: 500 });
  });

  it("never treats a killed or timed-out cat as missing", () => {
    for (const result of [
      { exitCode: 137, stdout: "", stderr: "" },
      { exitCode: 124, stdout: "", stderr: "timed out" },
      { exitCode: 1, stdout: "", stderr: "cat: x: Input/output error" },
      { exitCode: 2, stdout: "", stderr: "No such file or directory" },
    ]) {
      const error = classify("/x", result);
      expect(error).toBeInstanceOf(BoxApiError);
      expect((error as BoxApiError).status).toBe(500);
    }
  });

  describe("against a real shell", () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "airv2-readfile-"));
    });
    afterEach(() => {
      try {
        chmodSync(join(dir, "locked"), 0o700);
      } catch {
        // only the permission test creates it
      }
      rmSync(dir, { recursive: true, force: true });
    });

    it("reads an existing file, 404s a missing one even under a non-C LANG", () => {
      const present = join(dir, "present.json");
      writeFileSync(present, '{"a":1}');
      expect(classify(present, runLocally(present))).toBe('{"a":1}');

      const missing = join(dir, "missing.json");
      const result = runLocally(missing, { LANG: "fr_FR.UTF-8", LC_ALL: "fr_FR.UTF-8" });
      expect(result.exitCode).toBe(1);
      expect((classify(missing, result) as BoxApiError).status).toBe(404);
    });

    it("a file behind an unreadable parent is a 500, not a missing file", () => {
      const locked = join(dir, "locked");
      mkdirSync(locked);
      const path = join(locked, "actions.json");
      writeFileSync(path, "[]");
      chmodSync(locked, 0o000);
      const result = runLocally(path);
      if (result.exitCode === 0) {
        // root ignores directory modes; the classifier still saw a real read.
        expect(process.getuid?.()).toBe(0);
        return;
      }
      expect(result.stderr).toMatch(/Permission denied/);
      expect((classify(path, result) as BoxApiError).status).toBe(500);
    });
  });
});
