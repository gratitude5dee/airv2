/**
 * Composio integrations step: it comes right after Onairos (ingest context,
 * then connect apps the agent can act in), offers the golden-path action
 * toolkits via hosted Connect Links, and never renders a Composio credential
 * — the browser sees toolkit slugs and statuses only.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const boxFiles = new Map<string, string>();

vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("@/lib/vault/managers", () => ({
  listManagers: vi.fn(async () => []),
  enableManager: vi.fn(),
  ManagerInputError: class extends Error {},
}));
vi.mock("@/lib/imessage/ingest", () => ({
  mintIngestTicket: vi.fn(),
  readIngestStatus: vi.fn(async () => null),
}));
vi.mock("@/lib/commerce/merchants", () => ({
  getMerchant: vi.fn(async () => null),
  startOnboarding: vi.fn(),
}));

const beginConnect = vi.fn(async () => ({
  redirect_url: "https://connect.composio.example/link/abc",
}));
const syncConnections = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: (...args: unknown[]) => beginConnect(...(args as [])),
  syncConnections: (...args: unknown[]) => syncConnections(...(args as [])),
}));
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: vi.fn(),
  onairosStatus: vi.fn(async () => ({
    configured: true,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";
import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
});

const db = new FakeSupabase();

function makeCtx(url = "https://mini.example/mini/setup?step=connect") {
  db.tables["users"] = [{ id: "user-1", username: "grat" }];
  db.tables["agent_addresses"] = [
    {
      user_id: "user-1",
      address: "grat@wzrd.tech",
      is_primary: true,
      retired_at: null,
    },
  ];
  db.tables["entitlements"] = [
    { user_id: "user-1", speed_tier: "balanced" },
  ];
  db.tables["boxes"] = [
    {
      user_id: "user-1",
      provider_box_id: "box-1",
      environment: "ubuntu",
      control_url: null,
      control_token: null,
      state: "ready",
    },
  ];
  return {
    request: new NextRequest(url),
    supabase: db.client(),
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  db.reset();
  beginConnect.mockClear();
  boxFiles.clear();
});

describe("onboarding composio integrations step", () => {
  it("comes immediately after the onairos step", () => {
    const onairosAt = ONBOARDING_STEPS.indexOf("onairos");
    expect(onairosAt).toBeGreaterThan(-1);
    expect(ONBOARDING_STEPS[onairosAt + 1]).toBe("connect");
  });

  it("renders the action toolkits with connect forms and no credentials", async () => {
    const response = await onboarding.render(makeCtx());
    expect(response.status).toBe(200);
    const body = await response.text();
    for (const toolkit of [
      "gmail",
      "googlecalendar",
      "notion",
      "slack",
      "github",
    ]) {
      expect(body).toContain(`value="${toolkit}"`);
    }
    expect(body).toContain("take actions in your apps");
    expect(body).not.toContain("x-api-key");
    expect(body).not.toContain("composio_session_id");
  });

  it("connect action redirects to the hosted Connect Link with a step callback", async () => {
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "notion");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://connect.composio.example/link/abc"
    );
    expect(beginConnect).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "notion",
      expect.stringContaining("/mini/setup?step=connect")
    );
  });

  it("card session connect never mints a Connect Link and points to the browser", async () => {
    const ctx = makeCtx();
    (ctx.session as { via?: "card" }).via = "card";
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "gmail");
    const response = await onboarding.action!(ctx, form);
    expect(response.status).toBe(200);
    expect(beginConnect).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).toContain("open this step in your browser");
  });

  it("rejects a malformed toolkit slug", async () => {
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "Bad Slug!");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(403);
    expect(beginConnect).not.toHaveBeenCalled();
  });
});
