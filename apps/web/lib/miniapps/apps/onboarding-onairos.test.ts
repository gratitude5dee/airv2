/**
 * MA9.2 native connect coverage: the onairos slide mounts the same-origin
 * SDK bundle with the key only on the owner's authenticated render, widens
 * the CSP only there, keeps the iMessage relay as the secondary path, and
 * the onairos_handoff action forwards the browser handoff to syncOnairos
 * without ever logging or storing it platform-side.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";

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
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: vi.fn(),
  syncConnections: vi.fn(async () => []),
}));

const syncOnairos = vi.fn(async () => ({ syncedAt: "2026-08-22T00:00:00Z" }));
const onairosStatusMock = vi.fn(async () => ({
  configured: true,
  status: "disconnected" as const,
  connectedAt: null,
}));
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: (...args: unknown[]) => syncOnairos(...(args as [])),
  onairosStatus: (...args: unknown[]) => onairosStatusMock(...(args as [])),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";
import { OnairosError } from "@/lib/onairos/context";

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "gte",
    "lt",
  ]) {
    builder[method] = vi.fn(chain);
  }
  builder.maybeSingle = async () => ({ data: single, error: null });
  builder.then = (
    resolve: (value: { data: unknown; count: number }) => unknown
  ) => Promise.resolve({ data: rows, count: 0 }).then(resolve);
  return builder;
}

function makeCtx(url = "https://mini.example/mini/setup?step=onairos") {
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username: "grat" }),
    agent_addresses: thenable([], { address: "grat@wzrd.tech" }),
    connections: thenable([]),
    vault_items: thenable([]),
    entitlements: thenable([], { speed_tier: "balanced" }),
    plugin_tokens: thenable([]),
    boxes: thenable([], {
      provider_box_id: "box-1",
      environment: "ubuntu",
      control_url: null,
      control_token: null,
      state: "ready",
    }),
  };
  return {
    request: new NextRequest(url),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  vi.unstubAllEnvs();
  syncOnairos.mockClear();
  boxFiles.clear();
});

describe("onboarding onairos slide (native connect)", () => {
  it("mounts the native SDK bundle with the key and keeps iMessage secondary", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "dev-key-123");
    const response = await onboarding.render(makeCtx());
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="onairos-connect"');
    expect(body).toContain('data-api-key="dev-key-123"');
    expect(body).toContain('src="/creator-os/onairos-connect.js"');
    expect(body).toContain('value="connect_onairos"');
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain(
      "script-src 'self' https://accounts.google.com/gsi/client"
    );
    expect(csp).toContain(
      "connect-src 'self' https://api2.onairos.uk https://api.onairos.uk https://accounts.google.com/gsi/"
    );
    expect(csp).toContain("frame-src https://accounts.google.com/gsi/");
  });

  it("passes the Google web client ID to the mount when configured", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "dev-key-123");
    vi.stubEnv(
      "ONAIROS_GOOGLE_CLIENT_ID",
      "123-abc.apps.googleusercontent.com"
    );
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).toContain(
      'data-google-client-id="123-abc.apps.googleusercontent.com"'
    );
  });

  it("omits the Google client attribute when unset", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "dev-key-123");
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).not.toContain("data-google-client-id");
  });

  it("keeps the CSP narrow and hides the native mount when unconfigured", async () => {
    onairosStatusMock.mockResolvedValueOnce({
      configured: false,
      status: "disconnected",
      connectedAt: null,
    });
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).not.toContain("onairos-connect");
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).not.toContain("connect-src");
  });

  it("onairos_handoff forwards the browser handoff to syncOnairos and marks the step done", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "dev-key-123");
    const form = new FormData();
    form.set("action", "onairos_handoff");
    form.set("token", "short-lived-token");
    form.set("api_url", "https://api2.onairos.uk/persona/abc");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(syncOnairos).toHaveBeenCalledWith(expect.anything(), "user-1", {
      token: "short-lived-token",
      apiUrl: "https://api2.onairos.uk/persona/abc",
    });
    const written = boxFiles.get(".hermes/miniapps/onboarding/state.json");
    expect(written).toContain('"onairos": "done"');
  });

  it("surfaces an OnairosError as a slide notice without marking the step", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "dev-key-123");
    syncOnairos.mockRejectedValueOnce(
      new OnairosError("persona still training — try re-sync in a minute", 503)
    );
    const form = new FormData();
    form.set("action", "onairos_handoff");
    form.set("token", "t");
    form.set("api_url", "https://api2.onairos.uk/persona/abc");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Connecting failed");
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toBeUndefined();
  });

  it("rejects the handoff when Onairos isn't configured", async () => {
    vi.stubEnv("ONAIROS_API_KEY", undefined);
    const form = new FormData();
    form.set("action", "onairos_handoff");
    form.set("token", "t");
    form.set("api_url", "https://api2.onairos.uk/persona/abc");
    const response = await onboarding.action!(makeCtx(), form);
    const body = await response.text();
    expect(body).toContain("isn't configured");
    expect(syncOnairos).not.toHaveBeenCalled();
  });
});
