import { beforeEach, describe, expect, it, vi } from "vitest";
const files = new Map<string, string>();
let failMarker = false;
vi.mock("../box/client", async (importOriginal) => {
  const { BoxApiError } = await importOriginal<typeof import("../box/client")>();
  return { BoxApiError,
    readFile: vi.fn(async (_box: string, path: string) => {
      if (!files.has(path)) throw new BoxApiError(404, "missing");
      return files.get(path)!;
    }),
    command: vi.fn(async (_box: string, script: string) => {
      if (script.includes("names = set()")) return { exitCode: 0, stdout: JSON.stringify([...new Set([...files.keys()].filter((p) => /chunk-\d+\.json$/.test(p)).map((p) => p.split("/").at(-1)))]), stderr: "" };
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
import { migrateLegacyArchive } from "./archiveMigrateStore";
const legacy = { chat: "Friends", ts: "2026-09-01T00:00:00Z", from: "Sam", text: "Hello", is_from_me: false };
const catalogue = [{ id: "thread", label: "Friends" }];
const renew = async () => undefined;
beforeEach(() => { files.clear(); failMarker = false; vi.clearAllMocks(); vi.mocked(deepMemoryForget).mockResolvedValue(true); });
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
  it("preflights every source before writes when a later chunk is ambiguous", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    files.set(".hermes/context/imessage-history/chunk-2.json", JSON.stringify([{ ...legacy, chat: "Unknown" }]));
    await expect(migrateLegacyArchive("box", catalogue, renew)).rejects.toThrow("identities need resolution");
    expect(storeArchiveMessages).not.toHaveBeenCalled();
    expect(files.size).toBe(2);
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
  it("retains the original when legacy index cleanup fails", async () => {
    files.set(".hermes/context/imessage-history/chunk-1.json", JSON.stringify([legacy]));
    vi.mocked(deepMemoryForget).mockResolvedValue(false);
    await expect(migrateLegacyArchive("box", catalogue, renew)).rejects.toThrow("index cleanup failed");
    expect(files.has(".hermes/context/imessage-history/chunk-1.json")).toBe(true);
    expect(files.has(".hermes/context/imessage-archive-state/migration.json")).toBe(false);
  });
});
