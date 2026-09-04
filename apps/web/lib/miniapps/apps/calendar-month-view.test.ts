import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import { makeApp } from "@/app/mini/loader-test-utils";

const events = Array.from({ length: 40 }, (_, index) => ({
  id: index === 0 ? "local:0123456789abcdef" : `google-${index}`,
  source: index % 3 === 0 ? "local" : index % 3 === 1 ? "google" : "calcom",
  source_ref: `ref-${index}`,
  title: `Event ${index + 1}`,
  starts_at: `2026-09-${String((index % 20) + 1).padStart(2, "0")}T${String(9 + (index % 8)).padStart(2, "0")}:00:00`,
  ends_at: `2026-09-${String((index % 20) + 1).padStart(2, "0")}T${String(10 + (index % 8)).padStart(2, "0")}:00:00`,
  all_day: index === 1,
  location:
    index === 2
      ? "Office"
      : index === 3
        ? "12345678901234"
        : index === 4
          ? "A location that is forty characters long exactly"
          : undefined,
  attendees: [`person${index % 5}@example.test`],
  status: index === 5 ? "pending" : "confirmed",
}));

vi.mock("@/lib/calendar/store", () => ({
  readEventsStore: vi.fn(async () => events),
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
  promptBar: vi.fn(() => '<form data-prompt-bar=""></form>'),
  runPrompt: vi.fn(),
}));

import { calendar } from "./calendar";

function supabase(): SupabaseClient {
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of ["select", "eq", "neq", "is", "not", "order", "limit", "update"]) {
      builder[method] = chain;
    }
    builder["maybeSingle"] = async () => ({
      data: table === "agent_addresses" ? { agentmail_inbox_id: "inbox-1" } : null,
      error: null,
    });
    builder["then"] = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({
        data:
          table === "calendar_accounts"
            ? [
                { id: "s1", provider: "google", persona: "work", color: "#2b7fff", status: "active" },
                { id: "s2", provider: "calcom", persona: "personal", color: "#7c5cff", status: "active" },
              ]
            : [],
        error: null,
      }).then(resolve);
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

function context(
  query = "?view=month&month=2026-09",
  role: "owner" | "guest" = "owner",
  via?: "card"
): MiniAppContext {
  return {
    request: new NextRequest(`https://app.wzrd.tech/mini/calendar${query}`),
    supabase: supabase(),
    app: makeApp({ slug: "calendar", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role, ...(via ? { via } : {}) },
    basePath: "/mini/calendar",
  } as MiniAppContext;
}

describe("calendar month mosaic", () => {
  it("renders Sunday-first weeks, event tiles, templates, and the dock", async () => {
    const html = await (await calendar.render(context())).text();
    expect(html).toContain('<ol class="mo-grid"');
    expect(html).toContain('class="mo-week"');
    expect(html).toContain('class="mo-cell mo-tile');
    expect(html).toContain('data-count="');
    expect(html).toContain('class="mo-cell mo-dot');
    expect((html.match(/class="mo-day"/g) ?? []).length).toBeGreaterThan(0);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('class="mo-dock"');
    const agenda = await (await calendar.render(context("?"))).text();
    expect(agenda).toContain("Next 30 days →");
  });

  it("opens a day strip in the row after the first row and shows the close tile", async () => {
    const html = await (await calendar.render(context("?view=month&month=2026-09&day=2026-09-08"))).text();
    expect(html).toContain('class="mo-strip"');
    expect(html).toContain('data-for="2026-09-08"');
    expect(html).toContain('class="mo-cell mo-tile is-open');
    expect(html).toContain('class="mo-x"');
    expect(html).toContain('class="panel mosaic is-dim"');
  });

  it("honors new=1 for owners but not guests", async () => {
    const owner = await (await calendar.render(context("?view=month&month=2026-09&new=1"))).text();
    const guest = await (await calendar.render(context("?view=month&month=2026-09&new=1", "guest"))).text();
    expect(owner).toContain('<details id="new" open');
    expect(guest).not.toContain('id="new"');
    expect(guest).not.toContain('>+</a>');
    expect(guest).not.toContain('id="prompt"');
  });

  it("filters without removing tiles and marks nonmatching days muted", async () => {
    const html = await (await calendar.render(context("?view=month&month=2026-09&persona=work"))).text();
    expect(html).toContain('class="panel mosaic is-filtered"');
    expect(html).toContain("is-muted");
    expect(html).toContain('aria-hidden="true" tabindex="-1"');
  });

  it("renders the lite DOM without a client script", async () => {
    const html = await (await calendar.render(context("?view=month&month=2026-09", "owner", "card"))).text();
    expect(html).toContain('class="mo-grid"');
    expect(html).not.toContain("calendar-month.js");
  });
});
