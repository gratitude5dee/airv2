/**
 * Environment step: the FIRST onboarding step lets the user pick which
 * computer their agent lives on (ubuntu / omarchy / macos). Choosing a
 * different environment rebuilds the compute via switchEnvironment; the
 * browser only ever sees the three labels, never a provider credential.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: vi.fn(),
  onairosStatus: vi.fn(async () => ({
    configured: true,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));

const switchEnvironment = vi.fn(async () => ({
  userId: "user-1",
  boxId: "box-2",
  hostedUrl: "https://h.example",
  dashboardUrl: "https://d.example",
  environment: "omarchy" as const,
}));
vi.mock("@/lib/provisioning/provision", () => ({
  switchEnvironment: (...args: unknown[]) =>
    switchEnvironment(...(args as [])),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";
import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";

beforeAll(() => {
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
});

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit", "gte", "lt"]) {
    builder[method] = vi.fn(chain);
  }
  builder.maybeSingle = async () => ({ data: single, error: null });
  builder.then = (
    resolve: (value: { data: unknown; count: number }) => unknown
  ) => Promise.resolve({ data: rows, count: 0 }).then(resolve);
  return builder;
}

function makeCtx(url = "https://mini.example/mini/setup?step=environment") {
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
  switchEnvironment.mockClear();
  boxFiles.clear();
});

describe("onboarding environment step", () => {
  it("is the first step, before username", () => {
    expect(ONBOARDING_STEPS[0]).toBe("environment");
    expect(ONBOARDING_STEPS.indexOf("environment")).toBeLessThan(
      ONBOARDING_STEPS.indexOf("username")
    );
  });

  it("renders the three environment choices with no provider names leaking", async () => {
    const response = await onboarding.render(makeCtx());
    expect(response.status).toBe(200);
    const body = await response.text();
    // Only the live default is submittable; the other two render as
    // coming-soon cards with no form.
    expect(body).toContain('value="ubuntu"');
    expect(body).not.toContain('value="omarchy"');
    expect(body).not.toContain('value="macos"');
    expect(body).toContain("Coming soon");
    expect(body).toContain("Ubuntu");
    expect(body).toContain("Omarchy");
    expect(body).toContain("macOS");
    expect(body).not.toContain("ascii.dev");
    expect(body).not.toContain("Namespace");
  });

  it("a coming-soon environment never rebuilds the compute", async () => {
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "omarchy");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("coming soon");
    expect(switchEnvironment).not.toHaveBeenCalled();
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps?.environment ?? "todo").toBe("todo");
  });

  it("keeping the current environment never rebuilds the compute", async () => {
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "ubuntu");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(switchEnvironment).not.toHaveBeenCalled();
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps.environment).toBe("done");
  });

  it("rejects an unknown environment value", async () => {
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "windows");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(403);
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("a failed switch keeps the step open with a retry notice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    switchEnvironment.mockRejectedValueOnce(new Error("box gone"));
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "ubuntu");
    const ctx = makeCtx();
    // Current environment differs so ubuntu is a real switch.
    (
      ctx.supabase as unknown as { from: (t: string) => unknown }
    ).from = (table: string) =>
      table === "boxes"
        ? thenable([], {
            provider_box_id: "box-1",
            environment: "omarchy",
            control_url: null,
            control_token: null,
            state: "ready",
          })
        : thenable([], null);
    const response = await onboarding.action!(ctx, form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("isn't available right now");
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps?.environment ?? "todo").toBe("todo");
  });

  it("old box-side state files without the environment key still load", async () => {
    boxFiles.set(
      ".hermes/miniapps/onboarding/state.json",
      JSON.stringify({
        steps: { username: "done" },
        updated_at: "2026-01-01T00:00:00Z",
      })
    );
    const response = await onboarding.render(
      makeCtx("https://mini.example/mini/setup")
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    // The pre-migration state normalizes: environment defaults to todo, so
    // the first open step is the environment slide.
    expect(body).toContain("value=\"set_environment\"");
  });
});
