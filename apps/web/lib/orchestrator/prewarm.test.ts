/**
 * Eager prewarm: fire-and-forget resume kick on inbound. It must skip
 * already-awake boxes, kick resume for stopped ones, and swallow every
 * provider error (ensureBoxAwake owns the real wake).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prewarmBox } from "./boxes";
import { getBox, resume } from "../box/client";
import { FakeSupabase } from "../testing/fakeSupabase";

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

const db = new FakeSupabase();

function fakeSupabase(boxId: string | null) {
  db.tables["boxes"] = boxId
    ? [{ user_id: "user-1", provider_box_id: boxId }]
    : [];
  return db.client();
}

beforeEach(() => {
  db.reset();
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
    expect(db.updates).toEqual([
      {
        table: "boxes",
        patch: { state: "starting", last_active_at: expect.any(String) },
      },
    ]);
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
