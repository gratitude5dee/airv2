/**
 * Consent grants: one live grant per scope, idempotent grant, revoke closes
 * the grant, and the guard throws a written line when a scope is missing.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONSENT_POLICY_VERSION,
  ConsentRequiredError,
  grantConsent,
  hasConsent,
  listConsents,
  requireConsent,
  revokeConsent,
} from "./consent";

interface Result {
  data: unknown;
  error?: { code?: string; message: string } | null;
}

function builder(results: Result[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const chain: Record<string, unknown> = {};
  const next = () => results.shift() ?? { data: null, error: null };
  for (const method of ["select", "eq", "is", "order", "insert", "update"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    });
  }
  chain["maybeSingle"] = vi.fn(async () => next());
  chain["single"] = vi.fn(async () => next());
  chain["then"] = (resolve: (value: Result) => unknown) =>
    Promise.resolve(next()).then(resolve);
  return { chain, calls };
}

function fakeSupabase(results: Result[]) {
  const { chain, calls } = builder(results);
  const supabase = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
  return { supabase, calls };
}

const grant = {
  id: "c-1",
  user_id: "u1",
  scope: "likeness",
  policy_version: CONSENT_POLICY_VERSION,
  surface: "onboarding",
  evidence_asset_id: null,
  granted_at: "2026-09-01T00:00:00Z",
  revoked_at: null,
};

describe("grantConsent", () => {
  it("returns the existing live grant without inserting", async () => {
    const { supabase, calls } = fakeSupabase([{ data: grant }]);
    const result = await grantConsent(supabase, "u1", "likeness", {
      surface: "onboarding",
    });
    expect(result?.id).toBe("c-1");
    expect(calls.some((call) => call.method === "insert")).toBe(false);
  });

  it("inserts a versioned grant when none is live", async () => {
    const { supabase, calls } = fakeSupabase([
      { data: null },
      { data: { ...grant, id: "c-2", scope: "voice" } },
    ]);
    const result = await grantConsent(supabase, "u1", "voice", {
      surface: "settings",
      evidenceAssetId: "asset-9",
    });
    expect(result?.id).toBe("c-2");
    const insert = calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toEqual({
      user_id: "u1",
      scope: "voice",
      policy_version: CONSENT_POLICY_VERSION,
      surface: "settings",
      evidence_asset_id: "asset-9",
    });
  });

  it("re-reads the winner when a concurrent grant took the unique slot", async () => {
    const { supabase } = fakeSupabase([
      { data: null },
      { data: null, error: { code: "23505", message: "duplicate" } },
      { data: { ...grant, id: "c-winner" } },
    ]);
    const result = await grantConsent(supabase, "u1", "likeness", {
      surface: "onboarding",
    });
    expect(result?.id).toBe("c-winner");
  });
});

describe("revokeConsent / hasConsent / requireConsent", () => {
  it("closes a live grant and reports it", async () => {
    const { supabase, calls } = fakeSupabase([{ data: [{ id: "c-1" }] }]);
    expect(await revokeConsent(supabase, "u1", "likeness")).toBe(true);
    const update = calls.find((call) => call.method === "update");
    expect(update?.args[0]).toHaveProperty("revoked_at");
  });

  it("reports false when nothing was live", async () => {
    const { supabase } = fakeSupabase([{ data: [] }]);
    expect(await revokeConsent(supabase, "u1", "voice")).toBe(false);
  });

  it("hasConsent mirrors the live row; requireConsent throws a written line", async () => {
    expect(await hasConsent(fakeSupabase([{ data: grant }]).supabase, "u1", "likeness")).toBe(true);
    expect(await hasConsent(fakeSupabase([{ data: null }]).supabase, "u1", "likeness")).toBe(false);
    await expect(
      requireConsent(fakeSupabase([{ data: null }]).supabase, "u1", "voice")
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("listConsents drops rows with unknown scopes", async () => {
    const { supabase } = fakeSupabase([
      { data: [grant, { ...grant, id: "c-x", scope: "telepathy" }] },
    ]);
    const consents = await listConsents(supabase, "u1");
    expect(consents.map((row) => row.id)).toEqual(["c-1"]);
  });
});
