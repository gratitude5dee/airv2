/**
 * "Connect Link" onboarding step: ordered after stripe, skippable, and the
 * slide/actions drive the box-side link-cli device pairing (payments lane —
 * every spend still needs the owner's approval, human clicks the final Pay).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";
import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";

const boxFiles = new Map<string, string>();
const command = vi.fn();

vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
  command: (...args: unknown[]) => command(...(args as [])),
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
    configured: false,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));
vi.mock("@/lib/miniapps/cards", () => ({
  sendMiniAppCard: vi.fn(async () => undefined),
}));
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: vi.fn(async () => null),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";

const DOC_PATH = ".hermes/miniapps/onboarding/link.json";

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
  builder["maybeSingle"] = async () => ({ data: single, error: null });
  builder["then"] = (
    resolve: (value: { data: unknown; count: number }) => unknown
  ) => Promise.resolve({ data: rows, count: 0 }).then(resolve);
  return builder;
}

function makeCtx() {
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
    imessage_destinations: thenable([], null),
  };
  return {
    request: new NextRequest("https://mini.example/mini/setup?step=link"),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  boxFiles.clear();
  command.mockReset();
});

describe("onboarding link step", () => {
  it("orders link after stripe and before agent", () => {
    const stripe = ONBOARDING_STEPS.indexOf("stripe");
    const link = ONBOARDING_STEPS.indexOf("link");
    const agent = ONBOARDING_STEPS.indexOf("agent");
    expect(link).toBe(stripe + 1);
    expect(agent).toBe(link + 1);
  });

  it("renders the connect button and a skip on the fresh slide", async () => {
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).toContain("Connect Link");
    expect(body).toContain('value="link_connect"');
    expect(body).toContain("final Pay button");
    // Skippable — Link never blocks onboarding.
    expect(body).toContain('value="link"');
  });

  it("renders the pending pairing URL and phrase, link.com only", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        installed: true,
        authenticated: false,
        verification_url: "https://app.link.com/device/setup?code=a-b-c",
        phrase: "a-b-c",
      })
    );
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).toContain("https://app.link.com/device/setup?code=a-b-c");
    expect(body).toContain("a-b-c");
    expect(body).toContain('value="link_check"');
  });

  it("never renders a non-link.com verification URL", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        installed: true,
        authenticated: false,
        verification_url: "https://evil.example/pair",
        phrase: "x",
      })
    );
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).not.toContain("evil.example");
  });

  it("offers skip when the CLI is not on the box yet", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({ installed: false, authenticated: false })
    );
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).toContain("isn't on your agent's computer");
    expect(body).not.toContain('value="link_connect"');
  });

  it("link_connect starts pairing and surfaces the approval prompt", async () => {
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([
        {
          authenticated: false,
          verification_url: "https://app.link.com/device/setup?code=q-r-s",
          phrase: "q-r-s",
        },
      ]),
      stderr: "",
    });
    const form = new FormData();
    form.set("action", "link_connect");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("approve the connection");
    expect(body).toContain("https://app.link.com/device/setup?code=q-r-s");
  });

  it("link_check marks the step done once authenticated", async () => {
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([{ authenticated: true }]),
      stderr: "",
    });
    const form = new FormData();
    form.set("action", "link_check");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Link connected");
    const state = boxFiles.get(".hermes/miniapps/onboarding/state.json");
    expect(state).toContain('"link": "done"');
  });

  it("link_check without approval keeps the step open", async () => {
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([{ authenticated: false }]),
      stderr: "",
    });
    const form = new FormData();
    form.set("action", "link_check");
    const response = await onboarding.action!(makeCtx(), form);
    const body = await response.text();
    expect(body).toContain("Not connected yet");
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toBe(
      undefined
    );
  });

  it("skip works — Link never blocks onboarding", async () => {
    const form = new FormData();
    form.set("action", "skip");
    form.set("step", "link");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const state = boxFiles.get(".hermes/miniapps/onboarding/state.json");
    expect(state).toContain('"link": "skipped"');
  });
});
