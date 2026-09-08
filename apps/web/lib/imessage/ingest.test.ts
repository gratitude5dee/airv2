/**
 * iMessage ingest coverage: the upload ticket round-trips with its own
 * domain-separating use claim (a fill ticket or mini-app token can never
 * pass), expired/garbled tokens fail closed, chunk validation rejects odd
 * shapes, and storeChunk writes content into the box only — Postgres never
 * sees a message byte (C4).
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const boxFiles = new Map<string, string>();

vi.mock("../env", () => ({
  env: { miniappSigningKey: () => "test-signing-key", appOrigin: () => "https://air.test" },
}));
vi.mock("../box/client", async (importOriginal) => {
  const { BoxApiError } = await importOriginal<typeof import("../box/client")>();
  return {
  BoxApiError,
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new BoxApiError(404, "not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
  };
});
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
}));

import {
  buildIngestCommand,
  IngestInputError,
  mintIngestTicket,
  normalizeCursor,
  normalizeIngestStatus,
  parseChunk,
  readIngestStatus,
  storeChunk,
  verifyIngestTicket,
} from "./ingest";

const supabase = { rpc: async () => ({ data: true, error: null }) } as unknown as SupabaseClient;
import { readFile, writeFile } from "../box/client";
vi.mock("./archiveMigrateStore", () => ({ migrateLegacyArchive: vi.fn(async () => undefined) }));
vi.mock("./archiveWrite", () => ({ writeArchiveFile: (box: string, path: string, content: string) => writeFile(box, path, content) }));
vi.mock("../memory/deep", () => ({ deepMemoryIndex: vi.fn(async () => true), OV_IMESSAGE_URI: "viking://resources/context/imessage-history" }));

beforeEach(() => { boxFiles.clear(); vi.clearAllMocks(); });

describe("ingest tickets", () => {
  it("round-trips for the minting user", () => {
    const token = mintIngestTicket("user-1");
    const claims = verifyIngestTicket(token);
    expect(claims?.userId).toBe("user-1");
    expect(claims?.use).toBe("imessage_ingest");
  });

  it("rejects tampered and garbled tokens", () => {
    const token = mintIngestTicket("user-1");
    expect(verifyIngestTicket(`${token}x`)).toBeNull();
    expect(verifyIngestTicket("not-a-token")).toBeNull();
    expect(verifyIngestTicket("")).toBeNull();
  });

  it("rejects a token whose use claim is not imessage_ingest", () => {
    const payload = Buffer.from(
      JSON.stringify({
        use: "fill_ticket",
        userId: "user-1",
        jti: "j",
        exp: Math.floor(Date.now() / 1000) + 60,
      })
    ).toString("base64url");
    // Signed with the same key but the wrong use claim — must fail.
    const mac = createHmac("sha256", "test-signing-key")
      .update(payload)
      .digest("base64url");
    expect(verifyIngestTicket(`${payload}.${mac}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const payload = Buffer.from(
      JSON.stringify({
        use: "imessage_ingest",
        userId: "user-1",
        jti: "j",
        exp: Math.floor(Date.now() / 1000) - 1,
      })
    ).toString("base64url");
    const mac = createHmac("sha256", "test-signing-key")
      .update(payload)
      .digest("base64url");
    expect(verifyIngestTicket(`${payload}.${mac}`)).toBeNull();
  });
});

describe("parseChunk", () => {
  const message = {
    ts: "2026-08-18 12:00:00",
    chat: "chat1",
    from: "+15551234567",
    is_from_me: false,
    text: "hi",
  };

  it("accepts a well-formed chunk", () => {
    const chunk = parseChunk({
      messages: [message],
      from_date: "a",
      to_date: "b",
    });
    expect(chunk.messages).toHaveLength(1);
    expect(chunk.from_date).toBe("a");
  });

  it("preserves stable extractor message and thread identities", () => {
    const parsed = parseChunk({ messages: [{ ...message, id: "message-guid", chat_id: "chat-guid" }] });
    expect(parsed.messages[0]).toMatchObject({ id: "message-guid", chat_id: "chat-guid" });
  });

  it("preserves a complete thread catalogue including duplicate display labels", () => {
    const threads = [{ id: "one", label: "Friends" }, { id: "two", label: "Friends" }];
    expect(parseChunk({ messages: [message], threads }).threads).toEqual(threads);
  });

  it.each([null, {}, [{ id: "", label: "Friends" }], [{ id: "one", label: 3 }]])(
    "rejects malformed thread catalogues: %s", (threads) => {
      expect(() => parseChunk({ messages: [message], threads })).toThrow(IngestInputError);
    }
  );

  it("rejects non-objects, empty arrays, and bad message shapes", () => {
    expect(() => parseChunk(null)).toThrow(IngestInputError);
    expect(() => parseChunk({ messages: [] })).toThrow(IngestInputError);
    expect(() => parseChunk({ messages: "nope" })).toThrow(IngestInputError);
    expect(() =>
      parseChunk({ messages: [{ ...message, text: 5 }] })
    ).toThrow(IngestInputError);
    expect(() =>
      parseChunk({ messages: [{ ...message, is_from_me: "yes" }] })
    ).toThrow(IngestInputError);
  });
});

describe("storeChunk / readIngestStatus", () => {
  const chunk = {
    messages: [
      {
        ts: "2026-08-18 12:00:00",
        chat: "chat1",
        from: "me",
        is_from_me: true,
        text: "hello",
      },
    ],
    from_date: "2026-05-01",
    to_date: "2026-08-18",
  };

  it("writes thread history and derives counts without duplicating retried uploads", async () => {
    let status = await storeChunk(supabase, "user-1", chunk);
    expect(status.chunks).toBe(1);
    expect(status.messages).toBe(1);
    status = await storeChunk(supabase, "user-1", chunk);
    expect(status.chunks).toBe(1);
    expect(status.messages).toBe(1);
    expect(status.from_date).toBe("2026-08-18T12:00:00.000Z");
    expect(status.cursor).toBe("2026-08-18T12:00:00.000Z");
    const paths = [...boxFiles.keys()];
    expect(paths).toContain(".hermes/context/imessage-history/status.json");
    expect(
      paths.filter((p) => p.endsWith(".md")).length
    ).toBe(1);
    const read = await readIngestStatus(supabase, "user-1");
    expect(read.messages).toBe(1);
  });

  it("returns the default status when nothing was uploaded", async () => {
    const status = await readIngestStatus(supabase, "user-1");
    expect(status.chunks).toBe(0);
    expect(status.last_upload_at).toBeNull();
    expect(status.cursor).toBeNull();
  });

  it("advances the cursor to the latest committed timestamp across chunks and survives a reread", async () => {
    await storeChunk(supabase, "user-1", chunk);
    const later = { ...chunk, messages: [{ ...chunk.messages[0]!, ts: "2026-08-20 08:30:00", text: "later" }] };
    const status = await storeChunk(supabase, "user-1", later);
    expect(status.cursor).toBe("2026-08-20T08:30:00.000Z");
    expect(status.to_date).toBe("2026-08-20T08:30:00.000Z");
    const earlier = { ...chunk, messages: [{ ...chunk.messages[0]!, ts: "2026-08-10 08:30:00", text: "older" }] };
    expect((await storeChunk(supabase, "user-1", earlier)).cursor).toBe("2026-08-20T08:30:00.000Z");
    expect((await readIngestStatus(supabase, "user-1")).cursor).toBe("2026-08-20T08:30:00.000Z");
  });

  it("serializes overlapping uploads without losing either message", async () => {
    let holder: string | null = null;
    let denied = 0;
    const leases = { rpc: async (name: string, args: { p_holder: string; p_app: string; p_resource: string }) => {
      expect(args.p_app).toBe("imessage");
      expect(args.p_resource).toBe("archive");
      if (name === "miniapp_state_release") {
        if (holder === args.p_holder) holder = null;
        return { data: true, error: null };
      }
      if (holder && holder !== args.p_holder) {
        denied++;
        return { data: false, error: null };
      }
      holder = args.p_holder;
      return { data: true, error: null };
    } } as unknown as SupabaseClient;
    const second = { ...chunk, messages: [{ ...chunk.messages[0]!, text: "second message" }] };
    const results = await Promise.all([
      storeChunk(leases, "user-1", chunk),
      storeChunk(leases, "user-1", second),
    ]);
    expect(denied).toBeGreaterThan(0);
    expect(results.map((result) => result.messages).sort()).toEqual([1, 2]);
    expect((await readIngestStatus(supabase, "user-1")).messages).toBe(2);
    const markdown = [...boxFiles.entries()].find(([path]) => path.endsWith(".md"))?.[1];
    expect(markdown).toContain("hello");
    expect(markdown).toContain("second message");
    expect(holder).toBeNull();
  });

  it.each(["{broken", "null", '{"chunks":-1,"messages":2}', '{"chunks":1,"messages":"2"}'])(
    "does not reset or write over invalid status: %s", async (content) => {
      boxFiles.set(".hermes/context/imessage-history/status.json", content);
      await expect(storeChunk(supabase, "user-1", chunk)).rejects.toThrow();
      await expect(readIngestStatus(supabase, "user-1")).rejects.toThrow();
      expect(writeFile).not.toHaveBeenCalled();
    }
  );

  it("preserves status when its read fails", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("offline"));
    await expect(storeChunk(supabase, "user-1", chunk)).rejects.toThrow("offline");
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("resume cursor", () => {
  const now = Date.UTC(2026, 8, 8, 12);
  it("accepts full UTC instants inside the Apple epoch..now+skew window and canonicalises them", () => {
    expect(normalizeCursor("2026-09-01T12:00:00Z", now)).toBe("2026-09-01T12:00:00.000Z");
    expect(normalizeCursor("2026-09-01T12:00:00.5Z", now)).toBe("2026-09-01T12:00:00.500Z");
    expect(normalizeCursor("2026-09-09T11:00:00Z", now)).toBe("2026-09-09T11:00:00.000Z");
    expect(normalizeCursor("2001-01-01T00:00:00Z", now)).toBe("2001-01-01T00:00:00.000Z");
  });
  it.each([
    null, 5, "", "2026-09-01", "2026-09-01 12:00:00", "2026-09-01T12:00:00+01:00", "2026-09-01T12:00:00",
    "yesterday", "2026-02-30T00:00:00Z", "2000-12-31T23:59:59Z", "2026-09-09T13:00:00Z", "0; DROP TABLE message;",
  ])("rejects %j so the extractor restarts from scratch instead of trusting it", (value) => {
    expect(normalizeCursor(value, now)).toBeNull();
  });
  it("derives the cursor from a stored status, preferring cursor over to_date", () => {
    expect(normalizeIngestStatus({ chunks: 1, messages: 1, to_date: "2026-08-18T12:00:00.000Z" }).cursor).toBe("2026-08-18T12:00:00.000Z");
    expect(normalizeIngestStatus({ chunks: 1, messages: 1, to_date: "2026-08-18T12:00:00.000Z", cursor: "2026-08-19T00:00:00Z" }).cursor).toBe("2026-08-19T00:00:00.000Z");
    expect(normalizeIngestStatus({ chunks: 1, messages: 1, to_date: "2026-08-18" }).cursor).toBeNull();
    expect(normalizeIngestStatus({ chunks: 1, messages: 1, cursor: "2999-01-01T00:00:00Z" }).cursor).toBeNull();
  });
  it("puts a saved cursor on the command as the inclusive SINCE_ISO_UTC argument, and nothing else", () => {
    expect(buildIngestCommand("tkt", "2026-08-18T12:00:00.000Z")).toBe(
      "curl -fsSL https://air.test/imessage-ingest.sh -o /tmp/air-ingest.sh && AIR_INGEST_ENDPOINT=https://air.test/api/me/imessage-history bash /tmp/air-ingest.sh tkt 365 2026-08-18T12:00:00.000Z"
    );
    expect(buildIngestCommand("tkt", null)).toMatch(/air-ingest\.sh tkt$/);
    expect(buildIngestCommand("tkt", "2026-08-18; rm -rf /")).toMatch(/air-ingest\.sh tkt$/);
  });
});
