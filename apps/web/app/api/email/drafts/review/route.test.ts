import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  inboxId: "inbox-1" as string | null,
  pending: null as { id: string } | null,
}));

const getDraft = vi.hoisted(() => vi.fn());
const queueEmailDraftReview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: (table: string) => {
      const chain: Record<string, (...args: unknown[]) => unknown> = {};
      chain["select"] = () => chain;
      chain["eq"] = () => chain;
      chain["is"] = () => chain;
      chain["maybeSingle"] = async () => {
        if (table === "boxes") {
          return {
            data: state.userId ? { user_id: state.userId } : null,
            error: null,
          };
        }
        if (table === "agent_addresses") {
          return {
            data: state.inboxId
              ? { agentmail_inbox_id: state.inboxId }
              : null,
            error: null,
          };
        }
        if (table === "decisions") {
          return { data: state.pending, error: null };
        }
        throw new Error(`unexpected maybeSingle table: ${table}`);
      };
      return chain;
    },
  }),
}));
vi.mock("@/lib/agentmail/client", () => ({ getDraft }));
vi.mock("@/lib/email/review", () => ({ queueEmailDraftReview }));

import { getDraft as mockedGetDraft } from "@/lib/agentmail/client";
import { queueEmailDraftReview as mockedQueue } from "@/lib/email/review";
import { POST } from "./route";

function reviewRequest(
  body: unknown,
  token: string | null = "box-token"
): NextRequest {
  return new NextRequest("https://air.test/api/email/drafts/review", {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.userId = "user-1";
  state.inboxId = "inbox-1";
  state.pending = null;
  vi.mocked(mockedGetDraft).mockReset();
  vi.mocked(mockedQueue).mockReset();
  vi.mocked(mockedGetDraft).mockResolvedValue({
    draft_id: "draft-1",
    to: ["real@example.com"],
    subject: "Real subject",
    text: "private draft body",
  });
});

describe("POST /api/email/drafts/review", () => {
  it.each([
    ["missing bearer token", null],
    ["unknown bearer token", "unknown-token"],
  ])("rejects %s", async (_label, token) => {
    if (token === "unknown-token") state.userId = null;
    const response = await POST(reviewRequest({ draft_id: "draft-1" }, token));
    expect(response.status).toBe(401);
  });

  it("rejects an invalid draft id", async () => {
    const response = await POST(reviewRequest({ draft_id: "   " }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the draft does not exist", async () => {
    vi.mocked(mockedGetDraft).mockRejectedValueOnce(new Error("not found"));
    const response = await POST(reviewRequest({ draft_id: "draft-1" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no such draft" });
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("files a decision using metadata read from AgentMail", async () => {
    const response = await POST(
      reviewRequest({
        draft_id: "draft-1",
        to: "spoofed@example.com",
        subject: "Spoofed subject",
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "pending_approval",
    });
    expect(mockedGetDraft).toHaveBeenCalledWith("inbox-1", "draft-1");
    expect(mockedQueue).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      {
        draftId: "draft-1",
        to: "real@example.com",
        subject: "Real subject",
      }
    );
  });

  it("does not file a duplicate pending decision", async () => {
    state.pending = { id: "decision-1" };
    const response = await POST(reviewRequest({ draft_id: "draft-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "already_pending",
    });
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("returns 502 without leaking queue errors", async () => {
    vi.mocked(mockedQueue).mockRejectedValueOnce(
      new Error("database credentials")
    );
    const response = await POST(reviewRequest({ draft_id: "draft-1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "could not file the review",
    });
  });
});
