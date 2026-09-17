/**
 * The generic resolution at the end of POST is conditional on the row still
 * being pending. When a concurrent request resolved it first, the loser must
 * not report success for a choice that was never recorded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

type Row = Record<string, unknown>;

let decisions: Row[] = [];
let updateError: { message: string } | null = null;
/** Runs after the route's pending check and before its conditional update. */
let beforeUpdate: (() => void) | null = null;

function fakeSupabase() {
  function builder() {
    const filters: ((row: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const matches = () => decisions.filter((row) => filters.every((f) => f(row)));
    const chain = {
      select: () => chain,
      update(values: Row) {
        patch = values;
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      async maybeSingle() {
        return { data: matches()[0] ?? null, error: null };
      },
      then(
        resolve: (result: {
          data: Row[] | null;
          error: { message: string } | null;
        }) => void,
      ) {
        if (!patch) return resolve({ data: matches(), error: null });
        if (updateError) return resolve({ data: null, error: updateError });
        beforeUpdate?.();
        const hit = matches();
        for (const row of hit) Object.assign(row, patch);
        resolve({ data: hit, error: null });
      },
    };
    return chain;
  }
  return { from: builder };
}

vi.mock("@/lib/supabase", () => ({ serviceClient: () => fakeSupabase() }));
vi.mock("@/lib/auth/user", () => ({ sessionUserId: () => "user-1" }));
// V12 §9.3: the publish branch flips status and runs the finalize hook.
const publish = vi.hoisted(() => ({
  setPublishStatus: vi.fn(async (): Promise<void> => undefined),
}));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  setPublishStatus: publish.setPublishStatus,
}));
const finalize = vi.hoisted(() => ({
  onPublishDecision: vi.fn(async (): Promise<void> => undefined),
  PUBLISH_DECISION_KIND: "miniapp_publish",
}));
vi.mock("@/lib/create/finalize", () => finalize);
vi.mock("@/lib/security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/limits")>()),
  recordOpsEvent: vi.fn(async () => undefined),
}));

function post(action: "approve" | "dismiss"): NextRequest {
  return new NextRequest("https://air.test/api/decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "decision-1", action }),
  });
}

describe("POST /api/decisions generic resolution", () => {
  beforeEach(() => {
    decisions = [
      {
        id: "decision-1",
        user_id: "user-1",
        kind: "note",
        ref: null,
        status: "pending",
        payload: {},
      },
    ];
    updateError = null;
    beforeUpdate = null;
  });

  it("records the choice while the row is still pending", async () => {
    const response = await POST(post("dismiss"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(decisions[0]).toMatchObject({ status: "dismissed" });
    expect(decisions[0]?.["resolved_at"]).toEqual(expect.any(String));
  });

  it("a loser whose choice was already recorded by the winner is ok", async () => {
    beforeUpdate = () => {
      decisions[0]!["status"] = "dismissed";
      decisions[0]!["resolved_at"] = "2026-01-01T00:00:00.000Z";
    };
    const response = await POST(post("dismiss"));
    expect(response.status).toBe(200);
    expect(decisions[0]?.["resolved_at"]).toBe("2026-01-01T00:00:00.000Z");
  });

  it("a loser whose choice contradicts the recorded one is a 409, not ok", async () => {
    beforeUpdate = () => {
      decisions[0]!["status"] = "approved";
      decisions[0]!["resolved_at"] = "2026-01-01T00:00:00.000Z";
    };
    const response = await POST(post("dismiss"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("already resolved"),
    });
    expect(decisions[0]).toMatchObject({
      status: "approved",
      resolved_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("a failed update is a 500, not ok", async () => {
    updateError = { message: "connection reset" };
    const response = await POST(post("approve"));
    expect(response.status).toBe(500);
    expect(decisions[0]).toMatchObject({ status: "pending" });
  });
});

describe("POST /api/decisions — miniapp_publish (V12 §9.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publish.setPublishStatus.mockResolvedValue(undefined);
    decisions = [
      {
        id: "decision-1",
        user_id: "user-1",
        kind: "miniapp_publish",
        ref: "alice-tour",
        status: "pending",
        payload: { channel: "production", store: "listed", mirror: true },
      },
    ];
    updateError = null;
    beforeUpdate = null;
  });

  it("approve flips status, records the event and runs the hook", async () => {
    const response = await POST(post("approve"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, published: true });
    expect(publish.setPublishStatus).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "alice-tour",
      "published"
    );
    expect(finalize.onPublishDecision).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "alice-tour",
      "approved",
      [expect.objectContaining({ id: "decision-1" })]
    );
    expect(decisions[0]).toMatchObject({ status: "approved" });
  });

  it("dismiss never publishes and tells the hook it was declined", async () => {
    const response = await POST(post("dismiss"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, published: false });
    expect(publish.setPublishStatus).not.toHaveBeenCalled();
    expect(finalize.onPublishDecision).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "alice-tour",
      "declined",
      expect.anything()
    );
    expect(decisions[0]).toMatchObject({ status: "dismissed" });
  });

  it("a row someone else already resolved is a 404 and publishes nothing", async () => {
    decisions[0]!["status"] = "approved";
    const response = await POST(post("approve"));
    expect(response.status).toBe(404);
    expect(publish.setPublishStatus).not.toHaveBeenCalled();
    expect(finalize.onPublishDecision).not.toHaveBeenCalled();
  });

  it("a failed flip reports the publish error and still leaves the row resolved", async () => {
    const { PublishError } = await import("@/lib/miniapps/publish");
    publish.setPublishStatus.mockRejectedValue(new PublishError("upload a bundle before publishing", 409));
    const response = await POST(post("approve"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("upload a bundle"),
    });
    expect(finalize.onPublishDecision).not.toHaveBeenCalled();
  });
});
