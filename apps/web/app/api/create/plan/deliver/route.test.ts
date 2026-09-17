import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const box = vi.hoisted(() => ({
  boxUserId: vi.fn(async (): Promise<string | undefined> => undefined),
}));
vi.mock("@/lib/auth/box", () => box);

// imessage_destinations is the only table this route touches directly.
const db = vi.hoisted(() => ({
  destination: { space_id: "space-1", phone: "+15550001" } as
    | { space_id: string; phone: string }
    | null,
}));
vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: db.destination, error: null }) }),
        }),
      }),
    }) as unknown as SupabaseClient,
}));

vi.mock("@/lib/orchestrator/boxes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orchestrator/boxes")>()),
  ensureBoxAwake: vi.fn(async () => ({})),
  armStopAfter: vi.fn(async () => undefined),
}));
const PLAN = Array.from({ length: 20 }, (_, i) => `line ${i + 1} of the plan`).join("\n");
const compute = vi.hoisted(() => ({
  loadTarget: vi.fn(async () => ({ kind: "box", boxId: "box-1" })),
  readComputeFile: vi.fn(async (): Promise<string> => ""),
}));
vi.mock("@/lib/compute/runtime", () => compute);
const cards = vi.hoisted(() => ({ sendMarkedCards: vi.fn(async () => 1) }));
vi.mock("@/lib/miniapps/cards", () => cards);
const limits = vi.hoisted(() => ({
  overLimit: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);
const spectrum = vi.hoisted(() => ({
  sendAttachment: vi.fn<
    (spaceId: string, phone: string, data: Buffer, options: { name: string; mimeType: string }) => Promise<void>
  >(async () => undefined),
  sendText: vi.fn<(spaceId: string, phone: string, body: string) => Promise<void>>(async () => undefined),
  close: vi.fn(async () => undefined),
}));
vi.mock("@/lib/spectrum/sender", () => ({
  createSpectrumSender: vi.fn(async () => spectrum),
}));

import { NextRequest } from "next/server";
import { BoxApiError } from "@/lib/box/types";
import { POST } from "./route";

// The owner's app exists in the registry; the route never reads it (the
// plan lives in the workspace named by appname), but the fixture documents
// the shape the Box is speaking about.
makeApp({ slug: "alice-promo", appname: "promo", owner_user_id: "user-alice" });

function post(body: unknown, token = "gw-1"): NextRequest {
  return new NextRequest("https://air.test/api/create/plan/deliver", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  box.boxUserId.mockResolvedValue("user-alice");
  session.storeSessionUserId.mockReturnValue(null);
  db.destination = { space_id: "space-1", phone: "+15550001" };
  compute.readComputeFile.mockResolvedValue(PLAN);
  limits.overLimit.mockResolvedValue(false);
});

describe("POST /api/create/plan/deliver", () => {
  it("401 without the Box's gateway token — a store session is not enough", async () => {
    box.boxUserId.mockResolvedValue(undefined);
    session.storeSessionUserId.mockReturnValue("user-alice");
    const response = await POST(
      new NextRequest("https://air.test/api/create/plan/deliver", {
        method: "POST",
        body: JSON.stringify({ appname: "promo", path: "plan.md" }),
      })
    );
    expect(response.status).toBe(401);
    expect(compute.readComputeFile).not.toHaveBeenCalled();
  });

  it("reads plan.md from the owner's Box and attaches it as <appname>-plan.md", async () => {
    const response = await POST(post({ appname: "promo", path: "~/.hermes/create/promo/plan.md" }));
    expect(response.status).toBe(200);
    const bytes = Buffer.byteLength(PLAN, "utf8");
    expect(await response.json()).toEqual({ delivered: "attachment", bytes });
    expect(compute.readComputeFile).toHaveBeenCalledWith(
      { kind: "box", boxId: "box-1" },
      ".hermes/create/promo/plan.md"
    );
    expect(spectrum.sendAttachment).toHaveBeenCalledWith(
      "space-1",
      "+15550001",
      expect.any(Buffer),
      { name: "promo-plan.md", mimeType: "text/markdown" }
    );
    expect(spectrum.sendText).not.toHaveBeenCalled();
    expect(spectrum.close).toHaveBeenCalled();
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "plan", "user-alice", "promo", bytes);
    // CR21: nothing logged or recorded carries the plan text.
    const logged = JSON.stringify([
      ...vi.mocked(console.log).mock.calls,
      ...vi.mocked(console.error).mock.calls,
      ...limits.recordOpsEvent.mock.calls,
    ]);
    expect(logged).not.toContain("of the plan");
  });

  it("falls back to the first 12 lines plus the create card when the attachment throws", async () => {
    spectrum.sendAttachment.mockRejectedValueOnce(new Error("media send failed"));
    const response = await POST(post({ appname: "promo", path: "plan.v2.md" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ delivered: "text" });
    const text = spectrum.sendText.mock.calls[0]?.[2] ?? "";
    expect(text.split("\n")).toHaveLength(12);
    expect(text.startsWith("line 1 of the plan")).toBe(true);
    expect(text).not.toContain("line 13");
    expect(cards.sendMarkedCards).toHaveBeenCalledWith(
      expect.anything(),
      { userId: "user-alice", spaceId: "space-1", phone: "+15550001" },
      ["create"]
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("of the plan");
  });

  it("refuses paths outside the workspace or not ending in .md", async () => {
    for (const path of [
      "../other/plan.md",
      "/etc/passwd",
      "~/.hermes/create/other/plan.md",
      "plan.txt",
      "src/../../promo/plan.md",
      ".hermes/create/promo/../secrets/plan.md",
    ]) {
      const response = await POST(post({ appname: "promo", path }));
      expect(response.status, path).toBe(400);
    }
    expect(compute.readComputeFile).not.toHaveBeenCalled();
    expect((await POST(post({ appname: "promo" }))).status).toBe(400);
    expect((await POST(post({ appname: "Bad Name", path: "plan.md" }))).status).toBe(400);
  });

  it("413 over 64 KiB, 422 when empty, 404 when the Box has no such file", async () => {
    compute.readComputeFile.mockResolvedValueOnce("x".repeat(64 * 1024 + 1));
    expect((await POST(post({ appname: "promo", path: "plan.md" }))).status).toBe(413);
    compute.readComputeFile.mockResolvedValueOnce("");
    expect((await POST(post({ appname: "promo", path: "plan.md" }))).status).toBe(422);
    compute.readComputeFile.mockRejectedValueOnce(new BoxApiError(404, "not found"));
    expect((await POST(post({ appname: "promo", path: "plan.md" }))).status).toBe(404);
    expect(spectrum.sendAttachment).not.toHaveBeenCalled();
  });

  it("409 when the owner has no iMessage thread; 429 over the plan limit", async () => {
    db.destination = null;
    expect((await POST(post({ appname: "promo", path: "plan.md" }))).status).toBe(409);
    expect(compute.readComputeFile).not.toHaveBeenCalled();
    db.destination = { space_id: "space-1", phone: "+15550001" };
    limits.overLimit.mockResolvedValueOnce(true);
    expect((await POST(post({ appname: "promo", path: "plan.md" }))).status).toBe(429);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "rate_limited", "user-alice", "plan");
  });
});
