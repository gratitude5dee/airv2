/**
 * Berd mini-app skeleton (berd.goal.md §MA-B1): owner-only on every route,
 * unknown actions fail closed, an unpaired surface says so instead of
 * inventing data, and a hostile box document cannot plant markup or a
 * credential in the rendered view (C9, C18).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";
import { normalizeBerdDoc } from "@/lib/miniapps/berd/state";

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

import { berd } from "@/lib/miniapps/apps/berd";

const DOC_PATH = ".hermes/miniapps/berd/default.json";

function makeCtx(role = "owner"): MiniAppContext {
  return {
    request: new NextRequest("https://mini.example/mini/berd"),
    supabase: {} as unknown as SupabaseClient,
    app: makeApp({ slug: "berd", kind: "render" }),
    session: { userId: "user-1", resourceId: "default", role },
    basePath: "/mini/berd",
  } as MiniAppContext;
}

function form(action: string): FormData {
  const data = new FormData();
  data.set("action", action);
  return data;
}

afterEach(() => boxFiles.clear());

describe("berd mini-app", () => {
  it("renders an honest unpaired surface with no Berd anywhere", async () => {
    const response = await berd.render(makeCtx());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("○ not connected");
    expect(body).toContain("Berd has never checked in.");
    expect(body).toContain("nothing synced yet.");
  });

  it("refuses render and action for guest and viewer sessions", async () => {
    for (const role of ["guest", "viewer"]) {
      expect((await berd.render(makeCtx(role))).status).toBe(403);
      expect(
        (await berd.action!(makeCtx(role), form("refresh"))).status
      ).toBe(403);
    }
  });

  it("fails closed on unknown and empty actions", async () => {
    for (const action of ["", "pair-begin", "agent-delete", "__proto__"]) {
      const response = await berd.action!(makeCtx(), form(action));
      expect(response.status).toBe(403);
      expect(await response.text()).toBe("unknown action");
    }
  });

  it("refuses to refresh while unpaired instead of faking a sync", async () => {
    const body = await (await berd.action!(makeCtx(), form("refresh"))).text();
    expect(body).toContain("No Berd device is paired yet");
    expect(boxFiles.has(DOC_PATH)).toBe(false);
  });

  it("escapes hostile document content and drops key-shaped values", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        title: "<script>alert(1)</script>",
        link: { status: "paired", deviceLabel: "sk-livesecrettoken1234567" },
        agents: [{ id: "a1", name: "<img src=x onerror=alert(1)>" }],
        providers: [
          { id: "p1", name: "openrouter", configured: true },
          { id: "p2", name: "sk-abcdefghijklmnop", configured: false },
        ],
      })
    );
    const body = await (await berd.render(makeCtx())).text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).not.toContain("<img src=x");
    expect(body).not.toContain("sk-livesecrettoken1234567");
    expect(body).not.toContain("sk-abcdefghijklmnop");
    expect(body).toContain("openrouter");
  });
});

describe("berd document normalizer", () => {
  it("returns the default document for junk input", () => {
    for (const junk of [null, 7, "berd", [], { link: 3 }]) {
      const doc = normalizeBerdDoc(junk);
      expect(doc.schemaVersion).toBe(1);
      expect(doc.link.status).toBe("unpaired");
      expect(doc.agents).toEqual([]);
    }
  });

  it("drops rows without an id or name and unknown enum values", () => {
    const doc = normalizeBerdDoc({
      link: { status: "hacked", protocolVersion: -3 },
      agents: [{ id: "a1" }, { name: "no id" }, { id: "a2", name: "Scout" }],
      pending: [
        { id: "p1", group: "agents", action: "list", state: "exfiltrating" },
      ],
    });
    expect(doc.link.status).toBe("unpaired");
    expect(doc.link.protocolVersion).toBeNull();
    expect(doc.agents.map((agent) => agent.id)).toEqual(["a2"]);
    expect(doc.pending[0]?.state).toBe("queued");
  });

  it("never keeps provider key material, only a configured boolean", () => {
    const doc = normalizeBerdDoc({
      providers: [
        {
          id: "p1",
          name: "venice",
          configured: true,
          key: "sk-shouldneversurvive123456",
        },
      ],
    });
    expect(JSON.stringify(doc)).not.toContain("sk-shouldneversurvive");
    expect(doc.providers[0]).toEqual({
      id: "p1",
      name: "venice",
      configured: true,
    });
  });

  it("bounds mirrored lists and string lengths", () => {
    const doc = normalizeBerdDoc({
      title: "t".repeat(500),
      agents: Array.from({ length: 400 }, (_, i) => ({
        id: `a${i}`,
        name: "Agent",
      })),
    });
    expect(doc.title.length).toBe(120);
    expect(doc.agents.length).toBe(200);
  });
});
