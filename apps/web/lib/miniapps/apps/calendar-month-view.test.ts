import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import { makeApp } from "@/app/mini/loader-test-utils";

const fixture = vi.hoisted(() => ({
  events: [] as Array<Record<string, unknown>>,
  people: [] as Array<Record<string, unknown>>,
  prefix: undefined as string | undefined,
  sources: [
    { id: "s1", provider: "google", persona: "work", color: "#2b7fff", status: "active" },
    { id: "s2", provider: "calcom", persona: "personal", color: "#7c5cff", status: "active" },
  ],
}));

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
  readEventsStore: vi.fn(async () => fixture.events),
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
  readPeople: vi.fn(async () => ({ version: 1, people: fixture.people })),
}));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: { ...actual.env, r2PublicBaseUrl: () => "https://media.example" },
  };
});
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
      data:
        table === "agent_addresses"
          ? { agentmail_inbox_id: "inbox-1" }
          : table === "user_buckets" && fixture.prefix
            ? { prefix: fixture.prefix }
            : null,
      error: null,
    });
    builder["then"] = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({
        data:
          table === "calendar_accounts"
            ? fixture.sources
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

beforeEach(() => {
  fixture.events = events;
  fixture.people = [];
  fixture.prefix = undefined;
  fixture.sources = [
    { id: "s1", provider: "google", persona: "work", color: "#2b7fff", status: "active" },
    { id: "s2", provider: "calcom", persona: "personal", color: "#7c5cff", status: "active" },
  ];
});

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
    expect(html).toContain('class="mo-cover mo-plate"');
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
    expect(html).toMatch(
      /<a class="mo-cell mo-tile[^>]*data-day="2026-09-01"[^>]*aria-label="[^"]+ — no work events"/
    );
    const mutedTile = html.slice(
      html.indexOf('data-day="2026-09-01"'),
      html.indexOf('data-day="2026-09-02"')
    );
    expect(mutedTile).toContain('class="mo-cover mo-plate"');
    expect(mutedTile).not.toContain(">0<");
    expect(html).not.toContain('<template class="mo-day" data-day="2026-09-01"');
  });

  it("renders the lite DOM without a client script", async () => {
    const html = await (await calendar.render(context("?view=month&month=2026-09", "owner", "card"))).text();
    expect(html).toContain('class="mo-grid"');
    expect(html).not.toContain("calendar-month.js");
  });

  it("shows the dock Personas item only when it has a target", async () => {
    fixture.sources = [
      { id: "s1", provider: "google", persona: "work", color: "#2b7fff", status: "active" },
    ];
    const single = await (
      await calendar.render(context("?view=month&month=2026-09"))
    ).text();
    const singleDock = single.slice(single.indexOf('<nav class="mo-dock"'));
    expect(singleDock).not.toContain('aria-label="Personas"');

    fixture.sources.push({
      id: "s2",
      provider: "calcom",
      persona: "personal",
      color: "#7c5cff",
      status: "active",
    });
    const multiple = await (
      await calendar.render(context("?view=month&month=2026-09"))
    ).text();
    const multipleDock = multiple.slice(multiple.indexOf('<nav class="mo-dock"'));
    expect(multipleDock).toContain('aria-label="Personas"');

    fixture.sources = [fixture.sources[0]!];
    const filtered = await (
      await calendar.render(context("?view=month&month=2026-09&persona=work"))
    ).text();
    const filteredDock = filtered.slice(filtered.indexOf('<nav class="mo-dock"'));
    expect(filteredDock).toContain('aria-label="Personas"');
  });

  it("anchors the month from month= and lets day= override it", async () => {
    const march = await (
      await calendar.render(context("?view=month&month=2026-03"))
    ).text();
    expect(march).toContain("March 2026");
    expect(march).toContain('aria-label="March 2026"');
    expect(march).not.toContain('class="mo-strip"');

    const selected = await (
      await calendar.render(
        context("?view=month&month=2026-03&day=2026-09-08")
      )
    ).text();
    expect(selected).toContain('data-month="2026-09"');
    expect(selected).toContain('data-for="2026-09-08"');
  });

  it("rejects impossible day and month query values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    try {
      for (const query of [
        "?view=month&day=2026-02-30",
        "?view=month&day=2026-09-00",
        "?view=month&month=2026-13",
        "?view=month&month=2026-00",
      ]) {
        const html = await (await calendar.render(context(query))).text();
        expect(html).toContain('data-month="2026-09"');
        expect(html).not.toContain('class="mo-strip"');
        expect(html).not.toContain("Invalid Date");
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("places row-zero strips below row one and later strips before their row", async () => {
    const firstRow = await (
      await calendar.render(
        context("?view=month&month=2026-09&day=2026-09-02")
      )
    ).text();
    const firstWeek = firstRow.indexOf('class="mo-week"');
    expect(firstRow.indexOf('class="mo-strip"')).toBeGreaterThan(firstWeek);

    const laterRow = await (
      await calendar.render(
        context("?view=month&month=2026-09&day=2026-09-16")
      )
    ).text();
    const weeks = [...laterRow.matchAll(/class="mo-week"/g)].map(
      (match) => match.index ?? -1
    );
    const strip = laterRow.indexOf('class="mo-strip"');
    expect(strip).toBeGreaterThan(weeks[1] ?? -1);
    expect(strip).toBeLessThan(weeks[2] ?? Number.MAX_SAFE_INTEGER);
  });

  it("renders sticker priority and truncates long locations with a title", async () => {
    fixture.events = [
      {
        ...events[0],
        id: "pending-location",
        starts_at: "2026-09-03T09:00:00Z",
        ends_at: "2026-09-03T10:00:00Z",
        status: "pending",
        location: "A location that is forty characters long exactly",
      },
      {
        ...events[1],
        id: "all-day-only",
        starts_at: "2026-09-04T09:00:00Z",
        ends_at: "2026-09-04T10:00:00Z",
        all_day: true,
        status: "confirmed",
        location: undefined,
      },
    ];
    const html = await (
      await calendar.render(context("?view=month&month=2026-09"))
    ).text();
    const pendingDay = html.slice(
      html.indexOf('data-day="2026-09-03"'),
      html.indexOf('data-day="2026-09-04"')
    );
    expect(pendingDay).toContain('class="mo-sticker pend"');
    expect(pendingDay).toContain('class="mo-sticker loc"');
    expect(pendingDay).not.toContain("allday");
    expect(pendingDay).toContain(
      'title="A location that is forty characters long exactly"'
    );
    expect(pendingDay).toContain("A location th…");
    expect(html).toContain('class="mo-sticker allday"');
  });

  it("creates one template per event-bearing day", async () => {
    const html = await (
      await calendar.render(context("?view=month&month=2026-09"))
    ).text();
    expect((html.match(/<template class="mo-day"/g) ?? []).length).toBe(
      new Set(events.map((event) => event.starts_at.slice(0, 10))).size
    );
  });

  it("shows an owner add tile and a guest today dot on an empty month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    fixture.events = [];
    try {
      const owner = await (
        await calendar.render(context("?view=month&month=2026-09"))
      ).text();
      const guest = await (
        await calendar.render(context("?view=month&month=2026-09", "guest"))
      ).text();
      expect(owner).toContain('<a class="mo-cell mo-add"');
      expect(guest).toContain('class="mo-cell mo-dot is-today"');
      expect(guest).not.toContain('<a class="mo-cell mo-add"');
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps guest month rendering read-only", async () => {
    const html = await (
      await calendar.render(context("?view=month&month=2026-09", "guest"))
    ).text();
    expect(html).not.toContain('<a class="mo-cell mo-add"');
    expect(html).not.toContain('id="new"');
    expect(html).not.toContain('id="prompt"');
    expect(html).not.toContain("Add event");
    expect(html).not.toContain(">Ask<");
    expect(html).toContain('class="mo-cell mo-tile');
    expect(html).toContain('<template class="mo-day"');
  });

  it("keeps all body hrefs in the safe query grammar", async () => {
    const html = await (
      await calendar.render(
        context("?view=month&month=2026-09&day=2026-09-08")
      )
    ).text();
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(
      (match) => (match[1] ?? "").replaceAll("&amp;", "&")
    );
    const grammar =
      /^[^?#"]*(\?[a-z]+=[^&"]*(&[a-z]+=[^&"]*)*)?(#\w+)?$/;
    expect(hrefs.every((href) => grammar.test(href))).toBe(true);
    expect(html).not.toContain("?&");
    expect(html).not.toContain("&&");
  });

  it("keeps agenda navigation, timeline forms, and local edit links", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T08:00:00Z"));
    try {
      const agenda = await (await calendar.render(context("?"))).text();
      expect(agenda).toContain('href="/mini/calendar?view=timeline"');
      expect(agenda).toContain("edit=local%3A0123456789abcdef");
      const timeline = await (
        await calendar.render(context("?view=timeline"))
      ).text();
      expect(timeline).toContain('id="new"');
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps overloaded templates while keeping open-day strips complete", async () => {
    fixture.events = Array.from({ length: 401 }, (_, index) => ({
      ...events[0],
      id: `event-${index}`,
      starts_at: `2026-09-01T${String(index % 24).padStart(2, "0")}:00:00`,
      ends_at: `2026-09-01T${String((index % 24) + 1).padStart(2, "0")}:00:00`,
    }));
    const html = await (
      await calendar.render(
        context("?view=month&month=2026-09&day=2026-09-01")
      )
    ).text();
    const strip = html.slice(
      html.indexOf('<li class="mo-strip"'),
      html.indexOf("<template")
    );
    expect((strip.match(/class="mo-chip(?: pending| local)?"/g) ?? []).length).toBe(
      401
    );
    expect(strip).not.toContain('class="mo-chip more"');
    const template = html.slice(
      html.indexOf('<template class="mo-day" data-day="2026-09-01"'),
      html.indexOf("</template>", html.indexOf('<template class="mo-day" data-day="2026-09-01"'))
    );
    expect((template.match(/class="mo-chip(?: pending| local)?"/g) ?? []).length).toBe(
      12
    );
    expect(template).toContain('class="mo-chip more"');
    expect(template).toContain('href="/mini/calendar?view=month&amp;day=2026-09-01"');
    expect(template).toContain("+389 more</a>");
  });

  it("leaves templates uncapped for a 40-event month", async () => {
    fixture.events = Array.from({ length: 40 }, (_, index) => ({
      ...events[0],
      id: `event-${index}`,
      starts_at: `2026-09-01T${String(index % 24).padStart(2, "0")}:00:00`,
      ends_at: `2026-09-01T${String((index % 24) + 1).padStart(2, "0")}:00:00`,
    }));
    const html = await (
      await calendar.render(context("?view=month&month=2026-09"))
    ).text();
    const template = html.slice(
      html.indexOf('<template class="mo-day" data-day="2026-09-01"'),
      html.indexOf("</template>", html.indexOf('<template class="mo-day" data-day="2026-09-01"'))
    );
    expect((template.match(/class="mo-chip(?: pending| local)?"/g) ?? []).length).toBe(
      40
    );
    expect(template).not.toContain('class="mo-chip more"');
  });

  it("preserves four-digit years in month navigation", async () => {
    const html = await (
      await calendar.render(context("?view=month&month=0050-09"))
    ).text();
    expect(html).toContain("September 0050");
    expect(html).toContain('data-month="0050-09"');
    expect(html).toContain('aria-label="September 0050"');
    expect(html).toContain('href="/mini/calendar?view=month&amp;month=0050-08"');
    expect(html).toContain('href="/mini/calendar?view=month&amp;month=0050-10"');
  });

  it("disables month navigation at the representable year boundaries", async () => {
    const minimum = await (
      await calendar.render(context("?view=month&month=0000-01"))
    ).text();
    const minimumHeader = minimum.slice(
      minimum.indexOf('<header class="mo-head"'),
      minimum.indexOf("</header>", minimum.indexOf('<header class="mo-head"'))
    );
    expect(minimumHeader.match(/<a class="mo-nav"/g) ?? []).toHaveLength(1);
    expect(minimumHeader).toContain(
      '<span class="mo-nav is-disabled" aria-hidden="true">‹</span>'
    );
    expect(minimumHeader).toContain(
      'href="/mini/calendar?view=month&amp;month=0000-02"'
    );

    const maximum = await (
      await calendar.render(context("?view=month&month=9999-12"))
    ).text();
    const maximumHeader = maximum.slice(
      maximum.indexOf('<header class="mo-head"'),
      maximum.indexOf("</header>", maximum.indexOf('<header class="mo-head"'))
    );
    expect(maximumHeader.match(/<a class="mo-nav"/g) ?? []).toHaveLength(1);
    expect(maximumHeader).toContain(
      '<span class="mo-nav is-disabled" aria-hidden="true">›</span>'
    );
    expect(maximumHeader).toContain(
      'href="/mini/calendar?view=month&amp;month=9999-11"'
    );
  });

  it("renders only owner-prefixed CRM photos", async () => {
    fixture.people = [
      {
        id: "person-0",
        name: "Ada",
        emails: ["person0@example.test"],
        photos: ["u/alice/ada.png", "https://evil.example/x.png"],
      },
    ];
    fixture.prefix = "u/alice/";
    const html = await (
      await calendar.render(context("?view=month&month=2026-09&day=2026-09-01"))
    ).text();
    expect(html).toContain(
      '<img src="https://media.example/u/alice/ada.png" alt="" width="96" height="96" loading="lazy" decoding="async">'
    );
    expect(html).not.toContain("https://evil.example/x.png");
  });

  it("uses plates when the owner bucket row is missing", async () => {
    fixture.people = [
      {
        id: "person-0",
        name: "Ada",
        emails: ["person0@example.test"],
        photos: ["u/alice/ada.png"],
      },
    ];
    fixture.prefix = undefined;
    const html = await (
      await calendar.render(context("?view=month&month=2026-09&day=2026-09-01"))
    ).text();
    const section = html.slice(html.indexOf("<section"), html.indexOf("</section>"));
    expect(section).not.toContain("<img");
    expect(html).toContain("mo-plate");
  });
});
