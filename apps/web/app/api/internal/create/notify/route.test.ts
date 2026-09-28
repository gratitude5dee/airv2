/**
 * R-TQ-07: the Vercel↔Worker create bridge, exercised through the notify
 * adapter route. Every case signs (or mis-signs) the raw body the same way
 * the Worker does — ts + HMAC-SHA256 over `${ts}.${method}.${path}.${sha}`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const responses: Record<string, { data: unknown; error: unknown }[]> = {};
  function chain(table: string): Record<string, (...args: unknown[]) => unknown> {
    const ops: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "eq",
      "is",
      "order",
      "limit",
    ]) {
      ops[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return ops;
      };
    }
    for (const terminal of ["single", "maybeSingle"]) {
      ops[terminal] = async () =>
        responses[`${table}:${terminal}`]?.shift() ??
        responses[`${table}:always`]?.[0] ?? { data: null, error: null };
    }
    return ops;
  }
  return { calls, responses, client: { from: (t: string) => chain(t) } };
});

const sendText = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => state.client }));
vi.mock("@/lib/miniapps/registry", () => ({
  getRegistryAppById: vi.fn(async () => ({ name: "Sketch", slug: "sketch" })),
}));
vi.mock("@/lib/spectrum/sender", () => ({
  createSpectrumSender: vi.fn(async () => ({
    sendText,
    close: async () => undefined,
  })),
}));
vi.mock("@/lib/security/limits", () => ({
  recordOpsEvent: vi.fn(async () => undefined),
}));

import { bridgePayload, bridgeSign } from "@/lib/create/bridge";
import { POST } from "./route";

const PATH = "/api/internal/create/notify";
const SECRET = "bridge-secret-for-tests";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-09-25T12:00:00.000Z";

function jobRow(): Record<string, unknown> {
  return {
    id: JOB_ID,
    user_id: "user-1",
    app_id: "app-1",
    kind: "initial",
    state: "running",
    created_at: NOW,
    updated_at: NOW,
  };
}

function signed(
  body: Record<string, unknown>,
  opts: { ts?: string; secret?: string; sig?: string } = {}
): NextRequest {
  const raw = JSON.stringify(body);
  const ts = opts.ts ?? String(Math.floor(Date.now() / 1000));
  const sig =
    opts.sig ?? bridgeSign(opts.secret ?? SECRET, bridgePayload(ts, "POST", PATH, raw));
  return new NextRequest(`https://app.example${PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-air-ts": ts,
      "x-air-sig": sig,
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.calls.length = 0;
  for (const key of Object.keys(state.responses)) delete state.responses[key];
  process.env["CREATE_BRIDGE_SECRET"] = SECRET;
  state.responses["create_jobs:always"] = [{ data: jobRow(), error: null }];
  state.responses["imessage_destinations:always"] = [
    { data: { space_id: "space-1", phone: "+15551234567" }, error: null },
  ];
});

describe("POST /api/internal/create/notify bridge auth", () => {
  it("rejects unsigned requests", async () => {
    const response = await POST(
      new NextRequest(`https://app.example${PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: JOB_ID, outcome: "live" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("rejects a signature over the wrong secret", async () => {
    const response = await POST(
      signed({ job_id: JOB_ID, outcome: "live" }, { secret: "not-it" })
    );
    expect(response.status).toBe(401);
  });

  it("rejects a signature over a different body", async () => {
    const signedOther = signed({ job_id: JOB_ID, outcome: "failed" });
    const sig = signedOther.headers.get("x-air-sig") ?? "";
    const ts = signedOther.headers.get("x-air-ts") ?? "";
    const response = await POST(
      signed({ job_id: JOB_ID, outcome: "live" }, { sig, ts })
    );
    expect(response.status).toBe(401);
  });

  it("rejects timestamps outside the ±300s window", async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 301);
    const response = await POST(
      signed({ job_id: JOB_ID, outcome: "live" }, { ts: stale })
    );
    expect(response.status).toBe(401);
    expect(sendText).not.toHaveBeenCalled();
  });

  it.todo(
    // R-SEC-04 (parallel PR): the bridge has no nonce/replay store, so a
    // captured (ts, sig, body) replays within the tolerance window today.
    // When the replay fix lands this becomes a real assertion: second POST
    // with identical headers → 401 and sendText still called once.
    "rejects a replayed signature inside the tolerance window"
  );

  it("404s a job_id that does not exist", async () => {
    delete state.responses["create_jobs:always"];
    const response = await POST(
      signed({ job_id: JOB_ID, outcome: "live" })
    );
    expect(response.status).toBe(404);
  });

  it("accepts a valid signature and notifies the owner", async () => {
    const response = await POST(signed({ job_id: JOB_ID, outcome: "live" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, sent: true });
    expect(sendText).toHaveBeenCalledTimes(1);
  });
});
