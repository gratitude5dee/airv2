import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import { makeApp } from "@/app/mini/loader-test-utils";

const createDraft = vi.fn(async () => "draft-1");
const getAttachmentBytes = vi.fn(async () => Buffer.from("image-bytes"));
const getMessage = vi.fn();
const getThread = vi.fn();
const listThreadsPage = vi.fn<
  () => Promise<{
    threads: { thread_id: string; subject?: string }[];
    next_page_token?: string;
  }>
>(async () => ({ threads: [] }));
const queueEmailDraftReview = vi.fn(async () => undefined);

vi.mock("@/lib/mail/client", () => ({
  createDraft: (...args: unknown[]) => createDraft(...(args as [])),
  getAttachmentBytes: (...args: unknown[]) => getAttachmentBytes(...(args as [])),
  getDraft: vi.fn(),
  getMessage: (...args: unknown[]) => getMessage(...(args as [])),
  getThread: (...args: unknown[]) => getThread(...(args as [])),
  listThreadsPage: (...args: unknown[]) => listThreadsPage(...(args as [])),
}));
vi.mock("@/lib/email/review", () => ({
  queueEmailDraftReview: (...args: unknown[]) => queueEmailDraftReview(...(args as [])),
}));
vi.mock("@/lib/decisions/email", () => ({
  EmailDraftError: class EmailDraftError extends Error {},
  resolveEmailDraftDecision: vi.fn(),
}));
vi.mock("@/lib/miniapps/promptBar", () => ({
  promptBar: () => "",
  runPrompt: vi.fn(),
}));

import { inbox } from "./inbox";

interface TableFixture {
  rows?: unknown[];
  single?: unknown;
}

function makeSupabase(fixtures: Record<string, TableFixture>): SupabaseClient {
  const from = (tableName: string) => {
    const fixture = fixtures[tableName] ?? {};
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of ["select", "eq", "is", "not", "order", "limit"]) {
      builder[method] = chain;
    }
    builder["maybeSingle"] = async () => ({ data: fixture.single ?? null, error: null });
    builder["then"] = (
      resolve: (value: { data: unknown[]; error: null }) => unknown
    ) => Promise.resolve({ data: fixture.rows ?? [], error: null }).then(resolve);
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

function context(url = "https://app.wzrd.tech/mini/inbox"): MiniAppContext {
  return {
    request: new NextRequest(url),
    supabase: makeSupabase({
      agent_addresses: { single: { agentmail_inbox_id: "agent@wzrd.tech" } },
      senders: { rows: [] },
      decisions: { rows: [] },
    }),
    app: makeApp({ slug: "inbox", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/inbox",
  } as MiniAppContext;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("inbox mini-app", () => {
  it("pages through older threads instead of truncating the mailbox at the first page", async () => {
    listThreadsPage.mockResolvedValueOnce({
      threads: [{ thread_id: "thread-1", subject: "Newest mail" }],
      next_page_token: "opaque-next-page",
    });

    const response = await inbox.render(context());
    const html = await response.text();

    expect(listThreadsPage).toHaveBeenCalledWith("agent@wzrd.tech", 100, undefined);
    expect(html).toContain("Older mail");
    expect(html).toContain("page_token=opaque-next-page");
  });

  it("renders HTML-only mail as readable escaped text plus same-origin attachments", async () => {
    getThread.mockResolvedValueOnce({
      thread_id: "thread-1",
      subject: "Design update",
      messages: [
        {
          message_id: "message-1",
          inbox_id: "agent@wzrd.tech",
          from: "Sender <sender@example.com>",
          html: "<p>HTML-only <strong>message</strong>.</p><script>evil()</script>",
          attachments: [
            { attachment_id: "image-1", filename: "hero.png", content_type: "image/png" },
            { attachment_id: "file-1", filename: "brief.pdf", content_type: "application/pdf" },
          ],
        },
      ],
    });

    const response = await inbox.render(context("https://app.wzrd.tech/mini/inbox?thread=thread-1"));
    const html = await response.text();

    expect(html).toContain("HTML-only message.");
    expect(html).not.toContain("evil()");
    expect(html).toContain("message=message-1&amp;attachment=image-1");
    expect(html).toContain("hero.png");
    expect(html).toContain("brief.pdf");
    expect(html).not.toContain("https://sender.example");
  });

  it("serves a requested image attachment only after loading its owned message", async () => {
    getMessage.mockResolvedValueOnce({
      message_id: "message-1",
      inbox_id: "agent@wzrd.tech",
      attachments: [
        { attachment_id: "image-1", filename: "hero.png", content_type: "image/png" },
      ],
    });

    const response = await inbox.render(
      context("https://app.wzrd.tech/mini/inbox?message=message-1&attachment=image-1")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(await response.text()).toBe("image-bytes");
    expect(getAttachmentBytes).toHaveBeenCalledWith("agent@wzrd.tech", "message-1", "image-1");
  });

  it("creates a multi-recipient manual draft and returns the owner to its review card", async () => {
    const form = new FormData();
    form.set("action", "compose");
    form.set("to", "first@example.com, second@example.com");
    form.set("subject", "A note");
    form.set("text", "Hello from the mini-app");

    const response = await inbox.action!(context(), form);

    expect(createDraft).toHaveBeenCalledWith("agent@wzrd.tech", {
      to: ["first@example.com", "second@example.com"],
      subject: "A note",
      text: "Hello from the mini-app",
    });
    expect(queueEmailDraftReview).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        draftId: "draft-1",
        to: "first@example.com, second@example.com",
      })
    );
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("notice")).toContain(
      "Draft saved"
    );
  });
});
