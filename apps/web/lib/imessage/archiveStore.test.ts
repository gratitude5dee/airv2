import { beforeEach, describe, expect, it, vi } from "vitest";
const files = new Map<string, string>();
let failPath = "";
vi.mock("../box/client", async (importOriginal) => {
  const { BoxApiError } = await importOriginal<typeof import("../box/client")>();
  return { BoxApiError,
    readFile: vi.fn(async (_box: string, path: string) => {
      if (!files.has(path)) throw new BoxApiError(404, "missing");
      return files.get(path)!;
    }),
    writeFile: vi.fn(async (_box: string, path: string, content: string) => {
      if (path.includes(failPath) && failPath) throw new Error("write interrupted");
      files.set(path, content);
    }),
  };
});
vi.mock("../memory/deep", () => ({ deepMemoryIndex: vi.fn(async () => true), OV_IMESSAGE_URI: "viking://resources/context/imessage-history" }));
import { deepMemoryIndex } from "../memory/deep";
import { readFile, writeFile } from "../box/client";
vi.mock("./archiveWrite", () => ({
  writeArchiveFile: (box: string, path: string, content: string) => writeFile(box, path, content),
}));
import { storeArchiveMessages } from "./archiveStore";
const message = { id: "one", chat_id: "chat", chat: "Friends", from: "Sam", is_from_me: false, ts: "2026-09-01T00:00:00Z", text: "Meet at Olive at 7." };
const renew = vi.fn(async () => undefined);
beforeEach(() => { files.clear(); failPath = ""; vi.clearAllMocks(); vi.mocked(deepMemoryIndex).mockResolvedValue(true); });

describe("archive persistence recovery", () => {
  it("stores readable history once and leaves retries unchanged", async () => {
    const original = await storeArchiveMessages("box", [message], renew);
    expect(original.messages).toBe(1);
    expect([...files].find(([path]) => path.endsWith(".md"))?.[1]).toContain("Meet at Olive at 7.");
    vi.mocked(writeFile).mockClear();
    expect(await storeArchiveMessages("box", [message], renew)).toEqual(original);
    expect(writeFile).not.toHaveBeenCalled();
    expect(deepMemoryIndex).toHaveBeenCalledOnce();
  });
  it.each([".md", "manifest.json"])("repairs an interrupted %s write without losing or double-counting messages", async (path) => {
    failPath = path;
    await expect(storeArchiveMessages("box", [message], renew)).rejects.toThrow("interrupted");
    failPath = "";
    const result = await storeArchiveMessages("box", [message], renew);
    expect(result.messages).toBe(1);
    expect([...files.keys()].filter((key) => key.endsWith(".md"))).toHaveLength(1);
    expect(deepMemoryIndex).toHaveBeenCalledOnce();
  });
  it("retries a failed enqueue without changing saved message counts", async () => {
    vi.mocked(deepMemoryIndex).mockResolvedValueOnce(false);
    expect((await storeArchiveMessages("box", [message], renew)).messages).toBe(1);
    expect((await storeArchiveMessages("box", [message], renew)).messages).toBe(1);
    expect(deepMemoryIndex).toHaveBeenCalledTimes(2);
  });
  it("merges overlap across uploads and derives total ranges from all partitions", async () => {
    await storeArchiveMessages("box", [message], renew);
    const older = { ...message, id: "older", ts: "2026-08-01T00:00:00Z" };
    const later = { ...message, id: "later", ts: "2026-09-02T00:00:00Z" };
    const result = await storeArchiveMessages("box", [older, message, later], renew);
    expect(result).toEqual({ messages: 3, partitions: 2, from: "2026-08-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" });
    expect((await storeArchiveMessages("box", [{ ...message, text: "Meet at 8." }], renew)).messages).toBe(3);
  });
  it("stops before mutation if the caller has lost the archive lease", async () => {
    await expect(storeArchiveMessages("box", [message], async () => { throw new Error("lease lost"); })).rejects.toThrow("lease lost");
    expect(writeFile).not.toHaveBeenCalled();
    expect(deepMemoryIndex).not.toHaveBeenCalled();
  });
  it("refuses writes on an unreadable manifest", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("offline"));
    await expect(storeArchiveMessages("box", [message], renew)).rejects.toThrow("offline");
    expect(writeFile).not.toHaveBeenCalled();
  });
});
