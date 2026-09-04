/**
 * POST /api/create/push: an Actions OIDC token is the only credential; its
 * claims must land on a `build` link for exactly that repository, branch and
 * committed workflow. The zip is staged as a draft — never published.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionsClaims } from "@/lib/github/oidc";
import { WORKFLOW_PATH, type RepoLink } from "@/lib/create/import";
import { makeZip } from "@/lib/create/zip-test-utils";

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
vi.mock("@/lib/storage/r2", () => ({ r2Configured: () => true }));

const oidc = vi.hoisted(() => ({
  verifyActionsToken: vi.fn(async (): Promise<ActionsClaims> => CLAIMS),
}));
vi.mock("@/lib/github/oidc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github/oidc")>()),
  verifyActionsToken: oidc.verifyActionsToken,
}));

const imports = vi.hoisted(() => ({
  linksForRepo: vi.fn(async (): Promise<RepoLink[]> => []),
  pushBuildOutput: vi.fn(async (..._args: [unknown, RepoLink, Buffer, string]) => ({
    slug: "alice-site",
    version: "v1",
    sha: "a".repeat(40),
    findings: [],
  })),
}));
vi.mock("@/lib/create/import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/import")>()),
  linksForRepo: imports.linksForRepo,
  pushBuildOutput: imports.pushBuildOutput,
}));

const limits = vi.hoisted(() => ({
  pushRateLimited: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/limits")>()),
  ...limits,
}));

import { NextRequest } from "next/server";
import { OidcError } from "@/lib/github/oidc";
import { BundleError } from "@/lib/miniapps/bundles";
import { POST } from "./route";

const CLAIMS: ActionsClaims = {
  repository: "alice/site",
  repository_id: "123",
  repository_owner_id: "77",
  ref: "refs/heads/main",
  sha: "a".repeat(40),
  job_workflow_ref: `alice/site/${WORKFLOW_PATH}@refs/heads/main`,
  run_id: "999",
  actor_id: "77",
};

const buildLink: RepoLink = {
  id: "link-build",
  user_id: "user-alice",
  installation_id: 10,
  app_id: "app-1",
  repo_id: 123,
  full_name: "alice/site",
  branch: "main",
  dir: "",
  mode: "build",
  workflow_path: WORKFLOW_PATH,
  last_sha: null,
  last_synced_at: null,
  last_error: null,
  created_at: "2026-09-01T00:00:00Z",
  import_id: "import-old",
};

const ZIP = makeZip([{ name: "index.html", data: "<!doctype html><html><body>built</body></html>" }]);

function request(options: { token?: string | null; body?: Buffer; contentLength?: string } = {}): NextRequest {
  const headers = new Headers({ "content-type": "application/zip" });
  const token = options.token === undefined ? "oidc-token" : options.token;
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  if (options.contentLength) headers.set("content-length", options.contentLength);
  return new NextRequest("https://air.test/api/create/push", {
    method: "POST",
    headers,
    body: new Uint8Array(options.body ?? ZIP),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  oidc.verifyActionsToken.mockResolvedValue(CLAIMS);
  imports.linksForRepo.mockResolvedValue([buildLink]);
  limits.pushRateLimited.mockResolvedValue(false);
});

describe("POST /api/create/push — auth", () => {
  it("401 without a bearer token, without touching the DB", async () => {
    expect((await POST(request({ token: null }))).status).toBe(401);
    expect((await POST(request({ token: "" }))).status).toBe(401);
    expect(oidc.verifyActionsToken).not.toHaveBeenCalled();
    expect(imports.linksForRepo).not.toHaveBeenCalled();
  });

  it("401 on a token the verifier rejects, with no detail", async () => {
    oidc.verifyActionsToken.mockRejectedValueOnce(new OidcError("wrong audience"));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(imports.linksForRepo).not.toHaveBeenCalled();
  });

  it("surfaces verifier infrastructure failures instead of masking them as 401", async () => {
    oidc.verifyActionsToken.mockRejectedValueOnce(new Error("jwks unreachable"));
    await expect(POST(request())).rejects.toThrow(/jwks unreachable/);
  });
});

describe("POST /api/create/push — link matching", () => {
  it("stages the zip on the matching build link as a draft", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, slug: "alice-site", version: "v1" });
    expect(imports.linksForRepo).toHaveBeenCalledWith(expect.anything(), 123);
    expect(imports.pushBuildOutput).toHaveBeenCalledWith(
      expect.anything(),
      buildLink,
      expect.any(Buffer),
      "a".repeat(40)
    );
    expect(imports.pushBuildOutput.mock.calls[0]![2].equals(ZIP)).toBe(true);
  });

  it.each([
    ["a fork running the same workflow", { repository_id: "999", repository: "mallory/site" }],
    ["another branch", { ref: "refs/heads/dev" }],
    ["a hand-edited workflow path", { job_workflow_ref: "alice/site/.github/workflows/deploy.yml@refs/heads/main" }],
    ["a non-numeric repository id", { repository_id: "abc" }],
  ])("404 for %s", async (_label, over) => {
    oidc.verifyActionsToken.mockResolvedValueOnce({ ...CLAIMS, ...over });
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(imports.pushBuildOutput).not.toHaveBeenCalled();
  });

  it("404 when the only link for the repo is a static one", async () => {
    imports.linksForRepo.mockResolvedValue([{ ...buildLink, mode: "static", workflow_path: null }]);
    expect((await POST(request())).status).toBe(404);
    expect(imports.pushBuildOutput).not.toHaveBeenCalled();
  });
});

describe("POST /api/create/push — budgets and errors", () => {
  it("413 on an oversize declared length before reading the body", async () => {
    const response = await POST(request({ contentLength: String(200 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(limits.pushRateLimited).not.toHaveBeenCalled();
  });

  it("429 when the owner's push budget is spent", async () => {
    limits.pushRateLimited.mockResolvedValueOnce(true);
    expect((await POST(request())).status).toBe(429);
    expect(imports.pushBuildOutput).not.toHaveBeenCalled();
  });

  it("maps a bundle rejection to 400 and records it against the owner", async () => {
    imports.pushBuildOutput.mockRejectedValueOnce(new BundleError("file type not allowed: x.wasm"));
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "file type not allowed: x.wasm" });
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "upload_rejected",
      "user-alice",
      "push:alice/site"
    );
  });

  it("rethrows unexpected failures", async () => {
    imports.pushBuildOutput.mockRejectedValueOnce(new Error("r2 down"));
    await expect(POST(request())).rejects.toThrow(/r2 down/);
  });
});
