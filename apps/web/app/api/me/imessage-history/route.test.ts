import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/user", () => ({ sessionUserId: () => "owner" }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/miniapps/onboardingMirror", () => ({ writeStatusMirror: vi.fn() }));
vi.mock("@/lib/orchestrator/boxes", () => ({ armStopAfter: vi.fn(async () => undefined), StartLimitError: class extends Error {} }));
vi.mock("@/lib/imessage/ingest", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/imessage/ingest")>(),
  verifyIngestTicket: vi.fn(() => ({ userId: "owner" })),
  storeChunk: vi.fn(async () => ({ messages: 1, chunks: 1 })),
}));
import { POST } from "./route";
import { storeChunk, verifyIngestTicket, MAX_CHUNK_BYTES } from "@/lib/imessage/ingest";
import { StateBusyError } from "@/lib/miniapps/stateLease";
import { ArchiveMigrationError } from "@/lib/imessage/archiveMigrateStore";
import { writeStatusMirror } from "@/lib/miniapps/onboardingMirror";
const body = { messages: [{ id: "msg", chat_id: "chat", chat: "Friends", from: "Sam", text: "Hello", ts: "2026-09-01T00:00:00Z", is_from_me: false }], threads: [{ id: "chat", label: "Friends" }] };
function request(value = JSON.stringify(body)) {
  return new NextRequest("https://air.test/api/me/imessage-history", { method: "POST", headers: { authorization: "Bearer ticket" }, body: value });
}
beforeEach(() => vi.clearAllMocks());
describe("archive upload route", () => {
  it("passes parsed identities and catalogue to the owner archive writer", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(storeChunk).toHaveBeenCalledWith({}, "owner", body);
    expect(writeStatusMirror).toHaveBeenCalledOnce();
  });
  it("rejects invalid tickets before storage", async () => {
    vi.mocked(verifyIngestTicket).mockReturnValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    expect(storeChunk).not.toHaveBeenCalled();
  });
  it.each(["yesterday", "2026-02-30T00:00:00Z", "2026-09-01T24:00:00Z"])(
    "rejects invalid message dates before migration or writes: %s", async (ts) => {
      const response = await POST(request(JSON.stringify({ ...body, messages: [{ ...body.messages[0], ts }] })));
      expect(response.status).toBe(400);
      expect(storeChunk).not.toHaveBeenCalled();
    }
  );
  it("enforces byte limits on multibyte input before storage", async () => {
    const response = await POST(request("🧠".repeat(MAX_CHUNK_BYTES / 4 + 1)));
    expect(response.status).toBe(413);
    expect(storeChunk).not.toHaveBeenCalled();
  });
  it("returns retry instructions for archive contention", async () => {
    vi.mocked(storeChunk).mockRejectedValueOnce(new StateBusyError());
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(writeStatusMirror).not.toHaveBeenCalled();
  });
  it("reports unresolved migration without claiming an upload succeeded", async () => {
    vi.mocked(storeChunk).mockRejectedValueOnce(new ArchiveMigrationError("Legacy chat identities need resolution before migration"));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("identities need resolution");
    expect(writeStatusMirror).not.toHaveBeenCalled();
  });
});
