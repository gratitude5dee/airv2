import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const auth = vi.hoisted(() => ({
  sessionUserId: vi.fn((): string | null => "user-alice"),
}));
vi.mock("@/lib/auth/user", () => auth);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const relay = vi.hoisted(() => ({
  startChatRun: vi.fn(async () => "run-1"),
}));
vi.mock("@/lib/chat/relay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat/relay")>()),
  startChatRun: relay.startChatRun,
}));
vi.mock("@/lib/bots/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bots/store")>()),
  listBots: async () => [],
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

function post(body: unknown): NextRequest {
  return new NextRequest("https://air.test/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/chat threads", () => {
  it("starts an ordinary thread run in the named session", async () => {
    const res = await POST(post({ input: "hi", session: "air-notes" }));
    expect(res.status).toBe(200);
    expect(relay.startChatRun).toHaveBeenCalledWith(
      expect.anything(),
      "user-alice",
      "hi",
      "web",
      "web",
      "air-notes"
    );
  });

  it("refuses air-create-* sessions so Create controls cannot be bypassed", async () => {
    const res = await POST(post({ input: "hi", session: "air-create-countdown" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "create session" });
    expect(relay.startChatRun).not.toHaveBeenCalled();
  });

  it("still rejects malformed session ids", async () => {
    const res = await POST(post({ input: "hi", session: "Air-Main" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad session" });
  });
});
