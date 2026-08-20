/**
 * P1-8: bound_phone must be stored in the same canonical form the router
 * compares against (routing/trust.ts), or the owner's own texts never
 * resolve to tier 0. The fork is made to fail so the test observes only the
 * pre-box writes (and the rollback).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const inserts: Record<string, Row[]> = {};

function tableApi(table: string) {
  return {
    insert(row: Row) {
      (inserts[table] ??= []).push(row);
      return Object.assign(Promise.resolve({ error: null }), {
        select: () => ({
          single: async () => ({ data: { id: "user-1" }, error: null }),
        }),
      });
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
  };
}

vi.mock("../supabase", () => ({
  serviceClient: () =>
    ({ from: (table: string) => tableApi(table) }) as unknown as SupabaseClient,
}));
vi.mock("../box/client", () => ({
  command: vi.fn(),
  deleteBox: vi.fn(),
  fork: vi.fn(async () => {
    throw new Error("fork unavailable in test");
  }),
  stop: vi.fn(),
  waitForBox: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("./connectors", () => ({ installComposioMcp: vi.fn() }));
vi.mock("../skills/hub", () => ({ installBaseSkills: vi.fn() }));
vi.mock("../crypto/secretbox", () => ({ sealSecret: vi.fn() }));
vi.mock("../env", () => ({
  env: {
    boxTemplateId: () => "template-1",
    appOrigin: () => "https://air.test",
    boxDashboardAuthKey: () => null,
  },
}));

import { provisionUser } from "./provision";

describe("provisionUser bound_phone normalization (P1-8)", () => {
  beforeEach(() => {
    for (const key of Object.keys(inserts)) delete inserts[key];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("stores bound_phone / handle / sender in canonical form", async () => {
    await expect(
      provisionUser({ boundPhone: "+1 (415) 555-0123" })
    ).rejects.toThrow("fork unavailable in test");

    expect(inserts.provisioning?.[0]).toMatchObject({
      bound_phone: "+14155550123",
    });
    expect(inserts.handles?.[0]).toMatchObject({
      platform: "imessage",
      address: "+14155550123",
    });
    expect(inserts.senders?.[0]).toMatchObject({
      platform: "imessage",
      address: "+14155550123",
      trust_tier: 0,
    });
  });
});
