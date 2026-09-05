import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  air,
  BindingError,
  RUNTIME_MODELS,
  RUNTIME_ORIGIN,
  Router,
  RuntimeError,
  user,
  type AirEnv,
  type ExecutionContext,
} from "../../../../packages/air-functions/src/index";

const ctx: ExecutionContext = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function req(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe("@air/functions user()", () => {
  it("reads the Dispatcher's identity headers", () => {
    const u = user(
      req("https://x/api", {
        headers: {
          "X-Air-Principal": "p_abc",
          "X-Air-Role": "guest",
          "X-Air-App": "alice-rsvp",
          "X-Air-Version": "v1700000000000",
        },
      })
    );
    expect(u).toEqual({ principal: "p_abc", role: "guest", app: "alice-rsvp", version: "v1700000000000" });
  });

  it("degrades to anon when the headers are missing or unknown", () => {
    expect(user(req("https://x/")).role).toBe("anon");
    expect(user(req("https://x/", { headers: { "X-Air-Role": "root" } })).role).toBe("anon");
  });
});

describe("@air/functions router", () => {
  const env: AirEnv = {};

  it("routes by method and path with params; 404 otherwise", async () => {
    const app = new Router()
      .get("/api/items/:id", (c) => c.json({ id: c.params["id"], role: c.user.role }))
      .post("/api/rsvp", async (c) => c.json(await c.body(), 201));
    const got = await app.fetch(req("https://x/api/items/42", { headers: { "X-Air-Role": "owner" } }), env, ctx);
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual({ id: "42", role: "owner" });
    const posted = await app.fetch(
      req("https://x/api/rsvp", { method: "POST", body: JSON.stringify({ going: true }) }),
      env,
      ctx
    );
    expect(posted.status).toBe(201);
    expect(await posted.json()).toEqual({ going: true });
    expect((await app.fetch(req("https://x/nope"), env, ctx)).status).toBe(404);
    expect((await app.fetch(req("https://x/api/rsvp"), env, ctx)).status).toBe(404);
  });

  it("is a module Worker: export default app works because fetch is a property", async () => {
    const app = new Router().all("/*", (c) => c.text("ok"));
    const { fetch } = app;
    expect((await fetch(req("https://x/anything/here"), env, ctx)).status).toBe(200);
  });

  it("turns a missing DB/KV binding into a 500 that names the fix, not a crash", async () => {
    const app = new Router().get("/api/db", (c) => {
      c.db.prepare("select 1");
      return c.text("unreachable");
    });
    const got = await app.fetch(req("https://x/api/db"), env, ctx);
    expect(got.status).toBe(500);
    expect((await got.json()).error).toMatch(/"db": true/);
    expect(() => air.kv(env)).toThrow(BindingError);
  });

  it("hides handler exceptions (no stack in the body)", async () => {
    const app = new Router().get("/boom", () => {
      throw new Error("secret-ish detail");
    });
    const got = await app.fetch(req("https://x/boom"), env, ctx);
    expect(got.status).toBe(500);
    expect(await got.text()).not.toContain("secret-ish");
  });
});

describe("@air/functions runtime API", () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ state: { n: 1 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  afterEach(() => {
    calls.length = 0;
  });

  it("targets https://air.internal only", async () => {
    await air.ai.chat({ model: "fast", messages: [{ role: "user", content: "hi" }] });
    await air.state.get("guests");
    await air.state.put("guests", { n: 2 });
    await air.actions.append("rsvp", { going: true });
    await air.media.put(new Uint8Array([1, 2, 3]), { filename: "a.png", contentType: "image/png" });
    expect(calls).toHaveLength(5);
    for (const call of calls) expect(new URL(call.url).origin).toBe(RUNTIME_ORIGIN);
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/v1/chat/completions",
      "/v1/state",
      "/v1/state",
      "/v1/actions",
      "/v1/media",
    ]);
    expect(new URL(calls[1]!.url).searchParams.get("resource")).toBe("guests");
    expect(calls[2]!.init?.method).toBe("PUT");
    expect(new URL(calls[4]!.url).searchParams.get("filename")).toBe("a.png");
  });

  it("never sends an X-Air-* header or a bearer token from user code", async () => {
    await air.ai.chat({ model: "deep", messages: [] });
    await air.state.put("s", {});
    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      for (const [name] of headers) expect(name.toLowerCase().startsWith("x-air-")).toBe(false);
      expect(headers.has("authorization")).toBe(false);
    }
  });

  it("refuses an unknown model before any request leaves", async () => {
    await expect(
      air.ai.chat({ model: "gpt-4o" as (typeof RUNTIME_MODELS)[number], messages: [] })
    ).rejects.toThrow(/fast\|balanced\|deep/);
    expect(calls).toHaveLength(0);
  });

  it("rejects bad resource names and surfaces control-plane errors typed", async () => {
    await expect(air.state.get("../etc")).rejects.toThrow(/resource/);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));
    await expect(air.state.put("s", {})).rejects.toBeInstanceOf(RuntimeError);
  });
});

describe("vendored SDK copy", () => {
  it("packages/create-kit/functions/index.ts is byte-identical to the SDK source", () => {
    const root = path.resolve(__dirname, "..", "..", "..", "..", "packages");
    const source = fs.readFileSync(path.join(root, "air-functions", "src", "index.ts"));
    const vendored = fs.readFileSync(path.join(root, "create-kit", "functions", "index.ts"));
    expect(vendored.equals(source)).toBe(true);
  });

  it("the SDK has no imports (nothing to fetch at build time)", () => {
    const root = path.resolve(__dirname, "..", "..", "..", "..", "packages");
    const source = fs.readFileSync(path.join(root, "air-functions", "src", "index.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });
});
