/**
 * The secrets step stays optional. Managers (1Password included) live behind
 * the collapsed "Bring your own manager" details, the step is skippable with
 * nothing configured, and no manager is ever enabled without an explicit
 * action=enable_manager post.
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
const enableManager = vi.fn(async () => []);
vi.mock("@/lib/vault/managers", () => ({
  listManagers: vi.fn(async () => [
    {
      manager: "bitwarden",
      enabled: false,
      status: "off",
      provenance_count: null,
      warnings: null,
      last_synced_at: null,
    },
    {
      manager: "onepassword",
      enabled: false,
      status: "off",
      provenance_count: null,
      warnings: null,
      last_synced_at: null,
    },
  ]),
  enableManager: (...args: unknown[]) => enableManager(...(args as [])),
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
  claimCardSend: vi.fn(async () => ({ release: vi.fn(async () => undefined) })),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit", "gte", "lt"]) {
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
    imessage_destinations: thenable([], {
      space_id: "space-1",
      phone: "+15551234567",
    }),
  };
  return {
    request: new NextRequest("https://mini.example/mini/setup?step=secrets"),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  enableManager.mockClear();
  boxFiles.clear();
});

describe("onboarding secrets step", () => {
  it("renders managers off, skippable, with 1Password behind the optional details", async () => {
    const body = await (await onboarding.render(makeCtx())).text();
    expect(body).toContain("1Password: off");
    expect(body).toContain("<summary>Bring your own manager</summary>");
    // Nothing configured: the step offers Skip and no "done" affordance.
    expect(body).toContain('value="skip"');
    expect(body).not.toContain("Done with secrets");
    // The 1Password sign-in explainer is conditional copy, not a prompt to act.
    expect(body).toContain('Allow agent sign-in');
    expect(body).toContain("Credentials never appear in chat");
    // The connect form is opt-in: no preselection, no auto-enable.
    expect(body).not.toContain('option value="onepassword" selected');
  });

  it("skipping the step enables nothing", async () => {
    const form = new FormData();
    form.set("action", "skip");
    form.set("step", "secrets");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(enableManager).not.toHaveBeenCalled();
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toContain(
      '"secrets": "skipped"'
    );
  });

  it("only an explicit enable_manager post connects 1Password", async () => {
    const form = new FormData();
    form.set("action", "enable_manager");
    form.set("manager", "onepassword");
    form.set("token", "ops_service_account_token");
    await onboarding.action!(makeCtx(), form);
    expect(enableManager).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "box-1",
      expect.objectContaining({ manager: "onepassword" })
    );
  });
});
