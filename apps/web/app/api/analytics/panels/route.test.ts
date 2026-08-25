import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
}));
const allPanels = vi.hoisted(() => vi.fn());
const windowStart = vi.hoisted(() => vi.fn(() => "2026-08-01T00:00:00.000Z"));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: () => {
      const chain: Record<string, (...args: unknown[]) => unknown> = {};
      chain["select"] = () => chain;
      chain["eq"] = () => chain;
      chain["maybeSingle"] = async () => ({
        data: state.userId ? { user_id: state.userId } : null,
        error: null,
      });
      return chain;
    },
  }),
}));
vi.mock("@/lib/miniapps/analytics", () => ({ allPanels, windowStart }));

import {
  allPanels as mockedAllPanels,
  windowStart as mockedWindowStart,
} from "@/lib/miniapps/analytics";
import { GET } from "./route";

function analyticsRequest(token: string | null = "box-token"): NextRequest {
  return new NextRequest("https://air.test/api/analytics/panels", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  state.userId = "user-1";
  vi.mocked(mockedAllPanels).mockReset();
  vi.mocked(mockedWindowStart).mockClear();
  vi.mocked(mockedAllPanels).mockResolvedValue([
    {
      key: "agent",
      title: "Agent activity",
      note: null,
      columns: ["day"],
      rows: [],
    },
    {
      key: "ads",
      title: "Ads",
      note: null,
      columns: ["day"],
      rows: [],
    },
  ]);
});

describe("GET /api/analytics/panels", () => {
  it.each([
    ["missing bearer token", null],
    ["unknown bearer token", "unknown-token"],
  ])("rejects %s", async (_label, token) => {
    if (token === "unknown-token") state.userId = null;
    const response = await GET(analyticsRequest(token));
    expect(response.status).toBe(401);
  });

  it("returns panels from the read-only analytics library", async () => {
    const response = await GET(analyticsRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      since: "2026-08-01T00:00:00.000Z",
      panels: [
        expect.objectContaining({ key: "agent" }),
        expect.objectContaining({ key: "ads" }),
      ],
    });
    expect(mockedWindowStart).toHaveBeenCalledOnce();
    expect(mockedAllPanels).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "2026-08-01T00:00:00.000Z"
    );
  });

  it("maps analytics read failures to a generic 502", async () => {
    vi.mocked(mockedAllPanels).mockRejectedValueOnce(new Error("db secret"));
    const response = await GET(analyticsRequest());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "analytics unavailable" });
  });
});
