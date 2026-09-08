import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const session = vi.hoisted(() => ({ userId: "owner" as string | null }));
vi.mock("@/lib/auth/user", () => ({ sessionUserId: () => session.userId }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/orchestrator/boxes", () => ({ armStopAfter: vi.fn(async () => undefined), StartLimitError: class extends Error {} }));
vi.mock("@/lib/imessage/archiveResolutions", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/imessage/archiveResolutions")>(),
  readResolutionView: vi.fn(),
  saveResolutions: vi.fn(),
}));
import { GET, POST } from "./route";
import { ResolutionInputError, readResolutionView, saveResolutions } from "@/lib/imessage/archiveResolutions";
import { StateBusyError } from "@/lib/miniapps/stateLease";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
const view = { unresolved: [{ label: "Work", candidates: ["work-a", "work-b"] }], reported_at: "2026-09-01T00:00:00.000Z", resolutions: [] };
const url = "https://air.test/api/me/imessage-history/resolutions";
const post = (body: string) => POST(new NextRequest(url, { method: "POST", body, headers: { "content-type": "application/json" } }));
beforeEach(() => { vi.clearAllMocks(); session.userId = "owner"; vi.mocked(readResolutionView).mockResolvedValue(view); vi.mocked(saveResolutions).mockResolvedValue(view); });

describe("owner resolution route", () => {
  it("requires an owner session, not an upload ticket", async () => {
    session.userId = null;
    expect((await GET(new NextRequest(url, { headers: { authorization: "Bearer ticket" } }))).status).toBe(401);
    expect((await post(JSON.stringify({ resolutions: [] }))).status).toBe(401);
    expect(readResolutionView).not.toHaveBeenCalled();
    expect(saveResolutions).not.toHaveBeenCalled();
  });
  it("returns the pending labels and candidates to the signed-in owner only", async () => {
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(view);
    expect(readResolutionView).toHaveBeenCalledWith({}, "owner");
    expect(armStopAfter).toHaveBeenCalledWith({}, "owner");
  });
  it("saves the owner's mapping and echoes what remains", async () => {
    const body = { resolutions: [{ label: "Work", id: "work-b" }] };
    const response = await post(JSON.stringify(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ...view });
    expect(saveResolutions).toHaveBeenCalledWith({}, "owner", body);
  });
  it("maps validation, contention, box start and unknown failures", async () => {
    expect((await post("{nope")).status).toBe(400);
    vi.mocked(saveResolutions).mockRejectedValueOnce(new ResolutionInputError("a resolution picks a thread id that was not offered for its label"));
    let response = await post("{}");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("not offered");
    vi.mocked(saveResolutions).mockRejectedValueOnce(new StateBusyError());
    response = await post("{}");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("2");
    vi.mocked(saveResolutions).mockRejectedValueOnce(new StartLimitError());
    expect((await post("{}")).status).toBe(503);
    vi.mocked(saveResolutions).mockRejectedValueOnce(new Error("box said: label Work"));
    response = await post("{}");
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("Work");
    vi.mocked(readResolutionView).mockRejectedValueOnce(new Error("box said: label Work"));
    response = await GET(new NextRequest(url));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("Work");
  });
});
