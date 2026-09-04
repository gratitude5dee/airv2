/**
 * GET /api/create/github/setup: the install round trip lands here. The
 * signed state must name the signed-in owner, the installation is re-read
 * from GitHub (never trusted from the query string), and an installation
 * already bound to another account is refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signSetupState } from "@/lib/github/app";
import { ImportError } from "@/lib/create/import";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => "user-alice"),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));

const github = vi.hoisted(() => ({
  getInstallation: vi.fn(async () => ({
    id: 10,
    account: { login: "alice", type: "User" as const },
    suspended_at: null,
  })),
}));
vi.mock("@/lib/github/app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github/app")>()),
  getInstallation: github.getInstallation,
}));

const imports = vi.hoisted(() => ({
  recordInstallation: vi.fn(async () => ({})),
}));
vi.mock("@/lib/create/import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/import")>()),
  recordInstallation: imports.recordInstallation,
}));

import { NextRequest } from "next/server";
import { GitHubError } from "@/lib/github/app";
import { GET } from "./route";

process.env["SESSION_SECRET"] = "test-session-secret";
process.env["MINIAPP_ORIGIN"] = "https://mini.test";

function request(params: Record<string, string>): NextRequest {
  const url = new URL("https://mini.test/api/create/github/setup");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function outcome(response: Response): string | null {
  const location = response.headers.get("location");
  expect(response.status).toBe(303);
  expect(location).toMatch(/^https:\/\/mini\.test\/create\?/);
  return new URL(location!).searchParams.get("github");
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
});

describe("GET /api/create/github/setup", () => {
  it("401 without a store session", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    const response = await GET(request({ state: signSetupState("user-alice"), installation_id: "10" }));
    expect(response.status).toBe(401);
    expect(github.getInstallation).not.toHaveBeenCalled();
  });

  it("records the installation for the signed-in owner and returns to /create", async () => {
    const response = await GET(
      request({ state: signSetupState("user-alice"), installation_id: "10", setup_action: "install" })
    );
    expect(outcome(response)).toBe("connected");
    expect(github.getInstallation).toHaveBeenCalledWith(10);
    expect(imports.recordInstallation).toHaveBeenCalledWith(
      expect.anything(),
      "user-alice",
      expect.objectContaining({ id: 10, account: { login: "alice", type: "User" } })
    );
  });

  it.each([
    ["missing", {}],
    ["forged", { state: "eyJ1IjoidXNlci1hbGljZSJ9.bm9wZQ" }],
    ["another user's", { state: signSetupState("user-mallory") }],
    ["expired", { state: signSetupState("user-alice", Date.now() - 16 * 60_000) }],
  ])("bounces a %s state without contacting GitHub", async (_label, params) => {
    const response = await GET(request({ installation_id: "10", ...params }));
    expect(outcome(response)).toBe("state");
    expect(github.getInstallation).not.toHaveBeenCalled();
    expect(imports.recordInstallation).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "abc", "1.5", "99999999999999999999"])(
    "bounces installation_id %j",
    async (id) => {
      const response = await GET(request({ state: signSetupState("user-alice"), installation_id: id }));
      expect(outcome(response)).toBe("invalid");
      expect(github.getInstallation).not.toHaveBeenCalled();
    }
  );

  it("bounces an installation already bound to another account", async () => {
    imports.recordInstallation.mockRejectedValueOnce(
      new ImportError("that GitHub installation belongs to another account", 409)
    );
    const response = await GET(request({ state: signSetupState("user-alice"), installation_id: "10" }));
    expect(outcome(response)).toBe("taken");
  });

  it("bounces when GitHub does not know the installation", async () => {
    github.getInstallation.mockRejectedValueOnce(new GitHubError(404, "not found"));
    const response = await GET(request({ state: signSetupState("user-alice"), installation_id: "10" }));
    expect(outcome(response)).toBe("github");
    expect(imports.recordInstallation).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures", async () => {
    imports.recordInstallation.mockRejectedValueOnce(new Error("db down"));
    await expect(
      GET(request({ state: signSetupState("user-alice"), installation_id: "10" }))
    ).rejects.toThrow(/db down/);
  });
});
