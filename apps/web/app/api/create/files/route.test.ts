import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
vi.mock("@/lib/orchestrator/boxes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orchestrator/boxes")>()),
  ensureBoxAwake: vi.fn(async () => ({})),
  armStopAfter: vi.fn(async () => undefined),
}));
const compute = vi.hoisted(() => ({
  loadTarget: vi.fn(async () => ({ kind: "box", boxId: "box-1" })),
  readComputeFile: vi.fn(async (): Promise<string> => "export const x = 1;\n"),
  writeComputeFile: vi.fn(async () => undefined),
  runCommand: vi.fn(async (_target: unknown, _cmd: string) => ({
    exitCode: 0,
    stdout: "120 air.json\n900 src/main.tsx\n5 .build/build.json\n7 functions/x.ts\n",
    stderr: "",
  })),
}));
vi.mock("@/lib/compute/runtime", () => compute);

import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

function get(query: string): NextRequest {
  return new NextRequest(`https://air.test/api/create/files?${query}`);
}
function put(query: string, body: unknown): NextRequest {
  return new NextRequest(`https://air.test/api/create/files?${query}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
});

describe("/api/create/files", () => {
  it("401 without the store session", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await GET(get("app=countdown&path=src/main.tsx"))).status).toBe(401);
    expect((await PUT(put("app=countdown&path=src/main.tsx", { content: "x" }))).status).toBe(401);
  });

  it("lists the workspace tree without `path`, hiding .build/ (functions/ is source since MC5)", async () => {
    const response = await GET(get("app=countdown"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      app: "countdown",
      files: [
        { path: "air.json", bytes: 120 },
        { path: "functions/x.ts", bytes: 7 },
        { path: "src/main.tsx", bytes: 900 },
      ],
    });
    expect(compute.runCommand.mock.calls[0]?.[1]).toContain('"$HOME/.hermes/create/countdown"');
    compute.runCommand.mockResolvedValueOnce({ exitCode: 3, stdout: "", stderr: "" });
    expect((await GET(get("app=countdown"))).status).toBe(404);
  });

  it("reads a workspace-rooted file from the owner's Box", async () => {
    const response = await GET(get("app=countdown&path=./src/main.tsx"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      app: "countdown",
      path: "src/main.tsx",
      content: "export const x = 1;\n",
    });
    expect(compute.readComputeFile).toHaveBeenCalledWith(
      { kind: "box", boxId: "box-1" },
      ".hermes/create/countdown/src/main.tsx"
    );
  });

  it("refuses traversal, absolute paths, and anything outside air.json/plan/src/public", async () => {
    for (const path of [
      "../other/air.json",
      "src/../../.hermes/.env",
      "/etc/passwd",
      "%2Fetc%2Fpasswd",
      ".build/qa/report.json",
      "functions/../.hermes/.env",
      "node_modules/react/index.js",
      "src/",
      "src/.env",
      "public/hero.png",
      "",
    ]) {
      const response = await GET(get(`app=countdown&path=${path}`));
      expect(response.status, path).toBe(400);
    }
    expect(compute.readComputeFile).not.toHaveBeenCalled();
    const okPlan = await GET(get("app=countdown&path=create.plan.md"));
    expect(okPlan.status).toBe(200);
  });

  it("refuses a bad app name", async () => {
    expect((await GET(get("app=Bad%20Name&path=air.json"))).status).toBe(400);
    expect((await GET(get("path=air.json"))).status).toBe(400);
  });

  it("writes text only, capped at the source limit", async () => {
    const ok = await PUT(put("app=countdown&path=src/main.tsx", { content: "hello" }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, app: "countdown", path: "src/main.tsx", bytes: 5 });
    expect(compute.writeComputeFile).toHaveBeenCalledWith(
      { kind: "box", boxId: "box-1" },
      ".hermes/create/countdown/src/main.tsx",
      "hello"
    );
    expect((await PUT(put("app=countdown&path=src/main.tsx", { content: 5 }))).status).toBe(400);
    expect((await PUT(put("app=countdown&path=src/main.tsx", { content: "a\0b" }))).status).toBe(400);
    expect(
      (await PUT(put("app=countdown&path=src/main.tsx", { content: "x".repeat(512 * 1024 + 1) }))).status
    ).toBe(413);
    expect(compute.writeComputeFile).toHaveBeenCalledTimes(1);
  });

  it("reports an oversized file on read as 413 and a missing one as 404", async () => {
    compute.readComputeFile.mockResolvedValueOnce("x".repeat(512 * 1024 + 1));
    expect((await GET(get("app=countdown&path=src/big.ts"))).status).toBe(413);
    const { BoxApiError } = await import("@/lib/box/client");
    compute.readComputeFile.mockRejectedValueOnce(new BoxApiError(404, "not found"));
    expect((await GET(get("app=countdown&path=src/nope.ts"))).status).toBe(404);
  });
});
