import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import { makeApp } from "@/app/mini/loader-test-utils";

const createDraft = vi.fn(async () => "draft-1");
const getAttachmentBytes = vi.fn(async () => Buffer.from("image-bytes"));
const getDraft = vi.fn();
const getMessage = vi.fn();
const getThread = vi.fn();
const listDrafts = vi.fn(async () => [] as unknown[]);
const listMessages = vi.fn(async () => ({ messages: [] as unknown[] }));
const listThreadsFiltered = vi.fn<
  () => Promise<{
    threads: { thread_id: string; subject?: string; labels?: string[] }[];
    next_page_token?: string;
  }>
>(async () => ({ threads: [] }));
const searchThreads = vi.fn(async () => ({ threads: [] as unknown[] }));
const patchMessage = vi.fn(async () => ({}));
const patchThread = vi.fn(async () => ({}));
const batchUpdateMessages = vi.fn(async () => [] as string[]);
const trashThread = vi.fn(async () => undefined);
const restoreThread = vi.fn(async () => ({}));
const trashMessage = vi.fn(async () => undefined);
const restoreMessage = vi.fn(async () => ({}));
const updateDraft = vi.fn(async () => ({}));
const deleteDraft = vi.fn(async () => undefined);
const addInboxBlockEntry = vi.fn(async () => undefined);
const removeInboxBlockEntry = vi.fn(async () => undefined);
const queueEmailDraftReview = vi.fn(async () => undefined);
const resolveEmailDraftDecision = vi.fn(async () => undefined);

// Hoisted with the mock factory — the inbox checks `instanceof` for 501s.
const MailApiError = vi.hoisted(
  () =>
    class MailApiError extends Error {
      status: number;
      constructor(status: number, message: string) {
        super(message);
        this.status = status;
      }
    }
);

vi.mock("@/lib/mail/client", () => ({
  MailApiError,
  addInboxBlockEntry: (...args: unknown[]) => addInboxBlockEntry(...(args as [])),
  batchUpdateMessages: (...args: unknown[]) => batchUpdateMessages(...(args as [])),
  createDraft: (...args: unknown[]) => createDraft(...(args as [])),
  deleteDraft: (...args: unknown[]) => deleteDraft(...(args as [])),
  getAttachmentBytes: (...args: unknown[]) => getAttachmentBytes(...(args as [])),
  getDraft: (...args: unknown[]) => getDraft(...(args as [])),
  getMessage: (...args: unknown[]) => getMessage(...(args as [])),
  getThread: (...args: unknown[]) => getThread(...(args as [])),
  listDrafts: (...args: unknown[]) => listDrafts(...(args as [])),
  listMessages: (...args: unknown[]) => listMessages(...(args as [])),
  listThreadsFiltered: (...args: unknown[]) => listThreadsFiltered(...(args as [])),
  patchMessage: (...args: unknown[]) => patchMessage(...(args as [])),
  patchThread: (...args: unknown[]) => patchThread(...(args as [])),
  removeInboxBlockEntry: (...args: unknown[]) => removeInboxBlockEntry(...(args as [])),
  restoreMessage: (...args: unknown[]) => restoreMessage(...(args as [])),
  restoreThread: (...args: unknown[]) => restoreThread(...(args as [])),
  searchThreads: (...args: unknown[]) => searchThreads(...(args as [])),
  trashMessage: (...args: unknown[]) => trashMessage(...(args as [])),
  trashThread: (...args: unknown[]) => trashThread(...(args as [])),
  updateDraft: (...args: unknown[]) => updateDraft(...(args as [])),
}));
vi.mock("@/lib/email/review", () => ({
  queueEmailDraftReview: (...args: unknown[]) => queueEmailDraftReview(...(args as [])),
}));
vi.mock("@/lib/decisions/email", () => ({
  EmailDraftError: class EmailDraftError extends Error {},
  resolveEmailDraftDecision: (...args: unknown[]) => resolveEmailDraftDecision(...(args as [])),
}));
vi.mock("@/lib/miniapps/promptBar", () => ({
  promptBar: () => "",
  runPrompt: vi.fn(),
}));
vi.mock("@/lib/hermes/client", () => ({
  MAIN_SESSION: "air-main",
  createRun: vi.fn(async () => ({ run_id: "run-1" })),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  armStopAfter: vi.fn(async () => undefined),
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: {} })),
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
    for (const method of ["select", "eq", "is", "not", "order", "limit", "update", "insert", "upsert"]) {
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
      agent_addresses: { single: { agentmail_inbox_id: "agent@wzrd.tech", address: "agent@wzrd.tech" } },
      senders: { rows: [] },
      decisions: { rows: [] },
    }),
    app: makeApp({ slug: "inbox", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/inbox",
  } as MiniAppContext;
}

function postContext(): MiniAppContext {
  const ctx = context();
  ctx.request = new NextRequest("https://app.wzrd.tech/mini/inbox", { method: "POST" });
  return ctx;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("inbox mini-app", () => {
  it("pages through older threads instead of truncating the mailbox at the first page", async () => {
    listThreadsFiltered.mockResolvedValueOnce({
      threads: [{ thread_id: "thread-1", subject: "Newest mail" }],
      next_page_token: "opaque-next-page",
    });

    const response = await inbox.render(context());
    const html = await response.text();

    expect(listThreadsFiltered).toHaveBeenCalledWith(
      "agent@wzrd.tech",
      expect.objectContaining({ limit: 25 })
    );
    expect(html).toContain("Older mail");
    expect(html).toContain("page_token=opaque-next-page");
  });

  it("renders a chip per folder and routes each folder to its provider call", async () => {
    const html = await (await inbox.render(context())).text();
    for (const folder of ["inbox", "unread", "drafts", "sent", "spam", "trash"]) {
      expect(html).toContain(`folder=${folder}`);
    }

    listThreadsFiltered.mockResolvedValueOnce({ threads: [] });
    await inbox.render(context("https://app.wzrd.tech/mini/inbox?folder=unread"));
    expect(listThreadsFiltered).toHaveBeenLastCalledWith(
      "agent@wzrd.tech",
      expect.objectContaining({ labels: ["unread"] })
    );

    listThreadsFiltered.mockResolvedValueOnce({ threads: [] });
    await inbox.render(context("https://app.wzrd.tech/mini/inbox?folder=spam"));
    expect(listThreadsFiltered).toHaveBeenLastCalledWith(
      "agent@wzrd.tech",
      expect.objectContaining({ labels: ["spam"] })
    );

    listThreadsFiltered.mockResolvedValueOnce({ threads: [] });
    await inbox.render(context("https://app.wzrd.tech/mini/inbox?folder=trash"));
    expect(listThreadsFiltered).toHaveBeenLastCalledWith(
      "agent@wzrd.tech",
      expect.objectContaining({ folder: "trash" })
    );

    await inbox.render(context("https://app.wzrd.tech/mini/inbox?folder=drafts"));
    expect(listDrafts).toHaveBeenCalledWith("agent@wzrd.tech");

    listMessages.mockResolvedValueOnce({ messages: [] });
    await inbox.render(context("https://app.wzrd.tech/mini/inbox?folder=sent"));
    expect(listMessages).toHaveBeenCalledWith(
      "agent@wzrd.tech",
      expect.objectContaining({ labels: ["sent"] })
    );
  });

  it("excludes spam-labeled threads from the inbox view", async () => {
    listThreadsFiltered.mockResolvedValueOnce({
      threads: [
        { thread_id: "t-ok", subject: "Real mail" },
        { thread_id: "t-spam", subject: "Buy crypto now", labels: ["spam"] },
      ],
    });

    const html = await (await inbox.render(context())).text();

    expect(html).toContain("Real mail");
    expect(html).not.toContain("Buy crypto now");
  });

  it("marks a thread read on open via per-message read patches", async () => {
    getThread.mockResolvedValueOnce({
      thread_id: "thread-1",
      subject: "Unread thing",
      labels: ["unread"],
      messages: [
        { message_id: "m-1", inbox_id: "agent@wzrd.tech", from: "a@b.co", labels: ["unread"], text: "hi" },
        { message_id: "m-2", inbox_id: "agent@wzrd.tech", from: "a@b.co", labels: ["received"], text: "ok" },
      ],
    });

    await inbox.render(context("https://app.wzrd.tech/mini/inbox?thread=thread-1"));

    expect(patchMessage).toHaveBeenCalledWith("agent@wzrd.tech", "m-1", { read: true });
    expect(patchMessage).not.toHaveBeenCalledWith("agent@wzrd.tech", "m-2", expect.anything());
    expect(patchThread).toHaveBeenCalledWith("agent@wzrd.tech", "thread-1", {
      remove_labels: ["unread"],
    });
  });

  it("routes ?compose=1&mode=reply&thread=… to the compose form, not the thread view", async () => {
    getThread.mockResolvedValueOnce({
      thread_id: "thread-1",
      subject: "Deploy window",
      labels: ["received"],
      messages: [
        { message_id: "m-1", inbox_id: "agent@wzrd.tech", from: "ops@b.co", labels: ["received"], text: "hi" },
      ],
    });

    const html = await (
      await inbox.render(
        context("https://app.wzrd.tech/mini/inbox?compose=1&mode=reply&thread=thread-1")
      )
    ).text();

    expect(html).toContain('name="to" value="ops@b.co"');
    expect(html).toContain('value="Re: Deploy window"');
    expect(html).toContain('name="action" value="compose"');
    expect(html).not.toContain('class="msgcard"');
  });

  it("mark unread posts a return to the folder so mark-read-on-open cannot undo it", async () => {
    getThread.mockResolvedValueOnce({
      thread_id: "thread-1",
      subject: "Later",
      labels: ["received"],
      messages: [
        { message_id: "m-1", from: "a@b.co", labels: ["received"], text: "x" },
      ],
    });

    const html = await (
      await inbox.render(
        context("https://app.wzrd.tech/mini/inbox?thread=thread-1&from=unread")
      )
    ).text();

    expect(html).toContain(
      'name="action" value="mark_unread"><input type="hidden" name="return" value="?folder=unread"'
    );
  });

  it("renders the draft approve button label once-escaped", async () => {
    getDraft.mockResolvedValueOnce({
      draft_id: "draft-1",
      to: ["a@b.co"],
      subject: "s",
      text: "t",
    });

    const html = await (
      await inbox.render(context("https://app.wzrd.tech/mini/inbox?draft=draft-1"))
    ).text();

    expect(html).toContain("Approve &amp; send");
    expect(html).not.toContain("&amp;amp;");
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

  it("flags spam threads and lets the owner mark them not-spam", async () => {
    getThread.mockResolvedValue({
      thread_id: "thread-1",
      subject: "Odd offer",
      labels: ["spam"],
      messages: [{ message_id: "m-1", from: "spam@b.co", text: "x", labels: ["spam"] }],
    });

    const html = await (
      await inbox.render(context("https://app.wzrd.tech/mini/inbox?thread=thread-1&from=spam"))
    ).text();
    expect(html).toContain("Flagged by your organization rules");
    expect(html).toContain('value="not_spam"');

    const form = new FormData();
    form.set("action", "not_spam");
    form.set("thread", "thread-1");
    form.set("return", "?folder=spam");
    const response = await inbox.action!(postContext(), form);

    expect(patchThread).toHaveBeenCalledWith("agent@wzrd.tech", "thread-1", {
      remove_labels: ["spam"],
    });
    expect(batchUpdateMessages).toHaveBeenCalledWith(
      "agent@wzrd.tech",
      ["m-1"],
      { remove_labels: ["spam"] }
    );
    expect(response.status).toBe(303);
  });

  it("moves a thread to spam on the thread and its messages", async () => {
    getThread.mockResolvedValueOnce({
      thread_id: "thread-1",
      messages: [
        { message_id: "m-1", from: "x@y.co" },
        { message_id: "m-2", from: "x@y.co" },
      ],
    });

    const form = new FormData();
    form.set("action", "spam");
    form.set("thread", "thread-1");
    const response = await inbox.action!(postContext(), form);

    expect(patchThread).toHaveBeenCalledWith("agent@wzrd.tech", "thread-1", {
      add_labels: ["spam"],
    });
    expect(batchUpdateMessages).toHaveBeenCalledWith("agent@wzrd.tech", ["m-1", "m-2"], {
      add_labels: ["spam"],
    });
    expect(response.status).toBe(303);
  });

  it("trashes a thread and restores it from the trash view", async () => {
    const form = new FormData();
    form.set("action", "trash_thread");
    form.set("thread", "thread-1");
    await inbox.action!(postContext(), form);
    expect(trashThread).toHaveBeenCalledWith("agent@wzrd.tech", "thread-1");

    const restore = new FormData();
    restore.set("action", "restore_thread");
    restore.set("thread", "thread-1");
    await inbox.action!(postContext(), restore);
    expect(restoreThread).toHaveBeenCalledWith("agent@wzrd.tech", "thread-1");
  });

  it("creates a multi-recipient manual draft and returns the owner to its review card", async () => {
    const form = new FormData();
    form.set("action", "compose");
    form.set("intent", "draft");
    form.set("to", "first@example.com, second@example.com");
    form.set("subject", "A note");
    form.set("text", "Hello from the mini-app");

    const response = await inbox.action!(postContext(), form);

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
    expect(resolveEmailDraftDecision).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("notice")).toContain(
      "Draft saved"
    );
  });

  it("send-now files the draft then resolves its decision through the send path", async () => {
    const ctx = postContext();
    ctx.supabase = makeSupabase({
      agent_addresses: { single: { agentmail_inbox_id: "agent@wzrd.tech", address: "agent@wzrd.tech" } },
      senders: { rows: [] },
      decisions: { rows: [{ id: "dec-9", ref: "draft-1" }] },
    });

    const form = new FormData();
    form.set("action", "compose");
    form.set("intent", "send");
    form.set("to", "first@example.com");
    form.set("subject", "Now");
    form.set("text", "Send it");

    const response = await inbox.action!(ctx, form);

    expect(createDraft).toHaveBeenCalled();
    expect(queueEmailDraftReview).toHaveBeenCalled();
    expect(resolveEmailDraftDecision).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "dec-9",
      true
    );
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("notice")).toContain(
      "Email sent"
    );
  });

  it("edits and deletes drafts through the draft actions", async () => {
    const save = new FormData();
    save.set("action", "draft_update");
    save.set("draft", "draft-1");
    save.set("to", "a@b.co");
    save.set("subject", "Edited");
    save.set("text", "New body");
    await inbox.action!(postContext(), save);
    expect(updateDraft).toHaveBeenCalledWith("agent@wzrd.tech", "draft-1", {
      to: ["a@b.co"],
      cc: [],
      subject: "Edited",
      text: "New body",
    });

    const del = new FormData();
    del.set("action", "draft_delete");
    del.set("draft", "draft-1");
    await inbox.action!(postContext(), del);
    expect(deleteDraft).toHaveBeenCalledWith("agent@wzrd.tech", "draft-1");
  });

  it("routes search queries to searchThreads", async () => {
    searchThreads.mockResolvedValueOnce({
      threads: [{ thread_id: "t-1", subject: "Found it" }],
    });

    const html = await (
      await inbox.render(context("https://app.wzrd.tech/mini/inbox?q=receipt"))
    ).text();

    expect(searchThreads).toHaveBeenCalledWith(
      "agent@wzrd.tech",
      "receipt",
      expect.objectContaining({ limit: 25 })
    );
    expect(html).toContain("Found it");
  });

  it("hides compose and folder navigation from card (lite) sessions", async () => {
    const lite = context();
    lite.session = { ...lite.session, via: "card" };
    listThreadsFiltered.mockResolvedValueOnce({
      threads: [{ thread_id: "t-1", subject: "Hello" }],
    });

    const html = await (await inbox.render(lite)).text();

    // The shared mail stylesheet still renders rows — assert the chrome is
    // gone, not the class names it defines.
    expect(html).not.toContain('class="mailbar"');
    expect(html).not.toContain("compose=1");
    expect(html).toContain("Hello");
  });
});
