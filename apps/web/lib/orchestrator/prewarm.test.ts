/**
 * Eager prewarm: fire-and-forget resume kick on inbound. It must skip
 * already-awake boxes, kick resume for stopped ones, and swallow every
 * provider error (ensureBoxAwake owns the real wake).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prewarmBox } from "./boxes";
import { getBox, resume } from "../box/client";

vi.mock("../box/client", () => ({
  command: vi.fn(),
  getBox: vi.fn(),
  isStartLimit: vi.fn().mockReturnValue(false),
  resume: vi.fn(),
  waitForBox: vi.fn(),
}));
vi.mock("../hermes/client", () => ({ health: vi.fn() }));
vi.mock("../brand/mirror", () => ({ mirrorBrandIfStale: vi.fn() }));
vi.mock("../box/events", () => ({ recordBoxStateEvent: vi.fn() }));

function fakeSupabase(boxId: string | null) {
  const updates: unknown[] = [];
  const supabase = {
    updates,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: boxId ? { provider_box_id: boxId } : null,
              error: null,
            }),
        }),
      }),
      update: (values: unknown) => {
        updates.push(values);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  };
  return supabase as unknown as SupabaseClient & { updates: unknown[] };
}

beforeEach(() => {
  vi.mocked(getBox).mockReset();
  vi.mocked(resume).mockReset();
});

describe("prewarmBox", () => {
  it("kicks resume and marks starting for a stopped box", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    const supabase = fakeSupabase("bx_1");
    await prewarmBox(supabase, "user-1");
    expect(resume).toHaveBeenCalledWith("bx_1");
    expect(supabase.updates).toEqual([{ state: "starting" }]);
  });

  it("does nothing when the box is already awake", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "ready" } as never);
    await prewarmBox(fakeSupabase("bx_1"), "user-1");
    expect(resume).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no box row", async () => {
    await prewarmBox(fakeSupabase(null), "user-1");
    expect(getBox).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it("swallows provider errors (races with ensureBoxAwake are fine)", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockRejectedValue(new Error("already resuming"));
    await expect(
      prewarmBox(fakeSupabase("bx_1"), "user-1")
    ).resolves.toBeUndefined();
  });
});
