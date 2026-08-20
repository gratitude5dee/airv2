/**
 * P1-1: the gateway proxies exactly one POST path — chat/completions, the
 * only endpoint it meters. Every other subpath 404s so the platform key can
 * never be spent unmetered. P1-2: a stale spend window resets before the
 * cap is evaluated.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const entitlementRow: Record<string, unknown> = {};
const entitlementUpdates: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: (table: string) => {
      if (table === "boxes") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: value === "good-token" ? { user_id: "user-1" } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "entitlements") {
        const updateChain = {
          eq: () => updateChain,
          select: async () => ({ data: [{ user_id: "user-1" }], error: null }),
        };
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: entitlementRow, error: null }),
            }),
          }),
          update: (values: Record<string, unknown>) => {
            entitlementUpdates.push(values);
            return updateChain;
          },
        };
      }
      throw new Error(`fake supabase: unexpected table ${table}`);
    },
    rpc: async () => ({ error: null }),
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    modelProviderBaseUrl: () => "https://upstream.example/v1",
    modelProviderApiKey: () => "upstream-key",
  },
}));

import { POST } from "./route";

function post(path: string[], body: unknown = { messages: [] }): [NextRequest, { params: Promise<{ path: string[] }> }] {
  const request = new NextRequest(`https://air.example/api/gateway/v1/${path.join("/")}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer good-token",
      "content-type": "application/json",
    },
  });
  return [request, { params: Promise.resolve({ path }) }];
}

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

beforeEach(() => {
  entitlementUpdates.length = 0;
  Object.assign(entitlementRow, {
    speed_tier: "balanced",
    monthly_cap_usd: "20.00",
    spend_mtd_usd: "0.0000",
    spend_period_start: currentMonthStart(),
    suspended_reason: null,
  });
  vi.restoreAllMocks();
});

describe("POST /api/gateway/v1/[...path]", () => {
  it("404s any non-allowlisted subpath before touching the upstream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const path of [["responses"], ["embeddings"], ["images", "generations"], ["audio", "speech"]]) {
      const res = await POST(...post(path));
      expect(res.status).toBe(404);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("429s at the cap on chat/completions", async () => {
    entitlementRow.spend_mtd_usd = "20.0000";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(...post(["chat", "completions"]));
    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rolls a stale spend period and evaluates the cap against the reset value", async () => {
    entitlementRow.spend_mtd_usd = "20.0000";
    entitlementRow.spend_period_start = "2020-01-01T00:00:00Z";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "boom" }), { status: 502 })
      );
    const res = await POST(...post(["chat", "completions"]));
    // Over-cap spend from a past month no longer 429s: the window rolled.
    expect(res.status).toBe(502);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(entitlementUpdates).toHaveLength(1);
    expect(entitlementUpdates[0]).toMatchObject({ spend_mtd_usd: 0 });
  });
});
