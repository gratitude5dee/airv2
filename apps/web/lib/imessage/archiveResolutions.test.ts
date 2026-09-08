import { beforeEach, describe, expect, it, vi } from "vitest";
const files = new Map<string, string>();
vi.mock("../box/client", async (importOriginal) => {
  const { BoxApiError } = await importOriginal<typeof import("../box/client")>();
  return { BoxApiError,
    readFile: vi.fn(async (_box: string, path: string) => {
      if (!files.has(path)) throw new BoxApiError(404, "missing");
      return files.get(path)!;
    }),
  };
});
vi.mock("./archiveWrite", () => ({ writeArchiveFile: vi.fn(async (_box: string, path: string, content: string) => {
  files.set(path, content);
}) }));
vi.mock("../orchestrator/boxes", () => ({ ensureBoxAwake: vi.fn(async () => ({ boxId: "box" })) }));
vi.mock("../miniapps/stateLease", () => ({
  withStateLease: vi.fn(async (_s: unknown, _u: string, app: string, resource: string, _o: unknown,
    fn: (boxId: string, renew: () => Promise<void>) => Promise<unknown>) => {
    if (app !== "imessage" || resource !== "archive") throw new Error("wrong lease");
    return fn("box", async () => undefined);
  }),
}));
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PENDING_RESOLUTION_PATH, RESOLUTIONS_PATH, ResolutionInputError, checkResolutionsAgainstPending,
  parseThreadResolutions, readPendingResolution, readResolutionView, readThreadResolutions, saveResolutions,
} from "./archiveResolutions";
import { withStateLease } from "../miniapps/stateLease";
const supabase = {} as SupabaseClient;
const pending = { schema: 1 as const, reported_at: "2026-09-01T00:00:00.000Z", unresolved: [
  { label: "Deleted chat", candidates: [] }, { label: "Work", candidates: ["work-a", "work-b"] },
] };
beforeEach(() => { files.clear(); vi.clearAllMocks(); });

describe("resolution body parsing", () => {
  it("accepts label→id and label→null entries", () => {
    expect(parseThreadResolutions({ resolutions: [{ label: "Work", id: "work-b" }, { label: "Deleted chat", id: null }] }))
      .toEqual([{ label: "Work", id: "work-b" }, { label: "Deleted chat", id: null }]);
  });
  it.each([
    null, {}, { resolutions: [] }, { resolutions: [{}] }, { resolutions: [{ label: 1, id: "x" }] },
    { resolutions: [{ label: "Work", id: "" }] }, { resolutions: [{ label: "Work", id: 5 }] },
    { resolutions: [{ label: "Work" }] }, { resolutions: [{ label: "Work", id: "a" }, { label: "Work", id: "b" }] },
    { resolutions: [{ label: "x".repeat(4097), id: "a" }] }, { resolutions: [{ label: "Work", id: "x".repeat(513) }] },
  ])("rejects malformed input %j", (body) => {
    expect(() => parseThreadResolutions(body)).toThrow(ResolutionInputError);
  });
});

describe("resolutions against the pending report", () => {
  it("only accepts labels awaiting resolution and offered candidates", () => {
    expect(() => checkResolutionsAgainstPending([{ label: "Work", id: "work-b" }, { label: "Deleted chat", id: "anything" },
      { label: "Deleted chat", id: null }], pending)).not.toThrow();
    expect(() => checkResolutionsAgainstPending([{ label: "Friends", id: "x" }], pending)).toThrow("not awaiting resolution");
    expect(() => checkResolutionsAgainstPending([{ label: "Work", id: "work-c" }], pending)).toThrow("not offered");
    expect(() => checkResolutionsAgainstPending([{ label: "Work", id: "work-a" }], null)).toThrow("not awaiting resolution");
  });
});

describe("box-side documents", () => {
  it("reads absent documents as empty and rejects corrupt ones", async () => {
    expect(await readPendingResolution("box")).toBeNull();
    expect(await readThreadResolutions("box")).toEqual([]);
    files.set(PENDING_RESOLUTION_PATH, JSON.stringify({ schema: 1, unresolved: [{ label: "x", candidates: [1] }], reported_at: "t" }));
    await expect(readPendingResolution("box")).rejects.toThrow("Invalid pending resolution document");
    files.set(RESOLUTIONS_PATH, JSON.stringify({ schema: 2, resolutions: [] }));
    await expect(readThreadResolutions("box")).rejects.toThrow("Invalid thread resolutions document");
  });
  it("saves under the archive lease, merges with earlier decisions, and reports what remains", async () => {
    files.set(PENDING_RESOLUTION_PATH, JSON.stringify(pending));
    files.set(RESOLUTIONS_PATH, JSON.stringify({ schema: 1, resolutions: [{ label: "Work", id: "work-a" }] }));
    const view = await saveResolutions(supabase, "owner", { resolutions: [{ label: "Work", id: "work-b" }] });
    expect(withStateLease).toHaveBeenCalledOnce();
    expect(view).toEqual({ unresolved: [{ label: "Deleted chat", candidates: [] }], reported_at: pending.reported_at,
      resolutions: [{ label: "Work", id: "work-b" }] });
    expect(JSON.parse(files.get(RESOLUTIONS_PATH)!)).toEqual({ schema: 1, resolutions: [{ label: "Work", id: "work-b" }] });
    expect(await readResolutionView(supabase, "owner")).toEqual(view);
    const done = await saveResolutions(supabase, "owner", { resolutions: [{ label: "Deleted chat", id: null }] });
    expect(done.unresolved).toEqual([]);
    expect(done.resolutions).toEqual([{ label: "Deleted chat", id: null }, { label: "Work", id: "work-b" }]);
  });
  it("writes nothing when the body fails validation against the pending report", async () => {
    files.set(PENDING_RESOLUTION_PATH, JSON.stringify(pending));
    await expect(saveResolutions(supabase, "owner", { resolutions: [{ label: "Work", id: "work-c" }] }))
      .rejects.toThrow(ResolutionInputError);
    expect(files.has(RESOLUTIONS_PATH)).toBe(false);
  });
  it("reports nothing pending when no migration has flagged labels", async () => {
    expect(await readResolutionView(supabase, "owner")).toEqual({ unresolved: [], reported_at: null, resolutions: [] });
  });
});
