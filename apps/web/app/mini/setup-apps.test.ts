/**
 * MA5 setup-four coverage: the onboarding state document round-trips through
 * the box (C4), the connect grid never leaks a Composio credential and its
 * connect action redirects to the hosted Link, and settings escapes hostile
 * data and writes only through the shared account code paths.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "./loader-test-utils";

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
vi.mock("@/lib/composio/client", () => ({
  listToolkits: vi.fn(async () => [
    { slug: "gmail", name: "Gmail" },
    { slug: "notion", name: "Notion" },
  ]),
}));
vi.mock("@/lib/connectors/meta", () => ({
  connectionHealth: vi.fn(async () => [
    { toolkit: "gmail", status: "active", used_by: "Email triage", last_ok_at: null },
  ]),
}));
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: vi.fn(async () => ({
    redirect_url: "https://connect.composio.example/hosted-link",
  })),
  disconnectToolkit: vi.fn(async () => "ok" as const),
  syncConnections: vi.fn(async () => []),
}));
vi.mock("@/lib/settings/account", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings/account")>();
  return {
    SPEED_TIERS: actual.SPEED_TIERS,
    isSpeedTier: actual.isSpeedTier,
    setUsername: vi.fn(async () => ({
      ok: true as const,
      username: "newname",
      address: "newname@wzrd.tech",
    })),
    setSpeedTier: vi.fn(async () => true),
  };
});

import {
  defaultOnboardingState,
  markOnboardingStep,
  readOnboardingState,
} from "@/lib/miniapps/onboarding";
import { connect } from "@/lib/miniapps/apps/connect";
import { settings } from "@/lib/miniapps/apps/settings";
import { setSpeedTier } from "@/lib/settings/account";
import { beginConnect } from "@/lib/connectors/manage";

const HOSTILE = '<script>alert("pwn")</script>';

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "range",
    "gte",
    "lt",
  ]) {
    builder[method] = vi.fn(chain);
  }
  builder.maybeSingle = async () => ({ data: single, error: null });
  builder.then = (resolve: (value: { data: unknown }) => unknown) =>
    Promise.resolve({ data: rows }).then(resolve);
  return builder;
}

function makeCtx(
  slug: string,
  tables: Record<string, ReturnType<typeof thenable>>
): MiniAppContext {
  return {
    request: new NextRequest(`https://mini.example/mini/${slug}`),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug, kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: `/mini/${slug}`,
  };
}

describe("onboarding state document (C4)", () => {
  it("defaults when the box file is missing or garbage", async () => {
    boxFiles.clear();
    const supabase = {} as SupabaseClient;
    expect(await readOnboardingState(supabase, "user-1")).toEqual(
      defaultOnboardingState()
    );
    boxFiles.set(".hermes/miniapps/onboarding/state.json", "not json{");
    expect(await readOnboardingState(supabase, "user-1")).toEqual(
      defaultOnboardingState()
    );
  });

  it("marks a step and persists it at the C4 path", async () => {
    boxFiles.clear();
    const supabase = {} as SupabaseClient;
    const state = await markOnboardingStep(
      supabase,
      "user-1",
      "onairos",
      "skipped"
    );
    expect(state.steps.onairos).toBe("skipped");
    const written = boxFiles.get(".hermes/miniapps/onboarding/state.json");
    expect(written).toBeDefined();
    const reread = await readOnboardingState(supabase, "user-1");
    expect(reread.steps.onairos).toBe("skipped");
    expect(reread.steps.username).toBe("todo");
  });
});

describe("connect mini-app", () => {
  it("renders the toolkit grid with status chips and no credential material", async () => {
    const ctx = makeCtx("connect", {
      connections: thenable([
        { toolkit: "gmail", status: "active", connected_at: null },
      ]),
    });
    const response = await connect.render(ctx);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Gmail");
    expect(body).toContain("connected");
    expect(body).toContain("Used by Email triage");
    expect(body).toContain("Notion");
    expect(body).not.toContain("mcp");
    expect(body).not.toContain("composio_api_key");
  });

  it("connect action 303-redirects to the hosted Connect Link", async () => {
    const ctx = makeCtx("connect", { connections: thenable([]) });
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "notion");
    const response = await connect.action!(ctx, form);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://connect.composio.example/hosted-link"
    );
    expect(vi.mocked(beginConnect)).toHaveBeenCalledWith(
      ctx.supabase,
      "user-1",
      "notion",
      "https://mini.example/mini/connect"
    );
  });

  it("rejects a malformed toolkit slug", async () => {
    const ctx = makeCtx("connect", { connections: thenable([]) });
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "Not A Slug!");
    const response = await connect.action!(ctx, form);
    expect(response.status).toBe(403);
  });
});

describe("settings mini-app", () => {
  function settingsCtx() {
    return makeCtx("settings", {
      users: thenable([], { username: HOSTILE }),
      entitlements: thenable([], { plan: "beta", speed_tier: "balanced" }),
      agent_addresses: thenable([], { address: "user@wzrd.tech" }),
      plugin_tokens: thenable([
        { tool: HOSTILE, created_at: "2026-08-01T00:00:00Z", last_used_at: null },
      ]),
      user_buckets: thenable([], null),
    });
  }

  it("escapes hostile values, mounts the section trio, and marks not-yet-shipped panels", async () => {
    const response = await settings.render(settingsCtx());
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("&lt;script&gt;");
    expect(body).not.toContain("<script>alert");
    expect(body).toContain("Coming soon");
    expect(body).toContain("MA2.4");
    expect(body).toContain("user@wzrd.tech");
    // MA9.1/MA9.2/MA9.3 sections are mounted, not placeholders.
    expect(body).toContain("MEMORY.md");
    expect(body).toContain("<h2>Traces</h2>");
    expect(body).toContain("Connected context");
  });

  it("speed tier writes go through the shared account helper", async () => {
    const form = new FormData();
    form.set("action", "set_speed");
    form.set("speed_tier", "deep");
    const response = await settings.action!(settingsCtx(), form);
    expect(response.status).toBe(200);
    expect(vi.mocked(setSpeedTier)).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "deep"
    );
  });

  it("rejects an unknown speed tier", async () => {
    const form = new FormData();
    form.set("action", "set_speed");
    form.set("speed_tier", "warp");
    const response = await settings.action!(settingsCtx(), form);
    expect(response.status).toBe(403);
  });
});
