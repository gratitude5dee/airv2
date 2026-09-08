import { beforeEach, describe, expect, it, vi } from "vitest";
const files = new Map<string, string>();
let failMarker = false;
let listings = 0;
let beforeListing: (() => void) | null = null;
vi.mock("../box/client", async (importOriginal) => {
  const { BoxApiError } = await importOriginal<typeof import("../box/client")>();
  return { BoxApiError,
    readFile: vi.fn(async (_box: string, path: string) => {
      if (!files.has(path)) throw new BoxApiError(404, "missing");
      return files.get(path)!;
    }),
    command: vi.fn(async (_box: string, script: string) => {
      if (script.includes("names = set()")) {
        listings += 1;
        beforeListing?.();
        return { exitCode: 0, stdout: JSON.stringify([...new Set([...files.keys()].filter((p) => /chunk-\d+\.json$/.test(p)).map((p) => p.split("/").at(-1)))]), stderr: "" };
      }
      const name = script.match(/chunk-\d+\.json/)?.[0];
      if (name) {
        const source = `.hermes/context/imessage-history/${name}`;
        if (files.has(source)) {
          files.set(`.hermes/context/imessage-archive-state/legacy/${name}`, files.get(source)!);
          files.delete(source);
        }
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    }),
  };
});
vi.mock("./archiveWrite", () => ({ writeArchiveFile: vi.fn(async (_box: string, path: string, content: string) => {
  if (failMarker) throw new Error("marker interrupted");
  files.set(path, content);
}) }));
vi.mock("./archiveStore", () => ({ storeArchiveMessages: vi.fn(async () => ({ messages: 1 })) }));
vi.mock("../memory/deep", () => ({ deepMemoryForget: vi.fn(async () => true), OV_IMESSAGE_URI: "viking://resources/context/imessage-history" }));
import { storeArchiveMessages } from "./archiveStore";
import { deepMemoryForget } from "../memory/deep";
import { ArchiveMigrationError, ArchiveResolutionError, migrateLegacyArchive } from "./archiveMigrateStore";
import { PENDING_RESOLUTION_PATH, RESOLUTIONS_PATH } from "./archiveResolutions";
const legacy = { chat: "Friends", ts: "2026-09-01T00:00:00Z", from: "Sam", text: "Hello", is_from_me: false };
const catalogue = [{ id: "thread", label: "Friends" }];
const renew = async () => undefined;
beforeEach(() => { files.clear(); failMarker = false; listings = 0; beforeListing = null; vi.clearAllMocks(); vi.mocked(deepMemoryForget).mockResolvedValue(true); });
describe("legacy archive migration orchestration", () => {
  it.each(["{broken", JSON.stringify([{ ...legacy, ts: "2026-02-30T00:00:00Z" }])])(
    "rejects a corrupt later chunk before migrating the first: %s", async (corrupt) => {
      files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
      files.set(".hermes/context/imessage-history/chunk-2.json", corrupt);
      await expect(migrateLegacyArchive("box", catalogue, renew)).rejects.toThrow();
      expect(storeArchiveMessages).not.toHaveBeenCalled();
      expect(deepMemoryForget).not.toHaveBeenCalled();
      expect(files.size).toBe(2);
    }
  );
  it("preflights every source before archive writes when a later chunk is ambiguous, recording the full list for the owner", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy, { ...legacy, chat: "Work" }]));
    files.set(".hermes/context/imessage-history/chunk-2.json", JSON.stringify([{ ...legacy, chat: "Unknown" }]));
    const twoWork = [...catalogue, { id: "work-a", label: "Work" }, { id: "work-b", label: "Work" }];
    const error = await migrateLegacyArchive("box", twoWork, renew).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ArchiveResolutionError);
    expect(error).toBeInstanceOf(ArchiveMigrationError);
    expect((error as ArchiveResolutionError).message).toBe("Legacy chat identities need resolution before migration");
    expect((error as ArchiveResolutionError).retriable).toBe(false);
    expect((error as ArchiveResolutionError).unresolved).toEqual([
      { label: "Unknown", candidates: [] },
      { label: "Work", candidates: ["work-a", "work-b"] },
    ]);
    expect(storeArchiveMessages).not.toHaveBeenCalled();
    expect(deepMemoryForget).not.toHaveBeenCalled();
    expect([...files.keys()].filter((path) => !path.includes("imessage-history/"))).toEqual([PENDING_RESOLUTION_PATH]);
    expect(JSON.parse(files.get(PENDING_RESOLUTION_PATH)!)).toMatchObject({
      schema: 1, unresolved: (error as ArchiveResolutionError).unresolved,
    });
  });
  it("applies saved owner resolutions ahead of the catalogue and clears the pending report", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([
      legacy, { ...legacy, chat: "Work" }, { ...legacy, chat: "Unknown" },
    ]));
    files.set(PENDING_RESOLUTION_PATH, JSON.stringify({ schema: 1, reported_at: "2026-09-01T00:00:00Z", unresolved: [
      { label: "Unknown", candidates: [] }, { label: "Work", candidates: ["work-a", "work-b"] },
    ] }));
    files.set(RESOLUTIONS_PATH, JSON.stringify({ schema: 1, resolutions: [
      { label: "Work", id: "work-b" }, { label: "Unknown", id: null },
    ] }));
    await migrateLegacyArchive("box", [...catalogue, { id: "work-a", label: "Work" }, { id: "work-b", label: "Work" }], renew);
    expect(storeArchiveMessages).toHaveBeenCalledWith("box", [
      { ...legacy, chat_id: "thread" },
      { ...legacy, chat: "Work", chat_id: "work-b" },
      { ...legacy, chat: "Unknown" },
    ], renew);
    expect(JSON.parse(files.get(PENDING_RESOLUTION_PATH)!).unresolved).toEqual([]);
    expect(files.has(".hermes/context/imessage-archive-state/migration.json")).toBe(true);
  });
  it("rejects a corrupt resolutions document before any archive writes", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    files.set(RESOLUTIONS_PATH, JSON.stringify({ schema: 1, resolutions: [{ label: "Work", id: "" }] }));
    await expect(migrateLegacyArchive("box", catalogue, renew)).rejects.toThrow("Invalid thread resolutions document");
    expect(storeArchiveMessages).not.toHaveBeenCalled();
  });
  it("retains original bytes in backup and skips a completed migration", async () => {
    const content = JSON.stringify([legacy]);
    files.set(".hermes/context/imessage-history/chunk-1.json", content);
    await migrateLegacyArchive("box", catalogue, renew);
    expect(files.get(".hermes/context/imessage-archive-state/legacy/chunk-1.json")).toBe(content);
    expect(storeArchiveMessages).toHaveBeenCalledWith("box", [{ ...legacy, chat_id: "thread" }], renew);
    await migrateLegacyArchive("box", catalogue, renew);
    expect(storeArchiveMessages).toHaveBeenCalledOnce();
  });
  it("recovers from a crash after backup but before the completion marker", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    failMarker = true;
    await expect(migrateLegacyArchive("box", catalogue, renew)).rejects.toThrow("marker interrupted");
    failMarker = false;
    await migrateLegacyArchive("box", catalogue, renew);
    expect(storeArchiveMessages).toHaveBeenCalledTimes(2);
    expect(files.has(".hermes/context/imessage-archive-state/migration.json")).toBe(true);
  });
  it("refuses the marker when a raw chunk appears mid-migration, then migrates it on retry", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    const late = JSON.stringify([{ ...legacy, chat: "Work", ts: "2026-09-02T00:00:00Z" }]);
    beforeListing = () => {
      if (listings === 2) files.set(".hermes/context/imessage-history/chunk-2.json", late);
    };
    const error = await migrateLegacyArchive("box", [...catalogue, { id: "work", label: "Work" }], renew).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ArchiveMigrationError);
    expect((error as ArchiveMigrationError).message).toBe("Legacy archive changed during migration");
    expect((error as ArchiveMigrationError).retriable).toBe(true);
    expect(listings).toBe(2);
    expect(files.has(".hermes/context/imessage-archive-state/migration.json")).toBe(false);
    expect(files.get(".hermes/context/imessage-history/chunk-2.json")).toBe(late);
    expect(storeArchiveMessages).toHaveBeenCalledOnce();
    await migrateLegacyArchive("box", [...catalogue, { id: "work", label: "Work" }], renew);
    expect(storeArchiveMessages).toHaveBeenLastCalledWith("box", [
      { ...legacy, chat: "Work", ts: "2026-09-02T00:00:00Z", chat_id: "work" },
    ], renew);
    expect(files.get(".hermes/context/imessage-archive-state/legacy/chunk-2.json")).toBe(late);
    expect(JSON.parse(files.get(".hermes/context/imessage-archive-state/migration.json")!)).toMatchObject({ schema: 1, legacy_chunks: 2 });
  });
  it("takes the inventory once more before the marker and accepts an unchanged one", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    await migrateLegacyArchive("box", catalogue, renew);
    expect(listings).toBe(2);
    expect(files.has(".hermes/context/imessage-archive-state/migration.json")).toBe(true);
  });
  it("retains the original when legacy index cleanup fails", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    vi.mocked(deepMemoryForget).mockResolvedValue(false);
    const error = await migrateLegacyArchive("box", catalogue, renew).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ArchiveMigrationError);
    expect((error as ArchiveMigrationError).message).toContain("index cleanup failed");
    expect((error as ArchiveMigrationError).retriable).toBe(true);
    expect(files.has(".hermes/context/imessage-history/chunk-1.json")).toBe(true);
    expect(files.has(".hermes/context/imessage-archive-state/migration.json")).toBe(false);
  });
});
