import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteBox, getBox } from "./client";

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
