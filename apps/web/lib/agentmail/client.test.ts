import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    agentmailApiKey: () => "agentmail-test-key",
  },
}));

import { createDraftOnlyKey } from "./client";

describe("createDraftOnlyKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a draft-only key scoped to the requested inbox", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ api_key: "draft-key" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createDraftOnlyKey("inbox/one", "box-user-1")).resolves.toBe(
      "draft-key"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.agentmail.to/v0/inboxes/inbox%2Fone/api-keys",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer agentmail-test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "box-user-1",
          permissions: {
            inbox_read: true,
            thread_read: true,
            message_read: true,
            draft_read: true,
            draft_create: true,
            draft_update: true,
          },
        }),
      })
    );
  });
});
