import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const turn = vi.hoisted(() => ({
  stopCreateTurn: vi.fn(async (): Promise<boolean> => true),
}));
vi.mock("@/lib/create/turn", () => turn);

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { POST } from "./route";

function stop(runId: string): Promise<Response> {
  const request = new NextRequest(`https://air.test/api/create/turn/${runId}/stop`, { method: "POST" });
  return POST(request, { params: Promise.resolve({ runId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
  turn.stopCreateTurn.mockResolvedValue(true);
});

describe("POST /api/create/turn/[runId]/stop", () => {
  it("401 without the store session", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await stop("run-1")).status).toBe(401);
    expect(turn.stopCreateTurn).not.toHaveBeenCalled();
  });

  it("400 on a malformed run id", async () => {
    expect((await stop("run%2F..%2Fx")).status).toBe(400);
    expect(turn.stopCreateTurn).not.toHaveBeenCalled();
  });

  it("stops the owner's run", async () => {
    const response = await stop("run-1");
    expect(response.status).toBe(200);
    expect(turn.stopCreateTurn).toHaveBeenCalledWith(expect.anything(), "user-alice", "run-1");
  });

  it("404 when the run is not one of the owner's open Create runs", async () => {
    turn.stopCreateTurn.mockResolvedValue(false);
    expect((await stop("run-1")).status).toBe(404);
  });

  it("passes through a stopped run whose row could not be closed", async () => {
    turn.stopCreateTurn.mockRejectedValue(new PublishError("row still open", 503));
    const response = await stop("run-1");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "row still open" });
  });

  it("502 when the stop does not reach the Box", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    turn.stopCreateTurn.mockRejectedValue(new Error("box unreachable"));
    expect((await stop("run-1")).status).toBe(502);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0]![0] as string)).not.toHaveProperty("run_id");
    spy.mockRestore();
  });
});
