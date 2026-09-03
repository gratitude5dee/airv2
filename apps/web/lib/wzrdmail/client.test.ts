import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    wzrdmailApiKey: () => "wm_test_key",
    wzrdmailBaseUrl: () => "https://api.wzrd.test",
    agentEmailDomain: () => "wzrd.tech",
  },
}));

import {
  WzrdMailApiError,
  addInboxBlockEntry,
  createDraft,
  createDraftOnlyKey,
  createInbox,
  ensurePod,
  ensureWebhook,
  getMessage,
  listDrafts,
  listThreads,
  removeInboxBlockEntry,
  replyToMessage,
  sendDraft,
} from "./client";
import { MailApiError } from "../mail/errors";

type Call = { url: string; init: RequestInit };

function stubFetch(
  handler: (call: Call) => Response | Promise<Response>
): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = { url, init };
      calls.push(call);
      return handler(call);
    })
  );
  return calls;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function headersOf(call: Call): Record<string, string> {
  return call.init.headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wzrdmail client: auth + base URL", () => {
  it("hits WZRDMAIL_BASE_URL/v0 with a Bearer wm_ key", async () => {
    const calls = stubFetch(() =>
      json({ message_id: "m1", inbox_id: "a@wzrd.tech", extracted_text: "hi" })
    );
    const message = await getMessage("a@wzrd.tech", "m1");
    expect(message.extracted_text).toBe("hi");
    expect(calls[0]!.url).toBe(
      "https://api.wzrd.test/v0/inboxes/a%40wzrd.tech/messages/m1"
    );
    expect(headersOf(calls[0]!)["Authorization"]).toBe("Bearer wm_test_key");
  });

  it("surfaces non-2xx as WzrdMailApiError (a MailApiError) with the status", async () => {
    stubFetch(() => json({ name: "forbidden", message: "nope" }, 403));
    const error = await getMessage("a@wzrd.tech", "m1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WzrdMailApiError);
    expect(error).toBeInstanceOf(MailApiError);
    expect((error as WzrdMailApiError).status).toBe(403);
  });
});

describe("ensurePod", () => {
  it("creates a pod keyed by client_id = user id", async () => {
    const calls = stubFetch(() => json({ pod_id: "pod_1", client_id: "user-1" }, 201));
    await expect(ensurePod("user-1")).resolves.toEqual({
      pod_id: "pod_1",
      client_id: "user-1",
    });
    expect(calls[0]!.url).toBe("https://api.wzrd.test/v0/pods");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      client_id: "user-1",
      name: "air-user-1",
    });
  });

  it("falls back to the existing pod on 409", async () => {
    stubFetch((call) =>
      call.init.method === "POST"
        ? json({ name: "conflict", message: "exists" }, 409)
        : json({ pods: [{ pod_id: "pod_x", client_id: "other" }, { pod_id: "pod_1", client_id: "user-1" }] })
    );
    await expect(ensurePod("user-1")).resolves.toMatchObject({ pod_id: "pod_1" });
  });
});

describe("createInbox", () => {
  it("posts username + client_id into the pod's inbox collection", async () => {
    const calls = stubFetch(() => json({ inbox_id: "sam@wzrd.tech" }, 201));
    await expect(createInbox("pod_1", "sam")).resolves.toMatchObject({
      inbox_id: "sam@wzrd.tech",
    });
    expect(calls[0]!.url).toBe("https://api.wzrd.test/v0/pods/pod_1/inboxes");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ username: "sam" });
  });
});

describe("createDraftOnlyKey", () => {
  it("creates an inbox-scoped read,drafts key via POST /v0/api-keys", async () => {
    const calls = stubFetch(() => json({ api_key: "wm_live_draftonly" }, 201));
    await expect(createDraftOnlyKey("sam@wzrd.tech", "box-user-1")).resolves.toBe(
      "wm_live_draftonly"
    );
    expect(calls[0]!.url).toBe("https://api.wzrd.test/v0/api-keys");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      name: "box-user-1",
      inbox_id: "sam@wzrd.tech",
      permissions: ["read", "drafts"],
    });
  });
});

describe("drafts + sends", () => {
  it("createDraft returns the draft_id", async () => {
    const calls = stubFetch(() => json({ draft_id: "d1" }, 201));
    await expect(
      createDraft("sam@wzrd.tech", { to: ["x@example.com"], subject: "s", text: "t" })
    ).resolves.toBe("d1");
    expect(calls[0]!.url).toBe("https://api.wzrd.test/v0/inboxes/sam%40wzrd.tech/drafts");
  });

  it("createDraft derives to/subject from the parent for reply drafts", async () => {
    const calls = stubFetch(({ url }) =>
      url.includes("/messages/")
        ? json({ message_id: "m1", inbox_id: "sam@wzrd.tech", from: "ana@x.com", subject: "Hi" })
        : json({ draft_id: "d2" }, 201)
    );
    await expect(
      createDraft("sam@wzrd.tech", { in_reply_to: "m1", text: "t", client_id: "reply-m1" })
    ).resolves.toBe("d2");
    expect(calls[0]!.url).toBe(
      "https://api.wzrd.test/v0/inboxes/sam%40wzrd.tech/messages/m1"
    );
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({
      in_reply_to: "m1",
      text: "t",
      client_id: "reply-m1",
      to: ["ana@x.com"],
      subject: "Re: Hi",
    });
  });

  it("createDraft strips the display name from the parent sender", async () => {
    const calls = stubFetch(({ url }) =>
      url.includes("/messages/")
        ? json({ message_id: "m1", inbox_id: "sam@wzrd.tech", from: "Friend <Friend@Example.com>", subject: "Re: Hi" })
        : json({ draft_id: "d3" }, 201)
    );
    await createDraft("sam@wzrd.tech", { in_reply_to: "m1", text: "t" });
    expect(JSON.parse(calls[1]!.init.body as string)).toMatchObject({
      to: ["friend@example.com"],
      subject: "Re: Hi",
    });
  });

  it("createDraft derives only the subject when recipients are explicit", async () => {
    const calls = stubFetch(({ url }) =>
      url.includes("/messages/")
        ? json({ message_id: "m1", inbox_id: "sam@wzrd.tech", from: "ana@x.com", subject: "Hi" })
        : json({ draft_id: "d4" }, 201)
    );
    await createDraft("sam@wzrd.tech", { in_reply_to: "m1", to: ["bob@y.com"], text: "t" });
    expect(JSON.parse(calls[1]!.init.body as string)).toMatchObject({
      to: ["bob@y.com"],
      subject: "Re: Hi",
    });
  });

  it("createDraft skips the parent lookup when to and subject are explicit", async () => {
    const calls = stubFetch(() => json({ draft_id: "d5" }, 201));
    await createDraft("sam@wzrd.tech", { in_reply_to: "m1", to: ["bob@y.com"], subject: "S", text: "t" });
    expect(calls).toHaveLength(1);
  });

  it("sendDraft + replyToMessage fail when the provider rejected every recipient", async () => {
    stubFetch(() =>
      json({
        message_id: "m3",
        state: "rejected",
        rejected_recipients: [{ address: "x@example.com", error: "not verified" }],
      })
    );
    await expect(sendDraft("sam@wzrd.tech", "d1", "idem-1")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("x@example.com: not verified"),
    });
    await expect(
      replyToMessage("sam@wzrd.tech", "m1", "thanks", "idem-2")
    ).rejects.toMatchObject({ status: 502 });
  });

  it("sendDraft + replyToMessage carry Idempotency-Key", async () => {
    const calls = stubFetch(() => json({ message_id: "m2" }));
    await sendDraft("sam@wzrd.tech", "d1", "idem-1");
    await replyToMessage("sam@wzrd.tech", "m1", "thanks", "idem-2");
    expect(calls[0]!.url).toBe(
      "https://api.wzrd.test/v0/inboxes/sam%40wzrd.tech/drafts/d1/send"
    );
    expect(headersOf(calls[0]!)["Idempotency-Key"]).toBe("idem-1");
    expect(calls[1]!.url).toBe(
      "https://api.wzrd.test/v0/inboxes/sam%40wzrd.tech/messages/m1/reply"
    );
    expect(headersOf(calls[1]!)["Idempotency-Key"]).toBe("idem-2");
  });

  it("a draft-only key's send is refused (403 propagates, nothing is retried)", async () => {
    const calls = stubFetch(() =>
      json({ name: "forbidden", message: "requires send permission" }, 403)
    );
    await expect(sendDraft("sam@wzrd.tech", "d1", "idem-1")).rejects.toMatchObject({
      status: 403,
    });
    expect(calls).toHaveLength(1);
  });

  it("unwraps the drafts / threads collection envelopes", async () => {
    stubFetch((call) =>
      call.url.includes("/threads")
        ? json({ threads: [{ thread_id: "t1" }] })
        : json({ drafts: [{ draft_id: "d1" }] })
    );
    await expect(listDrafts("sam@wzrd.tech")).resolves.toEqual([{ draft_id: "d1" }]);
    await expect(listThreads("sam@wzrd.tech")).resolves.toEqual([{ thread_id: "t1" }]);
  });
});

describe("receive/block list aliases", () => {
  it("adds via POST …/lists/receive/block and treats 409 as success", async () => {
    let n = 0;
    const calls = stubFetch(() => (n++ === 0 ? json({ entry_id: "e1" }, 201) : json({}, 409)));
    await addInboxBlockEntry("sam@wzrd.tech", "spam@example.com");
    await addInboxBlockEntry("sam@wzrd.tech", "spam@example.com");
    expect(calls[0]!.url).toBe(
      "https://api.wzrd.test/v0/inboxes/sam%40wzrd.tech/lists/receive/block"
    );
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      entry: "spam@example.com",
    });
  });

  it("removes via DELETE …/lists/receive/block/:entry and tolerates 404", async () => {
    const calls = stubFetch(() => new Response(null, { status: 404 }));
    await removeInboxBlockEntry("sam@wzrd.tech", "spam@example.com");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toBe(
      "https://api.wzrd.test/v0/inboxes/sam%40wzrd.tech/lists/receive/block/spam%40example.com"
    );
  });
});

describe("ensureWebhook", () => {
  it("creates the single air-inbound webhook with pod_ids + client_id", async () => {
    const calls = stubFetch((call) =>
      call.init.method === "POST"
        ? json({ webhook_id: "wh1", secret: "whsec_x" }, 201)
        : json({ webhooks: [] })
    );
    await ensureWebhook("https://air.test/api/inbound/email", ["pod_1"]);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      url: "https://air.test/api/inbound/email",
      event_types: ["message.received"],
      pod_ids: ["pod_1"],
      client_id: "air-inbound",
    });
  });

  it("PATCHes new pods onto the existing webhook instead of creating a second one", async () => {
    const calls = stubFetch((call) =>
      call.init.method === "PATCH"
        ? json({ webhook_id: "wh1" })
        : json({ webhooks: [{ webhook_id: "wh1", client_id: "air-inbound", pod_ids: ["pod_1"] }] })
    );
    await ensureWebhook("https://air.test/api/inbound/email", ["pod_2"]);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.init.method).toBe("PATCH");
    expect(calls[1]!.url).toBe("https://api.wzrd.test/v0/webhooks/wh1");
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ pod_ids: ["pod_1", "pod_2"] });
  });

  it("is a no-op when the pod is already subscribed", async () => {
    const calls = stubFetch(() =>
      json({ webhooks: [{ webhook_id: "wh1", client_id: "air-inbound", pod_ids: ["pod_1"] }] })
    );
    await ensureWebhook("https://air.test/api/inbound/email", ["pod_1"]);
    expect(calls).toHaveLength(1);
  });
});
