import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BoxApiError,
  READ_FILE_MISSING_EXIT,
  deleteBox,
  getBox,
  readFile,
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

async function readError(): Promise<BoxApiError> {
  try {
    await readFile("bx_1", "/home/user/.hermes/miniapps/party/actions.json");
  } catch (error) {
    if (error instanceof BoxApiError) return error;
    throw error;
  }
  throw new Error("readFile resolved");
}

describe("readFile", () => {
  it("probes for the path before cat so a missing file has its own exit code", async () => {
    fetchMock.mockResolvedValueOnce(commandResponse(0, "[1]"));
    await expect(readFile("bx_1", "/home/user/a b.json")).resolves.toBe("[1]");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      command: string;
    };
    expect(body.command).toBe(
      `[ -e "/home/user/a b.json" ] || exit ${READ_FILE_MISSING_EXIT}; cat "/home/user/a b.json"`
    );
  });

  it("maps only the missing-path exit to 404", async () => {
    fetchMock.mockResolvedValueOnce(commandResponse(READ_FILE_MISSING_EXIT));
    expect((await readError()).status).toBe(404);
  });

  it("surfaces permission, I/O and killed reads as 500, never 404", async () => {
    for (const [exitCode, stderr] of [
      [1, "cat: actions.json: Permission denied"],
      [1, "cat: actions.json: Input/output error"],
      [137, ""],
      [124, "timed out"],
    ] as const) {
      fetchMock.mockResolvedValueOnce(commandResponse(exitCode, "", stderr));
      const error = await readError();
      expect(error.status).toBe(500);
      expect(error.message).toContain(`exit ${exitCode}`);
    }
  });
});
