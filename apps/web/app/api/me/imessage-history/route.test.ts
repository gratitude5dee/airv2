import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/user", () => ({ sessionUserId: () => "owner" }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/miniapps/onboardingMirror", async () => {
  const ingest = await import("@/lib/imessage/ingest");
  return {
    writeStatusMirror: vi.fn(),
    readIngestStatusOrMirror: vi.fn(async (supabase: unknown, userId: string) => ({
      status: await ingest.readIngestStatus(supabase as never, userId),
      source: "live" as const,
      refreshedAt: null,
    })),
  };
});
vi.mock("@/lib/orchestrator/boxes", () => ({ armStopAfter: vi.fn(async () => undefined), StartLimitError: class extends Error {} }));
vi.mock("@/lib/env", () => ({ env: { appOrigin: () => "https://air.test", miniappSigningKey: () => "secret" } }));
const status = vi.hoisted(() => ({ chunks: 1, messages: 1, last_upload_at: "2026-09-01T00:00:01.000Z", from_date: "2026-08-01T00:00:00Z",
  to_date: "2026-09-01T00:00:00Z", cursor: "2026-09-01T00:00:00.000Z", pending_resolutions: 0 }));
vi.mock("@/lib/imessage/ingest", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/imessage/ingest")>(),
  verifyIngestTicket: vi.fn(() => ({ userId: "owner" })),
  mintIngestTicket: vi.fn(() => "ticket"),
  readIngestStatus: vi.fn(async () => status),
  storeChunk: vi.fn(async () => status),
}));
import { GET, POST } from "./route";
import { readIngestStatus, storeChunk, verifyIngestTicket, MAX_CHUNK_BYTES } from "@/lib/imessage/ingest";
import { StateBusyError } from "@/lib/miniapps/stateLease";
import { ArchiveMigrationError, ArchiveResolutionError } from "@/lib/imessage/archiveMigrateStore";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { readIngestStatusOrMirror, writeStatusMirror } from "@/lib/miniapps/onboardingMirror";
const body = { messages: [{ id: "msg", chat_id: "chat", chat: "Friends", from: "Sam", text: "Hello", ts: "2026-09-01T00:00:00Z", is_from_me: false }], threads: [{ id: "chat", label: "Friends" }] };
function request(value = JSON.stringify(body)) {
  return new NextRequest("https://air.test/api/me/imessage-history", { method: "POST", headers: { authorization: "Bearer ticket" }, body: value });
}
beforeEach(() => vi.clearAllMocks());
describe("archive upload route", () => {
  it("passes parsed identities and catalogue to the owner archive writer and returns the committed cursor", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status, cursor: status.cursor });
    expect(storeChunk).toHaveBeenCalledWith({}, "owner", body);
    expect(writeStatusMirror).toHaveBeenCalledWith({}, "owner", { ingest: status });
  });
  it("rejects invalid tickets before storage", async () => {
    vi.mocked(verifyIngestTicket).mockReturnValueOnce(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "invalid_ticket", retriable: false });
    expect(storeChunk).not.toHaveBeenCalled();
  });
  it.each(["yesterday", "2026-02-30T00:00:00Z", "2026-09-01T24:00:00Z"])(
    "rejects invalid message dates before migration or writes: %s", async (ts) => {
      const response = await POST(request(JSON.stringify({ ...body, messages: [{ ...body.messages[0], ts }] })));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "invalid_chunk", retriable: false });
      expect(response.headers.get("Retry-After")).toBeNull();
      expect(storeChunk).not.toHaveBeenCalled();
    }
  );
  it("labels malformed JSON as terminal", async () => {
    const response = await POST(request("{nope"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_json", retriable: false });
  });
  it("enforces byte limits on multibyte input before storage", async () => {
    const response = await POST(request("🧠".repeat(MAX_CHUNK_BYTES / 4 + 1)));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "upload_too_large", retriable: false, error: expect.stringContaining(String(MAX_CHUNK_BYTES)) });
    expect(storeChunk).not.toHaveBeenCalled();
  });
  it("returns retry instructions for archive contention", async () => {
    vi.mocked(storeChunk).mockRejectedValueOnce(new StateBusyError());
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(await response.json()).toMatchObject({ code: "archive_busy", retriable: true, retry_after_seconds: 2 });
    expect(writeStatusMirror).not.toHaveBeenCalled();
  });
  it("points the uploader at the owner-session resolution endpoint without echoing labels", async () => {
    vi.mocked(storeChunk).mockRejectedValueOnce(new ArchiveResolutionError([{ label: "Secret group", candidates: ["a", "b"] }]));
    const response = await POST(request());
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).not.toContain("Secret group");
    expect(text).not.toContain("candidates");
    expect(JSON.parse(text)).toEqual({
      code: "resolution_required", retriable: false,
      error: expect.stringContaining("resolve them"),
      resolve_at: "https://air.test/api/me/imessage-history/resolutions",
    });
    expect(response.headers.get("Retry-After")).toBeNull();
    expect(writeStatusMirror).not.toHaveBeenCalled();
  });
  it("distinguishes retriable from terminal migration failures", async () => {
    vi.mocked(storeChunk).mockRejectedValueOnce(new ArchiveMigrationError("Legacy archive changed during migration", { retriable: true }));
    let response = await POST(request());
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.json()).toMatchObject({ code: "migration_failed", retriable: true, retry_after_seconds: 5, error: expect.stringContaining("changed during migration") });
    vi.mocked(storeChunk).mockRejectedValueOnce(new ArchiveMigrationError("Legacy archive inventory failed"));
    response = await POST(request());
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBeNull();
    expect(await response.json()).toMatchObject({ code: "migration_failed", retriable: false });
    expect(writeStatusMirror).not.toHaveBeenCalled();
  });
  it("treats box start throttling and unknown failures as retriable", async () => {
    vi.mocked(storeChunk).mockRejectedValueOnce(new StartLimitError());
    let response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "box_starting", retriable: true, retry_after_seconds: 60 });
    vi.mocked(storeChunk).mockRejectedValueOnce(new Error("box exploded: label Secret group"));
    response = await POST(request());
    expect(response.status).toBe(502);
    expect(response.headers.get("Retry-After")).toBe("10");
    const text = await response.text();
    expect(text).not.toContain("Secret group");
    expect(JSON.parse(text)).toMatchObject({ code: "upload_failed", retriable: true });
  });
});
describe("archive status route", () => {
  const get = () => GET(new NextRequest("https://air.test/api/me/imessage-history"));
  it("returns the saved cursor and a command that resumes from it", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.cursor).toBe(status.cursor);
    expect(json.status).toEqual(status);
    expect(json.command).toContain("bash /tmp/air-ingest.sh ticket 365 2026-09-01T00:00:00.000Z");
    expect(json.command).toContain("AIR_INGEST_ENDPOINT=https://air.test/api/me/imessage-history");
    expect(json.source).toBe("live");
  });
  it("answers from the mirror for a sleeping box and still resumes from the mirrored cursor", async () => {
    vi.mocked(readIngestStatusOrMirror).mockResolvedValueOnce({
      status: { ...status, cursor: "2026-08-15T00:00:00.000Z" }, source: "mirror", refreshedAt: "2026-09-01T00:00:02.000Z",
    });
    const json = await (await get()).json();
    expect(json.source).toBe("mirror");
    expect(json.refreshed_at).toBe("2026-09-01T00:00:02.000Z");
    expect(json.cursor).toBe("2026-08-15T00:00:00.000Z");
    expect(json.command).toContain("bash /tmp/air-ingest.sh ticket 365 2026-08-15T00:00:00.000Z");
    expect(readIngestStatus).not.toHaveBeenCalled();
  });
  it("returns a null status when the box sleeps and nothing has been mirrored yet", async () => {
    vi.mocked(readIngestStatusOrMirror).mockResolvedValueOnce({ status: null, source: "mirror", refreshedAt: null });
    const json = await (await get()).json();
    expect(json.status).toBeNull();
    expect(json.cursor).toBeNull();
    expect(json.command).toMatch(/air-ingest\.sh ticket$/);
  });
  it("omits the cursor argument when none is saved or it is out of bounds", async () => {
    vi.mocked(readIngestStatus).mockResolvedValueOnce({ ...status, cursor: null });
    expect((await (await get()).json()).command).toMatch(/air-ingest\.sh ticket$/);
    vi.mocked(readIngestStatus).mockResolvedValueOnce({ ...status, cursor: "2999-01-01T00:00:00.000Z" });
    expect((await (await get()).json()).command).toMatch(/air-ingest\.sh ticket$/);
  });
});
