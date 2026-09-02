/**
 * The publisher can only post to the five slot platforms, so a plan naming
 * anything else must fail at the door rather than reaching the owner as an
 * approvable calendar it can never execute.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proposeAgentPlan } from "@/lib/publish/agentPlan";
import { POST } from "./route";

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/auth/box", () => ({
  boxUserId: () => Promise.resolve("user-1"),
}));
vi.mock("@/lib/publish/agentPlan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/publish/agentPlan")>()),
  proposeAgentPlan: vi.fn(),
}));

function post(platform: string): NextRequest {
  return new NextRequest("https://air.test/api/content/plan", {
    method: "POST",
    headers: { authorization: "Bearer tok", "content-type": "application/json" },
    body: JSON.stringify({
      label: "Launch week",
      timezone: "UTC",
      steps: [
        {
          platform,
          brief: "teaser",
          scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      ],
    }),
  });
}

describe("POST /api/content/plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(proposeAgentPlan).mockResolvedValue({
      momentId: "moment-1",
      decisionId: "decision-1",
      slots: 1,
    });
  });

  it("stages a plan for a supported platform", async () => {
    const response = await POST(post("instagram"));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      status: "pending_approval",
      decision_id: "decision-1",
    });
  });

  it("rejects a platform the publisher cannot post to", async () => {
    const response = await POST(post("threads"));
    expect(response.status).toBe(400);
    expect(vi.mocked(proposeAgentPlan)).not.toHaveBeenCalled();
  });
});
