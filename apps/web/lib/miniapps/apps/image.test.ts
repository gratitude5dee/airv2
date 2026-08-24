/**
 * Image studio module lanes (image.goal.md §MA-I3): owners get the client
 * editor bundle under a same-origin-only CSP, card sessions and ?classic=1
 * keep the server-rendered form view, and the format=json action lane
 * returns the authoritative doc instead of a redirect.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";

const boxFiles = new Map<string, string>();

vi.mock("@/lib/box/client", () => ({
  BoxApiError: class extends Error {
    status: number;
    constructor(status: number) {
      super(`box ${status}`);
      this.status = status;
    }
  },
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) {
      const { BoxApiError } = await import("@/lib/box/client");
      throw new (BoxApiError as unknown as new (status: number) => Error)(404);
    }
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

import { image } from "@/lib/miniapps/apps/image";
import type { ImageDoc } from "@/lib/miniapps/creativeDocs";

const DOC_PATH = ".hermes/miniapps/image/default.json";

function makeCtx(
  overrides: { role?: string; via?: "card"; url?: string } = {}
): MiniAppContext {
  return {
    request: new NextRequest(
      overrides.url ?? "https://mini.example/mini/image"
    ),
    supabase: {} as unknown as SupabaseClient,
    app: makeApp({ slug: "image", kind: "render" }),
    session: {
      userId: "user-1",
      resourceId: "default",
      role: overrides.role ?? "owner",
      ...(overrides.via ? { via: overrides.via } : {}),
    },
    basePath: "/mini/image",
  } as MiniAppContext;
}

function jsonForm(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.set("format", "json");
  return data;
}

function storedDoc(): ImageDoc {
  return JSON.parse(boxFiles.get(DOC_PATH) ?? "null") as ImageDoc;
}

afterEach(() => boxFiles.clear());

describe("image studio render lanes", () => {
  it("serves the client editor to owners with a same-origin-only CSP", async () => {
    const response = await image.render(makeCtx());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('id="image-editor"');
    expect(body).toContain("/creator-os/image-editor.js");
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("keeps the classic server view on ?classic=1 and for card sessions", async () => {
    for (const ctx of [
      makeCtx({ url: "https://mini.example/mini/image?classic=1" }),
      makeCtx({ via: "card" }),
    ]) {
      const body = await (await image.render(ctx)).text();
      expect(body).not.toContain("image-editor");
      expect(body).toContain("<details");
    }
  });

  it("embeds the initial doc in the mount payload", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        title: "My poster",
        layers: [{ id: "t1", kind: "text", text: "hello" }],
      })
    );
    const body = await (await image.render(makeCtx())).text();
    expect(body).toContain("My poster");
    expect(body).toContain("hello");
  });
});

describe("image studio json action lane", () => {
  it("returns the authoritative doc instead of a redirect", async () => {
    const response = await image.action!(
      makeCtx(),
      jsonForm({ action: "add-text", text: "headline" })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { doc: ImageDoc };
    expect(payload.doc.layers).toHaveLength(1);
    expect(payload.doc.layers[0]?.text).toBe("headline");
    expect(storedDoc().layers).toHaveLength(1);
  });

  it("applies set-transform with clamping", async () => {
    await image.action!(makeCtx(), jsonForm({ action: "add-text", text: "t" }));
    const id = storedDoc().layers[0]!.id;
    const response = await image.action!(
      makeCtx(),
      jsonForm({
        action: "set-transform",
        id,
        x: "40",
        y: "-25",
        scale: "5000",
        rotation: "90",
      })
    );
    const payload = (await response.json()) as { doc: ImageDoc };
    expect(payload.doc.layers[0]?.transform).toEqual({
      x: 40,
      y: -25,
      scale: 1000,
      rotation: 90,
    });
  });

  it("supports select and reorder", async () => {
    await image.action!(makeCtx(), jsonForm({ action: "add-text", text: "a" }));
    await image.action!(makeCtx(), jsonForm({ action: "add-text", text: "b" }));
    const [first, second] = storedDoc().layers;
    await image.action!(
      makeCtx(),
      jsonForm({ action: "select", id: first!.id })
    );
    expect(storedDoc().selectedLayerId).toBe(first!.id);
    await image.action!(
      makeCtx(),
      jsonForm({ action: "reorder", id: second!.id, index: "0" })
    );
    expect(storedDoc().layers.map((l) => l.text)).toEqual(["b", "a"]);
  });

  it("still redirects the classic form lane", async () => {
    const data = new FormData();
    data.set("action", "add-text");
    data.set("text", "classic");
    const response = await image.action!(makeCtx(), data);
    expect(response.status).toBe(303);
  });
});
