/**
 * Buzz mini-app skeleton (buzz.goal.md §MA-Z1): owner-only, unknown actions
 * fail closed, an unbound surface refuses to fake a relay read, and no
 * private-key-shaped value survives the normalizer or reaches the rendered
 * HTML (C9, C18). The surface has no field that accepts a key at all.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";
import { normalizeBuzzDoc } from "@/lib/miniapps/buzz/state";

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

import { buzz } from "@/lib/miniapps/apps/buzz";

const DOC_PATH = ".hermes/miniapps/buzz/default.json";
const NSEC = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqzzzzz";

function makeCtx(role = "owner"): MiniAppContext {
  return {
    request: new NextRequest("https://mini.example/mini/buzz"),
    supabase: {} as unknown as SupabaseClient,
    app: makeApp({ slug: "buzz", kind: "render" }),
    session: { userId: "user-1", resourceId: "default", role },
    basePath: "/mini/buzz",
  } as MiniAppContext;
}

function form(action: string): FormData {
  const data = new FormData();
  data.set("action", action);
  return data;
}

afterEach(() => boxFiles.clear());

describe("buzz mini-app", () => {
  it("renders an unbound surface and never asks for a key", async () => {
    const response = await buzz.render(makeCtx());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("○ not connected");
    expect(body).toContain("No community");
    expect(body).not.toContain("BUZZ_PRIVATE_KEY");
    expect(body).not.toMatch(/name="(key|nsec|private_key|secret)"/);
  });

  it("refuses render and action for guest and viewer sessions", async () => {
    for (const role of ["guest", "viewer"]) {
      expect((await buzz.render(makeCtx(role))).status).toBe(403);
      expect((await buzz.action!(makeCtx(role), form("refresh"))).status).toBe(
        403
      );
    }
  });

  it("fails closed on unknown actions, including write verbs not yet built", async () => {
    for (const action of [
      "",
      "connect-begin",
      "message-send",
      "agent-draft-create",
      "messages-delete",
    ]) {
      const response = await buzz.action!(makeCtx(), form(action));
      expect(response.status).toBe(403);
      expect(await response.text()).toBe("unknown action");
    }
  });

  it("refuses to refresh while unbound", async () => {
    const body = await (await buzz.action!(makeCtx(), form("refresh"))).text();
    expect(body).toContain("No Buzz community is connected yet");
    expect(boxFiles.has(DOC_PATH)).toBe(false);
  });

  it("renders outstanding agent drafts as ready for review, never created", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        link: {
          status: "connected",
          relayUrl: "wss://relay.example/",
          npub: "npub1exampleexampleexampleexample",
          signerKind: "box",
        },
        agents: [{ name: "Scout", draftState: "ready-for-review" }],
      })
    );
    const body = await (await buzz.render(makeCtx())).text();
    expect(body).toContain("ready for review");
    expect(body).not.toMatch(/Scout[^<]*created/i);
  });

  it("escapes hostile relay content and drops planted key material", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        title: "<script>alert(1)</script>",
        link: {
          status: "connected",
          relayUrl: "wss://relay.example/",
          npub: NSEC,
        },
        channels: [
          { id: "c1", name: "<img src=x onerror=alert(1)>" },
          { id: "c2", name: "general", topic: NSEC },
        ],
        threads: [{ channelId: "c2", rootEventId: "e1", excerpt: NSEC }],
      })
    );
    const body = await (await buzz.render(makeCtx())).text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).not.toContain("<img src=x");
    expect(body).not.toContain(NSEC);
    expect(body).toContain("general");
  });
});

describe("buzz document normalizer", () => {
  it("returns the default document for junk input", () => {
    for (const junk of [null, 7, "buzz", [], { link: "wss://x" }]) {
      const doc = normalizeBuzzDoc(junk);
      expect(doc.schemaVersion).toBe(1);
      expect(doc.link.status).toBe("unbound");
      expect(doc.link.relayUrl).toBeNull();
      expect(doc.channels).toEqual([]);
    }
  });

  it("keeps only wss/https relay URLs and npub identities", () => {
    expect(
      normalizeBuzzDoc({ link: { relayUrl: "wss://relay.example" } }).link
        .relayUrl
    ).toBe("wss://relay.example/");
    for (const relayUrl of [
      "file:///etc/passwd",
      "javascript:alert(1)",
      "not a url",
      "ws://relay.example",
    ]) {
      expect(normalizeBuzzDoc({ link: { relayUrl } }).link.relayUrl).toBeNull();
    }
    expect(normalizeBuzzDoc({ link: { npub: NSEC } }).link.npub).toBeNull();
    expect(normalizeBuzzDoc({ link: { npub: "deadbeef" } }).link.npub).toBeNull();
  });

  it("drops every key-shaped value anywhere in the document", () => {
    const hex = "a".repeat(64);
    const doc = normalizeBuzzDoc({
      title: NSEC,
      link: {
        signerKind: "smuggled",
        communityLabel: "bunker://relay?secret=1",
      },
      agents: [{ name: "Scout", npub: NSEC, access: hex }, { name: hex }],
      pending: [{ id: "p1", group: "messages", verb: "send", note: NSEC }],
    });
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("nsec1");
    expect(serialized).not.toContain("bunker://");
    expect(serialized).not.toContain(hex);
    expect(doc.link.signerKind).toBeNull();
    expect(doc.agents).toEqual([{ name: "Scout" }]);
    expect(doc.pending[0]?.note).toBeUndefined();
  });

  it("bounds participants, counters, and list lengths", () => {
    const doc = normalizeBuzzDoc({
      dms: [
        {
          id: "d1",
          participants: Array.from({ length: 30 }, (_, i) => `npub1p${i}`),
        },
      ],
      channels: Array.from({ length: 400 }, (_, i) => ({
        id: `c${i}`,
        name: "general",
        unread: -5,
      })),
      workflows: [{ id: "w1", name: "deploy", pendingApprovals: 1e9 }],
    });
    expect(doc.dms[0]?.participants.length).toBe(9);
    expect(doc.channels.length).toBe(200);
    expect(doc.channels[0]?.unread).toBeUndefined();
    expect(doc.workflows[0]?.pendingApprovals).toBe(9999);
  });
});
