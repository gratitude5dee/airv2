import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";
import { QA_VIEWPORTS, type QaPass } from "@/lib/create/qa";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const box = vi.hoisted(() => ({
  boxUserId: vi.fn(async (): Promise<string | undefined> => undefined),
}));
vi.mock("@/lib/auth/box", () => box);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const publish = vi.hoisted(() => ({ ownedApp: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
  publisherUsername: async () => "alice",
}));
const limits = vi.hoisted(() => ({
  qaRateLimited: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);
const qa = vi.hoisted(() => ({ recordQaScore: vi.fn() }));
vi.mock("@/lib/create/qa", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/qa")>()),
  recordQaScore: qa.recordQaScore,
}));

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { QaError, scoreReport } from "@/lib/create/qa";
import { POST } from "./route";

const app = makeApp({ slug: "alice-countdown", appname: "countdown", owner_user_id: "user-alice" });

function pass(over: Partial<QaPass> = {}): QaPass {
  return {
    viewport: { width: 390, height: 844 },
    reduced_motion: false,
    console_errors: 0,
    page_errors: 0,
    csp_reports: 0,
    off_origin_requests: 0,
    min_contrast: 8,
    contrast_violations: 0,
    small_targets: 0,
    horizontal_overflow: false,
    lcp_ms: 700,
    screenshot: null,
    ...over,
  };
}

const fullReport = {
  version: "v1700000000001",
  passes: QA_VIEWPORTS.flatMap((viewport) =>
    [false, true].map((reduced_motion) => pass({ viewport: { ...viewport }, reduced_motion }))
  ),
};

function post(body: unknown): NextRequest {
  return new NextRequest("https://mini.test/api/create/qa", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue("user-alice");
  limits.qaRateLimited.mockResolvedValue(false);
  publish.ownedApp.mockImplementation(async (_s: unknown, userId: string, slug: string) => {
    if (userId === "user-alice" && slug === app.slug) return app;
    throw new PublishError("not found", 404);
  });
  qa.recordQaScore.mockImplementation(async (_s: unknown, _appId: string, report: typeof fullReport) => ({
    row: { id: "ver-1", version: report.version, qa_score: scoreReport(report).score },
    summary: scoreReport(report),
  }));
});

describe("POST /api/create/qa", () => {
  it("401 without the Box's gateway bearer or a store session", async () => {
    box.boxUserId.mockResolvedValue(undefined);
    expect((await POST(post({ appname: "countdown", report: fullReport }))).status).toBe(401);
    expect(qa.recordQaScore).not.toHaveBeenCalled();
  });

  it("400 on a report that is not content-free or is malformed", async () => {
    expect((await POST(post({ appname: "countdown" }))).status).toBe(400);
    expect(
      (await POST(post({ appname: "countdown", report: { ...fullReport, transcript: "hello" } }))).status
    ).toBe(400);
    expect(
      (await POST(post({ appname: "countdown", report: { ...fullReport, version: "latest" } }))).status
    ).toBe(400);
    expect(qa.recordQaScore).not.toHaveBeenCalled();
  });

  it("stamps qa_score on the owner's version and logs create.qa", async () => {
    const response = await POST(post({ appname: "countdown", report: fullReport }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      slug: "alice-countdown",
      version: "v1700000000001",
      qa_score: 100,
      failed: [],
    });
    expect(qa.recordQaScore).toHaveBeenCalledWith(expect.anything(), app.id, fullReport);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.qa",
      "user-alice",
      "alice-countdown"
    );
  });

  it("reports the failed rules when the draft leaks off-origin", async () => {
    const passes = fullReport.passes.map((p, i) => (i === 0 ? pass({ ...p, off_origin_requests: 2 }) : p));
    const response = await POST(post({ slug: "alice-countdown", report: { ...fullReport, passes } }));
    const body = (await response.json()) as { qa_score: number; failed: string[] };
    expect(body.qa_score).toBe(0);
    expect(body.failed).toContain("off-origin-requests");
  });

  it("accepts the owner's store session as well", async () => {
    box.boxUserId.mockResolvedValue(undefined);
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await POST(post({ slug: "alice-countdown", report: fullReport }))).status).toBe(200);
  });

  it("404 for another owner's app and for an unknown version", async () => {
    expect((await POST(post({ slug: "bob-promo", report: fullReport }))).status).toBe(404);
    qa.recordQaScore.mockRejectedValueOnce(new QaError("unknown version", 404));
    expect((await POST(post({ slug: "alice-countdown", report: fullReport }))).status).toBe(404);
    expect(limits.recordOpsEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      "create.qa",
      expect.anything(),
      expect.anything()
    );
  });

  it("429 when the owner is over the QA rate limit", async () => {
    limits.qaRateLimited.mockResolvedValue(true);
    expect((await POST(post({ slug: "alice-countdown", report: fullReport }))).status).toBe(429);
    expect(qa.recordQaScore).not.toHaveBeenCalled();
  });
});
