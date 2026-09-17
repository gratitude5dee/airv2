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

const finalize = vi.hoisted(() => ({ applyFinalize: vi.fn() }));
vi.mock("@/lib/create/finalize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/finalize")>()),
  applyFinalize: finalize.applyFinalize,
}));

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { IntakeError } from "@/lib/create/intake";
import { FinalizeError } from "@/lib/create/finalize";
import { POST } from "./route";

const applied = { decision_id: "dec-1", stage: "decision_sent", store: "listed", mirror: true };

function post(body: unknown, token?: string): NextRequest {
  return new NextRequest("https://air.test/api/create/finalize", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { app: "promo", name: "Promo", description: "A tour page" };

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  finalize.applyFinalize.mockResolvedValue(applied);
});

describe("POST /api/create/finalize", () => {
  it("401 without a session or gateway token", async () => {
    const response = await POST(post(valid));
    expect(response.status).toBe(401);
    expect(finalize.applyFinalize).not.toHaveBeenCalled();
  });

  it("applies for the owner's Box with the defaults filled in", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(post(valid, "gw-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(applied);
    expect(finalize.applyFinalize).toHaveBeenCalledWith(expect.anything(), "user-alice", {
      ...valid,
      mirror: true,
      store: "listed",
    });
  });

  it("applies for the store session with explicit switches and an icon_key", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const body = { ...valid, mirror: false, store: "unlisted", icon_key: `apps/alice-promo/icon/${"a".repeat(64)}.png` };
    const response = await POST(post(body));
    expect(response.status).toBe(200);
    expect(finalize.applyFinalize).toHaveBeenCalledWith(expect.anything(), "user-alice", body);
  });

  it("400 on schema errors: bad json, missing name, too long, unknown key, bad store", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await POST(post("{not json"))).status).toBe(400);
    const missing = await POST(post({ app: "promo", description: "x" }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: "invalid request", issues: [{ path: "name" }] });
    expect((await POST(post({ ...valid, name: "n".repeat(61) }))).status).toBe(400);
    expect((await POST(post({ ...valid, description: "d".repeat(161) }))).status).toBe(400);
    expect((await POST(post({ ...valid, store: "featured" }))).status).toBe(400);
    expect((await POST(post({ ...valid, mirror: "yes" }))).status).toBe(400);
    expect((await POST(post({ ...valid, plan: "owner prose" }))).status).toBe(400);
    expect(finalize.applyFinalize).not.toHaveBeenCalled();
  });

  it("409 not_ready with reasons when the app has no dev release or the stage is wrong", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    finalize.applyFinalize.mockRejectedValueOnce(new FinalizeError("not_ready", 409, ["no_dev_release"]));
    const response = await POST(post(valid));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "not_ready", reasons: ["no_dev_release"] });
    finalize.applyFinalize.mockRejectedValueOnce(new FinalizeError("not_ready", 409, ["stage:building"]));
    expect(await (await POST(post(valid))).json()).toEqual({ error: "not_ready", reasons: ["stage:building"] });
  });

  it("404 for someone else's app, same as a missing one; intake errors keep their status", async () => {
    session.storeSessionUserId.mockReturnValue("user-bob");
    finalize.applyFinalize.mockRejectedValueOnce(new PublishError("app not found", 404));
    const response = await POST(post(valid));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "app not found" });
    finalize.applyFinalize.mockRejectedValueOnce(new IntakeError("the intake moved underneath you; reload", 409));
    expect((await POST(post(valid))).status).toBe(409);
    finalize.applyFinalize.mockRejectedValueOnce(new FinalizeError("invalid icon_key", 400));
    const icon = await POST(post(valid));
    expect(icon.status).toBe(400);
    expect(await icon.json()).toEqual({ error: "invalid icon_key" });
  });
});
