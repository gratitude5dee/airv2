import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import { withTheme } from "../themeContext";
import { theme } from "../themes";
import { makeApp } from "@/app/mini/loader-test-utils";

vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: { ...actual.env, r2PublicBaseUrl: () => "https://media.example" },
  };
});
vi.mock("@/lib/calendar/store", () => ({
  readEventsStore: vi.fn(async () => []),
  approveInboxEvent: vi.fn(),
  dismissInboxEvent: vi.fn(),
  removeLocalEvent: vi.fn(),
  upsertLocalEvent: vi.fn(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "test" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("@/lib/crm/store", async (original) => ({
  ...(await original()),
  readPeople: vi.fn(async () => ({ version: 1, people: [] })),
}));
vi.mock("@/lib/agentmail/calendar", () => ({
  createCalendarEvent: vi.fn(),
  rsvpCalendarEvent: vi.fn(),
  getCalendarFreeBusy: vi.fn(async () => []),
  createBookingLink: vi.fn(),
}));
vi.mock("@/lib/miniapps/promptBar", () => ({
  promptBar: vi.fn(() => ""),
  runPrompt: vi.fn(),
}));

import { calendar } from "./calendar";

function context(role: "owner" | "guest" = "owner", via?: "card"): MiniAppContext {
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of [
      "select",
      "eq",
      "neq",
      "is",
      "not",
      "order",
      "limit",
      "update",
    ]) {
      builder[method] = chain;
    }
    builder["maybeSingle"] = async () => ({
      data: table === "agent_addresses" ? { agentmail_inbox_id: "inbox-1" } : null,
      error: null,
    });
    builder["then"] = (
      resolve: (value: { data: unknown[]; error: null }) => unknown
    ) => Promise.resolve({ data: [], error: null }).then(resolve);
    return builder;
  };
  return {
    request: new NextRequest(
      "https://app.wzrd.tech/mini/calendar?view=month&month=2026-03"
    ),
    supabase: { from } as unknown as SupabaseClient,
    app: makeApp({ slug: "calendar", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role, ...(via ? { via } : {}) },
    basePath: "/mini/calendar",
  } as MiniAppContext;
}

async function rendered(
  themeId: "atmosphere" | "pixel",
  role: "owner" | "guest" = "owner",
  via?: "card"
) {
  return withTheme(theme(themeId), async () =>
    calendar.render(context(role, via))
  );
}

describe("calendar CSP", () => {
  it.each(["atmosphere", "pixel"] as const)(
    "widens %s month image CSP exactly once",
    async (themeId) => {
      const response = await rendered(themeId);
      const csp = response.headers.get("Content-Security-Policy") ?? "";
      const imgSrc = csp.match(/img-src ([^;]+)/)?.[1] ?? "";
      expect((imgSrc.match(/https:\/\/media\.example/g) ?? []).length).toBe(1);
      expect(csp).not.toContain("connect-src");
      if (themeId === "atmosphere") expect(imgSrc).toContain("data:");
    }
  );

  it("emits the Month motion script only for full sessions", async () => {
    const atmosphere = await (await rendered("atmosphere")).text();
    const lite = await (await rendered("atmosphere", "owner", "card")).text();
    const agenda = await withTheme(theme("atmosphere"), async () =>
      calendar.render({
        ...context(),
        request: new NextRequest("https://app.wzrd.tech/mini/calendar"),
      })
    );
    expect(atmosphere).toContain('<script src="/creator-os/calendar-month.js"');
    expect(lite).not.toContain("calendar-month.js");
    expect(await agenda.text()).not.toContain("calendar-month.js");
  });

  it("adds script-src for Pixel Month but not guest Pixel lite Agenda", async () => {
    const month = await rendered("pixel");
    const agenda = await withTheme(theme("pixel"), async () =>
      calendar.render({
        ...context("guest", "card"),
        request: new NextRequest("https://app.wzrd.tech/mini/calendar"),
      })
    );
    expect(month.headers.get("Content-Security-Policy")).toContain(
      "script-src 'self'"
    );
    expect(agenda.headers.get("Content-Security-Policy")).not.toContain(
      "script-src"
    );
  });
});
