/**
 * P0-4 gate-settings PATCH: ownership comes from the store session (never
 * the body), passwords land hashed, and x402 can only be enabled with a
 * positive price.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyPassword } from "@/lib/miniapps/gates";

const opsEvents: { kind: string; ref: string | null }[] = [];
const updates: Record<string, unknown>[] = [];
let appRow: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: (table: string) => {
      if (table === "ops_events") {
        const chain = {
          eq: () => chain,
          gte: async () => ({ count: 0, error: null }),
        };
        return {
          insert: async (row: { kind: string; ref: string | null }) => {
            opsEvents.push(row);
            return { error: null };
          },
          select: () => chain,
        };
      }
      if (table === "mini_apps") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: appRow }) }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            const chain = {
              eq: () => chain,
              then: (resolve: (value: { error: null }) => void) =>
                resolve({ error: null }),
            };
            return chain;
          },
        };
      }
      throw new Error(`fake supabase: unexpected table ${table}`);
    },
  }),
}));
vi.mock("@/lib/miniapps/storeSession", () => ({
  storeSessionUserId: () => "owner-1",
}));

import { PATCH } from "./route";

function patch(body: unknown): NextRequest {
  return new NextRequest("https://mini.example/api/mini/publish", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function app(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "app-1",
    slug: "alice-notes",
    owner_user_id: "owner-1",
    access: "single",
    password_hash: null,
    x402_enabled: false,
    x402_price_usdc: null,
    plugin_signin_enabled: false,
    status: "published",
    ...overrides,
  };
}

beforeEach(() => {
  opsEvents.length = 0;
  updates.length = 0;
  appRow = app();
});

describe("PATCH /api/mini/publish", () => {
  it("403s when the app belongs to someone else", async () => {
    appRow = app({ owner_user_id: "someone-else" });
    const res = await PATCH(patch({ slug: "alice-notes", access: "multiplayer" }));
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("404s an unknown slug", async () => {
    appRow = null;
    const res = await PATCH(patch({ slug: "nope", access: "single" }));
    expect(res.status).toBe(404);
  });

  it("400s invalid field values instead of writing", async () => {
    for (const body of [
      { slug: "alice-notes" },
      { slug: "alice-notes", access: "public" },
      { slug: "alice-notes", x402_enabled: "yes" },
      { slug: "alice-notes", x402_price_usdc: "0.5" },
      { slug: "alice-notes", password: 42 },
      { slug: "alice-notes", plugin_signin_enabled: 1 },
      { access: "single" },
    ]) {
      const res = await PATCH(patch(body));
      expect(res.status).toBe(400);
    }
    expect(updates).toHaveLength(0);
  });

  it("requires a positive price to enable x402", async () => {
    for (const price of [undefined, null, 0, -1, Number.NaN]) {
      const res = await PATCH(
        patch({ slug: "alice-notes", x402_enabled: true, x402_price_usdc: price })
      );
      expect(res.status).toBe(400);
    }
    expect(updates).toHaveLength(0);
    const ok = await PATCH(
      patch({ slug: "alice-notes", x402_enabled: true, x402_price_usdc: 0.25 })
    );
    expect(ok.status).toBe(200);
    expect(updates[0]).toMatchObject({
      x402_enabled: true,
      x402_price_usdc: 0.25,
    });
  });

  it("hashes the password, never storing the plaintext", async () => {
    const res = await PATCH(patch({ slug: "alice-notes", password: "hunter22" }));
    expect(res.status).toBe(200);
    const stored = updates[0]?.password_hash as string;
    expect(stored).toMatch(/^scrypt:/);
    expect(stored).not.toContain("hunter22");
    expect(verifyPassword("hunter22", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("clears the password with null", async () => {
    appRow = app({ password_hash: "scrypt:aa:bb" });
    const res = await PATCH(patch({ slug: "alice-notes", password: null }));
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ password_hash: null });
  });

  it("writes access and plugin_signin_enabled and ledgers the change", async () => {
    const res = await PATCH(
      patch({
        slug: "alice-notes",
        access: "multiplayer",
        plugin_signin_enabled: true,
      })
    );
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({
      access: "multiplayer",
      plugin_signin_enabled: true,
    });
    expect(
      opsEvents.filter((e) => e.kind === "publish" && e.ref === "gates:alice-notes")
    ).toHaveLength(1);
  });
});
