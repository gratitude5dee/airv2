/**
 * The generic resolution at the end of POST is conditional on the row still
 * being pending. When a concurrent request resolved it first, the loser must
 * not report success for a choice that was never recorded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

type Row = Record<string, unknown>;

let decisions: Row[] = [];
let updateError: { message: string } | null = null;
/** Runs after the route's pending check and before its conditional update. */
let beforeUpdate: (() => void) | null = null;

const sessionUserId = vi.hoisted(() => vi.fn(() => "user-1" as string | null));

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
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return chain;
      },
      gte(column: string, value: unknown) {
        filters.push((row) => (row[column] as string) >= (value as string));
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
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
vi.mock("@/lib/auth/user", () => ({ sessionUserId }));
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
    sessionUserId.mockReturnValue("user-1");
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
    sessionUserId.mockReturnValue("user-1");
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

// R-TQ-06: auth + ownership on the Needs-you queue — the session user is the
// only selector ever applied to the decisions table.
describe("GET /api/decisions", () => {
  beforeEach(() => {
    sessionUserId.mockReturnValue("user-1");
    decisions = [
      {
        id: "d-pending",
        user_id: "user-1",
        kind: "note",
        status: "pending",
        created_at: "2026-09-01T00:00:00.000Z",
        payload: {},
      },
      {
        id: "d-other-user",
        user_id: "user-2",
        kind: "note",
        status: "pending",
        created_at: "2026-09-01T00:00:00.000Z",
        payload: {},
      },
      {
        id: "d-resolved",
        user_id: "user-1",
        kind: "note",
        status: "approved",
        created_at: "2026-09-01T00:00:00.000Z",
        resolved_at: new Date().toISOString(),
        payload: {},
      },
    ];
  });

  it("rejects unauthenticated callers with 401", async () => {
    sessionUserId.mockReturnValue(null);
    const response = await GET(new NextRequest("https://air.test/api/decisions"));
    expect(response.status).toBe(401);
  });

  it("lists only the session user's pending decisions", async () => {
    const response = await GET(new NextRequest("https://air.test/api/decisions"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decisions.map((d: Row) => d["id"])).toEqual(["d-pending"]);
  });

  it("?status=resolved returns approved/dismissed receipts, not pending rows", async () => {
    const response = await GET(
      new NextRequest("https://air.test/api/decisions?status=resolved"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decisions.map((d: Row) => d["id"])).toEqual(["d-resolved"]);
  });
});

describe("POST /api/decisions — auth and ownership", () => {
  beforeEach(() => {
    sessionUserId.mockReturnValue("user-1");
    decisions = [
      {
        id: "decision-1",
        user_id: "user-2",
        kind: "note",
        ref: null,
        status: "pending",
        payload: {},
      },
    ];
    updateError = null;
    beforeUpdate = null;
  });

  it("rejects unauthenticated callers with 401", async () => {
    sessionUserId.mockReturnValue(null);
    const response = await POST(post("approve"));
    expect(response.status).toBe(401);
    expect(decisions[0]).toMatchObject({ status: "pending" });
  });

  it("404s another user's decision and never resolves it", async () => {
    const response = await POST(post("approve"));
    expect(response.status).toBe(404);
    expect(decisions[0]).toMatchObject({ status: "pending" });
  });
});
