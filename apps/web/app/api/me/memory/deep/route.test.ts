/**
 * Deep memory route invariants: owner session required, clear demands an
 * explicit confirm and a known scope, the reindex branch is untouched, and
 * only metadata (scope, booleans) transits the response.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ userId: undefined as string | undefined }));
vi.mock("@/lib/auth/user", () => ({
  sessionUserId: () => auth.userId,
}));

const supabaseFrom = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({ from: supabaseFrom }),
}));

vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

const deep = vi.hoisted(() => ({
  deepMemoryClear: vi.fn(async () => true),
  deepMemoryReindex: vi.fn(async () => true),
  deepMemoryStatus: vi.fn(async () => ({ healthy: true, resources: 1, workspace_bytes: 0, pending: 0 })),
}));
vi.mock("@/lib/memory/deep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/memory/deep")>()),
  ...deep,
}));

import { POST } from "./route";

const url = "https://air.test/api/me/memory/deep";

function post(body: unknown): Promise<Response> {
  return POST(new NextRequest(url, { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  auth.userId = "user-1";
  supabaseFrom.mockClear();
  deep.deepMemoryClear.mockReset().mockResolvedValue(true);
  deep.deepMemoryReindex.mockReset().mockResolvedValue(true);
});

describe("POST /api/me/memory/deep (clear)", () => {
  it("401s without a session", async () => {
    auth.userId = undefined;
    const response = await post({ action: "clear", scope: "all", confirm: true });
    expect(response.status).toBe(401);
    expect(deep.deepMemoryClear).not.toHaveBeenCalled();
  });

  it("requires confirm", async () => {
    const response = await post({ action: "clear", scope: "all" });
    expect(response.status).toBe(400);
    expect(deep.deepMemoryClear).not.toHaveBeenCalled();
  });

  it.each(["everything", "viking://user", "", 1, undefined])("rejects scope %j", async (scope) => {
    const response = await post({ action: "clear", scope, confirm: true });
    expect(response.status).toBe(400);
    expect(deep.deepMemoryClear).not.toHaveBeenCalled();
  });

  it.each(["resources", "memories", "all"] as const)("clears %s on the owner's box with confirm", async (scope) => {
    const response = await post({ action: "clear", scope, confirm: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, scope });
    expect(deep.deepMemoryClear).toHaveBeenCalledWith("box-1", scope);
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("502s with a fixed message when the box refuses", async () => {
    deep.deepMemoryClear.mockResolvedValue(false);
    const response = await post({ action: "clear", scope: "memories", confirm: true });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "deep memory clear failed" });
  });

  it("leaves the reindex branch unchanged", async () => {
    const response = await post({ action: "reindex" });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, queued: true });
    expect(deep.deepMemoryReindex).toHaveBeenCalledWith("box-1");
    expect(deep.deepMemoryClear).not.toHaveBeenCalled();
  });

  it("rejects unknown actions", async () => {
    const response = await post({ action: "forget", scope: "all", confirm: true });
    expect(response.status).toBe(400);
    expect(deep.deepMemoryClear).not.toHaveBeenCalled();
    expect(deep.deepMemoryReindex).not.toHaveBeenCalled();
  });
});
