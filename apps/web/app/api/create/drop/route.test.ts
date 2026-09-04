/**
 * V11 §14.1 /api/create/drop: the two entries share one pipeline; the Box
 * entry pulls bytes over the command lane under BOX_PATH_RE discipline, the
 * owner entry mirrors /api/mini/publish/bundle's limits and error shapes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";
import { makeZip } from "@/lib/create/zip-test-utils";

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

const limits = vi.hoisted(() => ({
  dropRateLimited: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);

vi.mock("@/lib/storage/r2", () => ({ r2Configured: () => true }));

const compute = vi.hoisted(() => ({
  command: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));
vi.mock("@/lib/box/client", () => ({ command: compute.command }));
vi.mock("@/lib/orchestrator/boxes", () => ({ ensureBoxAwake: compute.ensureBoxAwake }));

const versions = vi.hoisted(() => ({
  uploadVersion: vi.fn(async () => "v1700000000000"),
}));
vi.mock("@/lib/create/versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/versions")>()),
  uploadVersion: versions.uploadVersion,
}));

vi.mock("@/lib/create/preview", () => ({
  draftPreviewUrl: () => "https://alice-promo.apps.wzrd.tech/__air/enter?t=x",
}));

const app = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  status: "draft",
  visibility: "unlisted",
});
const publish = vi.hoisted(() => ({
  createDraft: vi.fn(async () => ({ id: "app-alice-promo", slug: "alice-promo", name: "Promo" })),
  ownedApp: vi.fn(),
  publisherUsername: vi.fn(async () => "alice"),
}));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  createDraft: publish.createDraft,
  ownedApp: publish.ownedApp,
  publisherUsername: publish.publisherUsername,
}));
vi.mock("@/lib/miniapps/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/registry")>()),
  getRegistryApp: vi.fn(async () => null),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const CLEAN = "<!doctype html><html><body><h1>hi</h1></body></html>";

function boxRequest(body: Record<string, unknown>, token = "gw-1"): NextRequest {
  return new NextRequest("https://air.test/api/create/drop", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sessionRequest(fields: Record<string, string | File>): NextRequest {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest("https://air.test/api/create/drop", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  publish.ownedApp.mockResolvedValue(app);
});

describe("POST /api/create/drop — auth", () => {
  it("401 without a store session or gateway token", async () => {
    const response = await POST(boxRequest({ path: "/home/user/site.zip" }, ""));
    expect(response.status).toBe(401);
    expect(compute.command).not.toHaveBeenCalled();
  });
});

describe("POST /api/create/drop — Box entry", () => {
  beforeEach(() => {
    box.boxUserId.mockResolvedValue("user-alice");
  });

  it.each([
    "/etc/passwd",
    "/home/user/../root/x.zip",
    "/home/user/a;rm -rf /.zip",
    "home/user/site.zip",
    "/home/user/",
    "",
  ])("rejects a path outside BOX_PATH_RE before touching the Box: %s", async (path) => {
    const response = await POST(boxRequest({ path }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid path" });
    expect(compute.ensureBoxAwake).not.toHaveBeenCalled();
    expect(compute.command).not.toHaveBeenCalled();
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "upload_rejected",
      "user-alice",
      "invalid path"
    );
  });

  it("pulls the file over the command lane and stages a draft", async () => {
    const zip = makeZip([{ name: "index.html", data: CLEAN }]);
    compute.command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: zip.toString("base64"),
      stderr: "",
    });
    const response = await POST(boxRequest({ path: "/home/user/promo site.zip" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      slug: "alice-promo",
      version: "v1700000000000",
      preview_url: expect.stringContaining("/__air/enter?t="),
      findings: [],
    });
    expect(compute.command).toHaveBeenCalledWith(
      "box-1",
      expect.stringContaining('"/home/user/promo site.zip" | base64 -w0'),
      expect.any(Number)
    );
    expect(publish.createDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", {
      appname: "promo-site",
      name: "Promo Site",
      description: "",
      lane: "drop",
    });
    expect(versions.uploadVersion).toHaveBeenCalledWith(
      expect.anything(),
      app,
      expect.any(Array),
      "drop",
      { findings: [], promote: false }
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.drop",
      "user-alice",
      "box:alice-promo",
      zip.length
    );
  });

  it("a missing Box file is a 404, not a 500", async () => {
    compute.command.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "no such file" });
    const response = await POST(boxRequest({ path: "/home/user/missing.html" }));
    expect(response.status).toBe(404);
    expect(versions.uploadVersion).not.toHaveBeenCalled();
  });

  it("a hard CSP failure returns one line and the findings", async () => {
    compute.command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: Buffer.from(
        '<!doctype html><html><body><script>localStorage.setItem("a", "b")</script></body></html>'
      ).toString("base64"),
      stderr: "",
    });
    const response = await POST(boxRequest({ path: "/home/user/promo.html" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; findings: unknown[] };
    expect(body.error).not.toContain("\n");
    expect(body.error).toMatch(/client-storage/);
    expect(body.findings).toHaveLength(1);
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "upload_rejected",
      "user-alice",
      body.error
    );
  });

  it("429 before the Box is touched when over the upload budget", async () => {
    limits.dropRateLimited.mockResolvedValueOnce(true);
    const response = await POST(boxRequest({ path: "/home/user/site.zip" }));
    expect(response.status).toBe(429);
    expect(compute.command).not.toHaveBeenCalled();
  });
});

describe("POST /api/create/drop — owner entry", () => {
  beforeEach(() => {
    session.storeSessionUserId.mockReturnValue("user-alice");
  });

  it("stages a multipart html file as index.html", async () => {
    const response = await POST(
      sessionRequest({
        file: new File([CLEAN], "promo.html", { type: "text/html" }),
        name: "My promo",
      })
    );
    expect(response.status).toBe(200);
    expect(box.boxUserId).not.toHaveBeenCalled();
    expect(publish.createDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", {
      appname: "promo",
      name: "My promo",
      description: "",
      lane: "drop",
    });
    const [, , files] = versions.uploadVersion.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { path: string }[],
    ];
    expect(files.map((f) => f.path)).toEqual(["index.html"]);
  });

  it("400 without a file, 413 over the bundle cap", async () => {
    expect((await POST(sessionRequest({ appname: "promo" }))).status).toBe(400);
    const big = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "site.zip");
    const response = await POST(sessionRequest({ file: big }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "bundle too large" });
  });

  it("a service-worker zip is refused by the bundle contract", async () => {
    const zip = makeZip([
      {
        name: "index.html",
        data: '<!doctype html><script>navigator.serviceWorker.register("/sw.js")</script>',
      },
      { name: "sw.js", data: "self.addEventListener('fetch', () => {})" },
    ]);
    const response = await POST(
      sessionRequest({ file: new File([new Uint8Array(zip)], "site.zip"), appname: "promo" })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/service workers are not allowed/);
    expect(publish.createDraft).not.toHaveBeenCalled();
  });
});
