/**
 * Walkthrough finish delivers the Home launcher: mark_done on the
 * walkthrough step sends the owner the home card as their next message
 * (best-effort — no destination or a send failure never blocks finishing),
 * and the slide copy guides a clickthrough of Home's features.
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
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: vi.fn(),
  onairosStatus: vi.fn(async () => ({
    configured: false,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));

const sendMiniAppCard = vi.fn(async () => undefined);
vi.mock("@/lib/miniapps/cards", () => ({
  sendMiniAppCard: (...args: unknown[]) => sendMiniAppCard(...(args as [])),
}));
const release = vi.fn(async () => undefined);
const claimCardSend = vi.fn(async () => ({ release }));
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: (...args: unknown[]) => claimCardSend(...(args as [])),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";

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

function makeCtx(options: { destination?: boolean } = {}) {
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username: "grat" }),
    agent_addresses: thenable([], { address: "grat@wzrd.tech" }),
    connections: thenable([]),
    vault_items: thenable([]),
    entitlements: thenable([], { speed_tier: "balanced" }),
    plugin_tokens: thenable([]),
    imessage_destinations: thenable(
      [],
      options.destination === false
        ? null
        : { space_id: "space-1", phone: "+15551234567" }
    ),
  };
  return {
    request: new NextRequest("https://mini.example/mini/setup?step=walkthrough"),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  sendMiniAppCard.mockClear();
  claimCardSend.mockClear();
  release.mockClear();
  boxFiles.clear();
});

describe("onboarding walkthrough finish", () => {
  it("guides a Home clickthrough on the walkthrough slide", async () => {
    const response = await onboarding.render(makeCtx());
    const body = await response.text();
    expect(body).toContain("Home is your launcher");
    expect(body).toContain("Home grid");
    expect(body).toContain("arrives as your next message");
  });

  it("mark_done on walkthrough sends the home card to the owner's thread", async () => {
    const form = new FormData();
    form.set("action", "mark_done");
    form.set("step", "walkthrough");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(claimCardSend).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "home"
    );
    expect(sendMiniAppCard).toHaveBeenCalledWith(
      expect.anything(),
      "space-1",
      "+15551234567",
      "user-1",
      "home",
      "default"
    );
    const body = await response.text();
    expect(body).toContain("Home app is on its way");
  });

  it("skips the send without a known iMessage destination", async () => {
    const form = new FormData();
    form.set("action", "mark_done");
    form.set("step", "walkthrough");
    const response = await onboarding.action!(
      makeCtx({ destination: false }),
      form
    );
    expect(response.status).toBe(200);
    expect(sendMiniAppCard).not.toHaveBeenCalled();
  });

  it("a send failure releases the claim and never blocks finishing", async () => {
    sendMiniAppCard.mockRejectedValueOnce(new Error("spectrum down"));
    const form = new FormData();
    form.set("action", "mark_done");
    form.set("step", "walkthrough");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(release).toHaveBeenCalled();
    const written = boxFiles.get(".hermes/miniapps/onboarding/state.json");
    expect(written).toContain('"walkthrough": "done"');
  });

  it("skip on walkthrough does not send the card", async () => {
    const form = new FormData();
    form.set("action", "skip");
    form.set("step", "walkthrough");
    await onboarding.action!(makeCtx(), form);
    expect(sendMiniAppCard).not.toHaveBeenCalled();
    expect(claimCardSend).not.toHaveBeenCalled();
  });
});
