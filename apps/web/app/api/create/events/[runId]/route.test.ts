import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const relay = vi.hoisted(() => ({
  chatEventStream: vi.fn(),
}));
vi.mock("@/lib/chat/relay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat/relay")>()),
  chatEventStream: relay.chatEventStream,
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

function get(runId: string) {
  return GET(new NextRequest(`https://mini.test/api/create/events/${runId}`), {
    params: Promise.resolve({ runId }),
  });
}

function sse(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
  relay.chatEventStream.mockImplementation(async (_s: unknown, userId: string, runId: string) => {
    if (userId !== "user-alice" || runId !== "run-1") throw new Error("run not found");
    return sse(['data: {"event":"message.delta","delta":"hi"}\n\n', 'data: {"event":"run.completed"}\n\n']);
  });
});

describe("GET /api/create/events/[runId]", () => {
  it("401 without the store session", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await get("run-1")).status).toBe(401);
    expect(relay.chatEventStream).not.toHaveBeenCalled();
  });

  it("400 on a run id that is not a token", async () => {
    expect((await get("run%2F..%2Fx")).status).toBe(400);
    expect((await get("a".repeat(129))).status).toBe(400);
    expect(relay.chatEventStream).not.toHaveBeenCalled();
  });

  it("relays the owner's run as an event stream scoped to their user id", async () => {
    const response = await get("run-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(relay.chatEventStream).toHaveBeenCalledWith(expect.anything(), "user-alice", "run-1");
    expect(await response.text()).toContain('"event":"run.completed"');
  });

  it("500 (no stream) when the run does not resolve for this owner", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get("run-of-bob");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "stream failed" });
    error.mockRestore();
  });
});
