/**
 * P1-10: the agent media_publish path must hit the same durable per-user
 * upload rate limit and ops ledger as the apps-api presign path — otherwise
 * a box bypasses both by publishing directly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { user_id: "user-1" } }),
          }),
        }),
      }),
    }) as unknown as SupabaseClient,
}));
vi.mock("@/lib/security/limits", () => ({
  uploadRateLimited: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/storage/r2", () => ({
  r2Configured: () => true,
  putObject: vi.fn(async () => undefined),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));
vi.mock("@/lib/storage/buckets", () => ({
  ensureUserBucket: vi.fn(async () => ({ prefix: "user-1/" })),
  assertWithinQuota: vi.fn(),
  addUsage: vi.fn(async () => undefined),
}));
vi.mock("@/lib/storage/guard", () => ({
  ALLOWED_MEDIA_TYPES: { "image/png": "png" },
  MEDIA_MAX_BYTES: 10_000_000,
  MediaGuardError: class MediaGuardError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  guardMediaUpload: (bytes: Buffer) => bytes,
}));
vi.mock("@/lib/box/client", () => ({
  command: vi.fn(async () => ({
    exitCode: 0,
    stdout: Buffer.from("fake png bytes").toString("base64"),
    stderr: "",
  })),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { recordOpsEvent, uploadRateLimited } from "@/lib/security/limits";
import { command } from "@/lib/box/client";

function publishRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://air.test/api/media/publish", {
    method: "POST",
    headers: { authorization: "Bearer token-1" },
    body: JSON.stringify(body),
  });
}

describe("media_publish rate limit + ops ledger (P1-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 before touching the box when rate limited", async () => {
    vi.mocked(uploadRateLimited).mockResolvedValueOnce(true);
    const response = await POST(
      publishRequest({ path: "/home/user/out.png" })
    );
    expect(response.status).toBe(429);
    expect(vi.mocked(command)).not.toHaveBeenCalled();
    expect(vi.mocked(recordOpsEvent)).not.toHaveBeenCalled();
  });

  it("records an upload ops event on success", async () => {
    const response = await POST(
      publishRequest({ path: "/home/user/out.png" })
    );
    expect(response.status).toBe(200);
    expect(vi.mocked(uploadRateLimited)).toHaveBeenCalledWith(
      expect.anything(),
      "user-1"
    );
    expect(vi.mocked(recordOpsEvent)).toHaveBeenCalledWith(
      expect.anything(),
      "upload",
      "user-1",
      "media-publish:out.png",
      Buffer.from("fake png bytes").length
    );
  });

  it("records upload_rejected on a disallowed content type", async () => {
    const response = await POST(
      publishRequest({ path: "/home/user/out.exe" })
    );
    expect(response.status).toBe(400);
    expect(vi.mocked(recordOpsEvent)).toHaveBeenCalledWith(
      expect.anything(),
      "upload_rejected",
      "user-1",
      "content type not allowed"
    );
  });
});
