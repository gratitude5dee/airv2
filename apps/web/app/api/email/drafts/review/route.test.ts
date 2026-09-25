import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const state = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
}));

const getDraft = vi.hoisted(() => vi.fn());
const queueEmailDraftReview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => state.fake.client(),
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
  process.env["MAIL_PROVIDER"] = "agentmail";
  state.fake = new FakeSupabase();
  state.fake.tables["boxes"] = [{ user_id: "user-1", gateway_token: "box-token" }];
  state.fake.tables["agent_addresses"] = [
    { user_id: "user-1", agentmail_inbox_id: "inbox-primary", is_primary: true, retired_at: null },
    { user_id: "user-1", agentmail_inbox_id: "inbox-secondary", is_primary: false, retired_at: null },
  ];
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
    if (token === "unknown-token") state.fake.tables["boxes"] = [];
    const response = await POST(reviewRequest({ draft_id: "draft-1" }, token));
    expect(response.status).toBe(401);
  });

  it("rejects an invalid draft id", async () => {
    const response = await POST(reviewRequest({ draft_id: "   " }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the draft does not exist", async () => {
    vi.mocked(mockedGetDraft).mockRejectedValue(new Error("not found"));
    const response = await POST(reviewRequest({ draft_id: "draft-1" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no such draft" });
    expect(mockedQueue).not.toHaveBeenCalled();
    expect(mockedGetDraft).toHaveBeenCalledTimes(2);
  });

  it("files a decision using metadata read from AgentMail", async () => {
    vi.mocked(mockedGetDraft).mockImplementationOnce(async () => {
      throw new Error("not in primary");
    });
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
    expect(mockedGetDraft).toHaveBeenNthCalledWith(
      1,
      "inbox-primary",
      "draft-1"
    );
    expect(mockedGetDraft).toHaveBeenNthCalledWith(
      2,
      "inbox-secondary",
      "draft-1"
    );
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

  it("rejects an inbox that the user does not own", async () => {
    const response = await POST(
      reviewRequest({ draft_id: "draft-1", inbox_id: "other-inbox" })
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no such draft" });
    expect(mockedGetDraft).not.toHaveBeenCalled();
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("uses an explicitly owned inbox when requested", async () => {
    const response = await POST(
      reviewRequest({ draft_id: "draft-1", inbox_id: "inbox-secondary" })
    );
    expect(response.status).toBe(200);
    expect(mockedGetDraft).toHaveBeenCalledWith(
      "inbox-secondary",
      "draft-1"
    );
  });

  it("does not file a duplicate pending decision", async () => {
    state.fake.tables["decisions"] = [
      { id: "decision-1", user_id: "user-1", kind: "email_draft", ref: "draft-1", status: "pending" },
    ];
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
