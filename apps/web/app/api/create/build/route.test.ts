import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const box = vi.hoisted(() => ({
  boxUserId: vi.fn(async (): Promise<string | undefined> => undefined),
}));
vi.mock("@/lib/auth/box", () => box);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));
const r2 = vi.hoisted(() => ({ configured: true }));
vi.mock("@/lib/storage/r2", () => ({ r2Configured: () => r2.configured }));
const limits = vi.hoisted(() => ({
  buildRateLimited: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);

const sizes = { js: 10, css: 2, html: 3, assets: 0, total: 15, js_gzip: 5, css_gzip: 1, files: 3 };
const build = vi.hoisted(() => ({
  trackedBuild: vi.fn(),
}));
vi.mock("@/lib/create/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/build")>()),
  trackedBuild: build.trackedBuild,
}));

import { NextRequest } from "next/server";
import { BuildError, type BuildResult } from "@/lib/create/build";
import { POST } from "./route";

function post(body: unknown): NextRequest {
  return new NextRequest("https://mini.test/api/create/build", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function result(over: Partial<BuildResult> = {}): BuildResult {
  return {
    slug: "alice-countdown",
    appname: "countdown",
    version: "v1700000000001",
    preview_url: "https://alice-countdown.apps.test/__air/enter?t=x",
    url: "https://mini.test/countdown",
    findings: [],
    sizes,
    log: ["pull 3 files", "esbuild ok", "lint 0 findings"],
    status: "draft",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  r2.configured = true;
  session.storeSessionUserId.mockReturnValue("user-alice");
  box.boxUserId.mockResolvedValue(undefined);
  limits.buildRateLimited.mockResolvedValue(false);
  build.trackedBuild.mockImplementation(async () => ({
    buildId: "build-1",
    done: Promise.resolve(result()),
  }));
});

describe("POST /api/create/build", () => {
  it("401 without a store session or gateway bearer", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await POST(post({ appname: "countdown" }))).status).toBe(401);
    expect(build.trackedBuild).not.toHaveBeenCalled();
  });

  it("accepts the Box's gateway bearer and attributes the ops event to it", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(post({ appname: "countdown" }));
    expect(response.status).toBe(200);
    expect(build.trackedBuild).toHaveBeenCalledWith(expect.anything(), "user-alice", "countdown");
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.build",
      "user-alice",
      "box:alice-countdown:v1700000000001",
      15,
    );
  });

  it("400 on an appname the skill would not accept", async () => {
    expect((await POST(post({ appname: "../etc" }))).status).toBe(400);
    expect((await POST(post({ appname: "a".repeat(33) }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect(build.trackedBuild).not.toHaveBeenCalled();
  });

  it("503 when bundle storage is not configured — no build is started", async () => {
    r2.configured = false;
    expect((await POST(post({ appname: "countdown" }))).status).toBe(503);
    expect(build.trackedBuild).not.toHaveBeenCalled();
  });

  it("429 when the owner is over the build rate limit", async () => {
    limits.buildRateLimited.mockResolvedValue(true);
    expect((await POST(post({ appname: "countdown" }))).status).toBe(429);
    expect(build.trackedBuild).not.toHaveBeenCalled();
  });

  it("returns the staged draft: version, preview_url, findings, sizes, log tail", async () => {
    const response = await POST(post({ appname: "countdown" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ok: true,
      build_id: "build-1",
      slug: "alice-countdown",
      version: "v1700000000001",
      preview_url: "https://alice-countdown.apps.test/__air/enter?t=x",
      sizes,
      hard: 0,
    });
    expect(body["log"]).toEqual(["pull 3 files", "esbuild ok", "lint 0 findings"]);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.build",
      "user-alice",
      "session:alice-countdown:v1700000000001",
      15,
    );
  });

  it("400 with the findings and no version when a hard finding stopped the build", async () => {
    const findings = [
      { file: "src/main.tsx", line: 1, rule: "external-script", severity: "hard" as const, hint: "Kit only" },
    ];
    build.trackedBuild.mockImplementation(async () => ({
      buildId: "build-2",
      done: Promise.resolve(result({ version: null, preview_url: null, findings })),
    }));
    const response = await POST(post({ appname: "countdown" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false, version: null, preview_url: null, hard: 1 });
    expect(body["findings"]).toEqual(findings);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.build",
      "user-alice",
      "session:alice-countdown:no-version",
      15,
    );
  });

  it("maps a BuildError to its status and surfaces its findings", async () => {
    build.trackedBuild.mockImplementation(async () => ({
      buildId: "build-3",
      done: Promise.reject(
        new BuildError("air.json is not air.app.v1", 422, [
          { file: "air.json", line: 1, rule: "schema", severity: "hard", hint: "schema must be air.app.v1" },
        ]),
      ),
    }));
    const response = await POST(post({ appname: "countdown" }));
    expect(response.status).toBe(422);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body["error"]).toBe("air.json is not air.app.v1");
    expect(body["build_id"]).toBe("build-3");
    expect(Array.isArray(body["findings"])).toBe(true);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.build",
      "user-alice",
      "session:countdown:failed",
    );
  });

  it("202 with the build id when the build outlives the hold", async () => {
    vi.useFakeTimers();
    try {
      let finish: (value: BuildResult) => void = () => undefined;
      build.trackedBuild.mockImplementation(async () => ({
        buildId: "build-4",
        done: new Promise<BuildResult>((resolve) => {
          finish = resolve;
        }),
      }));
      const pending = POST(post({ appname: "countdown" }));
      await vi.advanceTimersByTimeAsync(60_000);
      const response = await pending;
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ ok: false, build_id: "build-4", status: "running" });
      finish(result());
      await vi.runAllTimersAsync();
    } finally {
      vi.useRealTimers();
    }
  });
});
