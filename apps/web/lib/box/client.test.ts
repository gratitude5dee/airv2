import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenkiSandbox } from "@tenkicloud/sandbox";
import {
  ASCII_GATEWAY_FIREWALL_MARKER,
  BoxApiError,
  type CommandResult,
  classifyReadFile,
  command,
  deleteBox,
  getBox,
  hostRoute,
  parseAsciiHostedUrl,
  providerOf,
  readFile,
  readFileCommand,
  stop,
  waitForHomeSteady,
} from "./client";
import { setTenkiClientForTests } from "./tenki";

vi.mock("../supabase", () => ({
  serviceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  process.env["BOX_API_KEY"] = "test-key";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setTenkiClientForTests(null);
});

describe("provider dispatch", () => {
  const session = {
    id: "s1",
    state: "RUNNING",
    cpuCores: 4,
    memoryMb: 8192,
    tags: ["air-box:s1"],
    exec: vi.fn(async () => ({
      exitCode: 0,
      stdout: new TextEncoder().encode("hi\n"),
      stderr: new Uint8Array(),
    })),
    close: vi.fn(async () => {
      session.state = "TERMINATED";
    }),
    refresh: vi.fn(async () => undefined),
    listExposedPorts: vi.fn(async () => []),
    exposePort: vi.fn(async (port: number) => ({
      port,
      previewUrl: `https://p${port}.tenki.example`,
    })),
  };
  const snapshot = {
    id: "snap-1",
    state: "CREATING",
    sessionId: "s1",
    tags: [] as string[],
    cpuCores: 4,
    memoryMb: 8192,
    createdAt: new Date(),
  };

  beforeEach(() => {
    process.env["TENKI_API_KEY"] = "tk-test";
    session.state = "RUNNING";
    snapshot.state = "CREATING";
    snapshot.tags = [];
    setTenkiClientForTests({
      list: vi.fn(async () =>
        session.state === "TERMINATED" ? [] : [session]
      ),
      listSnapshots: vi.fn(async () =>
        snapshot.tags.length > 0 ? [snapshot] : []
      ),
      createSnapshotAsync: vi.fn(async () => snapshot),
      updateSnapshot: vi.fn(async (_id: string, o: { tags: string[] }) => {
        snapshot.tags = o.tags;
        return snapshot;
      }),
      waitSnapshotReady: vi.fn(async () => {
        snapshot.state = "READY";
        return snapshot;
      }),
      getSnapshot: vi.fn(async () => snapshot),
      deleteSnapshot: vi.fn(async () => undefined),
    } as unknown as TenkiSandbox);
  });

  it("routes by id prefix", () => {
    expect(providerOf("bx_1")).toBe("ascii");
    expect(providerOf("tk_1")).toBe("tenki");
    expect(providerOf("tenki:snap")).toBe("tenki");
    expect(providerOf("template-ubuntu")).toBe("ascii");
  });

  it("tk_ ids never touch the ascii API", async () => {
    const box = await getBox("tk_s1");
    expect(box).toMatchObject({ id: "tk_s1", state: "ready" });
    const result = await command("tk_s1", "echo hi");
    expect(result).toEqual({ exitCode: 0, stdout: "hi\n", stderr: "" });
    const stopped = await stop("tk_s1");
    expect(stopped.state).toBe("stopped");
    expect(session.close).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bx_ ids still go to the ascii API", async () => {
    fetchMock.mockResolvedValueOnce(
      boxResponse({ id: "bx_1", state: "ready", url: null })
    );
    await getBox("bx_1");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/boxes/bx_1");
  });

  it("maps an ascii command the provider killed at timeout to exit 124", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          exitCode: null,
          signal: "SIGKILL",
          stdout: "partial\n",
          stderr: "",
          timedOut: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const result = await command("bx_1", "ovctl ensure", 180);
    expect(result).toEqual({
      exitCode: 124,
      stdout: "partial\n",
      stderr: "command timed out after 180s",
    });
  });

  it("hostRoute on tenki uses the preview URL with an empty token", async () => {
    const route = await hostRoute("tk_s1", 8642);
    expect(route).toEqual({ url: "https://p8642.tenki.example", token: "" });
    expect(session.exposePort).toHaveBeenCalledWith(8642, expect.anything());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hostRoute on ascii runs the host command and parses the tokened URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          exitCode: 0,
          stdout:
            "https://abc-9119.on.ascii.dev?_token=ff00\nhttps://abc-8642.on.ascii.dev?_token=aa11\n",
          stderr: "",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const route = await hostRoute("bx_1", 8642);
    expect(route).toEqual({ url: "https://abc-8642.on.ascii.dev", token: "aa11" });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)
    ) as { command: string };
    expect(body.command).toContain(".ascii/host url 8642");
    expect(body.command).toContain(
      `rm -f ${ASCII_GATEWAY_FIREWALL_MARKER}; /home/user/.ascii/host url 8642`
    );
  });

  it("parseAsciiHostedUrl fails loudly when the port is absent", () => {
    expect(() =>
      parseAsciiHostedUrl("https://abc-9119.on.ascii.dev?_token=ff00\n", 8642)
    ).toThrow(BoxApiError);
  });
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

describe("waitForHomeSteady", () => {
  it("keeps probing while the home tree is still a hydrating mount", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(commandResponse(0, "HYDRATING\n"))
        .mockResolvedValueOnce(commandResponse(0, "HYDRATING\n"))
        .mockResolvedValueOnce(commandResponse(0, "STEADY\n"));
      const settled = waitForHomeSteady("bx_1");
      await vi.advanceTimersByTimeAsync(11_000);
      await expect(settled).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up with a 504 once the deadline passes", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => commandResponse(0, "HYDRATING"));
      const settled = waitForHomeSteady("bx_1", 7_000);
      const failure = expect(settled).rejects.toMatchObject({ status: 504 });
      await vi.advanceTimersByTimeAsync(20_000);
      await failure;
    } finally {
      vi.useRealTimers();
    }
  });
});

function classify(path: string, result: CommandResult): BoxApiError | string {
  try {
    return classifyReadFile(path, result);
  } catch (error) {
    if (error instanceof BoxApiError) return error;
    throw error;
  }
}

/** What the Box command endpoint would hand back for `readFileCommand(path)`. */
function runLocally(
  path: string,
  options: { cwd?: string; env?: Record<string, string> } = {}
): CommandResult {
  const run = spawnSync("sh", ["-c", readFileCommand(path)], {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
  return { exitCode: run.status ?? -1, stdout: run.stdout, stderr: run.stderr };
}

describe("readFile", () => {
  it("sends a C-locale, single-quoted cat and returns stdout on success", async () => {
    fetchMock.mockResolvedValueOnce(commandResponse(0, "[1]"));
    await expect(readFile("bx_1", "/home/user/a $(id) b.json")).resolves.toBe("[1]");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      command: string;
    };
    expect(body.command).toBe("LC_ALL=C cat '/home/user/a $(id) b.json'");
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
      {
        exitCode: 1,
        stdout: "",
        stderr: "cat: No such file or directory/x: Permission denied\n",
      },
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
      const result = runLocally(missing, {
        env: { LANG: "fr_FR.UTF-8", LC_ALL: "fr_FR.UTF-8" },
      });
      expect(result.exitCode).toBe(1);
      expect((classify(missing, result) as BoxApiError).status).toBe(404);
    });

    it("passes shell metacharacters and quotes through as literal path bytes", () => {
      const hostile = join(dir, "it's $(touch ran) `touch ran` \\ $HOME.json");
      writeFileSync(hostile, "ok");
      expect(classify(hostile, runLocally(hostile, { cwd: dir }))).toBe("ok");
      expect(existsSync(join(dir, "ran"))).toBe(false);
    });

    it("a path that spells ENOENT is still classified by cat's own errno", () => {
      const locked = join(dir, "locked");
      mkdirSync(locked);
      const path = join(locked, "No such file or directory");
      writeFileSync(path, "[]");
      chmodSync(locked, 0o000);
      const result = runLocally(path);
      if (result.exitCode === 0) {
        expect(process.getuid?.()).toBe(0);
        return;
      }
      expect((classify(path, result) as BoxApiError).status).toBe(500);
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
