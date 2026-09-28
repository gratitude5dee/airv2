import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const state = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
}));
const allPanels = vi.hoisted(() => vi.fn());
const windowStart = vi.hoisted(() => vi.fn(() => "2026-08-01T00:00:00.000Z"));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => state.fake.client(),
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
  state.fake = new FakeSupabase();
  state.fake.tables["boxes"] = [{ user_id: "user-1", gateway_token: "box-token" }];
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
    if (token === "unknown-token") state.fake.tables["boxes"] = [];
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
