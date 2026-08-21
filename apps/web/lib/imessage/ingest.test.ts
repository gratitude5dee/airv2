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
  env: { miniappSigningKey: () => "test-signing-key" },
}));
vi.mock("../box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
}));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
}));

import {
  IngestInputError,
  mintIngestTicket,
  parseChunk,
  readIngestStatus,
  storeChunk,
  verifyIngestTicket,
} from "./ingest";

const supabase = {} as SupabaseClient;

beforeEach(() => boxFiles.clear());

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

  it("writes chunk + status into the box and accumulates counts", async () => {
    let status = await storeChunk(supabase, "user-1", chunk);
    expect(status.chunks).toBe(1);
    expect(status.messages).toBe(1);
    status = await storeChunk(supabase, "user-1", chunk);
    expect(status.chunks).toBe(2);
    expect(status.messages).toBe(2);
    expect(status.from_date).toBe("2026-05-01");
    const paths = [...boxFiles.keys()];
    expect(paths).toContain(".hermes/context/imessage-history/status.json");
    expect(
      paths.filter((p) => p.includes("/chunk-")).length
    ).toBeGreaterThanOrEqual(1);
    const read = await readIngestStatus(supabase, "user-1");
    expect(read.messages).toBe(2);
  });

  it("returns the default status when nothing was uploaded", async () => {
    const status = await readIngestStatus(supabase, "user-1");
    expect(status.chunks).toBe(0);
    expect(status.last_upload_at).toBeNull();
  });
});
