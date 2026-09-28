/**
 * Consent grants: one live grant per scope, idempotent grant, revoke closes
 * the grant, and the guard throws a written line when a scope is missing.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import {
  CONSENT_POLICY_VERSION,
  ConsentRequiredError,
  grantConsent,
  hasConsent,
  listConsents,
  requireConsent,
  revokeConsent,
} from "./consent";

const db = new FakeSupabase();

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

beforeEach(() => {
  db.reset();
});

describe("grantConsent", () => {
  it("returns the existing live grant without inserting", async () => {
    db.tables["twin_consents"] = [{ ...grant }];
    const result = await grantConsent(db.client(), "u1", "likeness", {
      surface: "onboarding",
    });
    expect(result?.id).toBe("c-1");
    expect(db.inserts).toHaveLength(0);
  });

  it("inserts a versioned grant when none is live", async () => {
    const result = await grantConsent(db.client(), "u1", "voice", {
      surface: "settings",
      evidenceAssetId: "asset-9",
    });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]?.row).toMatchObject({
      user_id: "u1",
      scope: "voice",
      policy_version: CONSENT_POLICY_VERSION,
      surface: "settings",
      evidence_asset_id: "asset-9",
    });
    expect(result?.id).toBe(db.inserts[0]?.row["id"]);
  });

  it("re-reads the winner when a concurrent grant took the unique slot", async () => {
    // The winner row lands between the caller's read and insert: the first
    // lookup still misses, the insert collides on the unique slot, and the
    // re-read returns the winner. unique keys make the insert raise 23505.
    db.tables["twin_consents"] = [{ ...grant, id: "c-winner" }];
    db.uniques["twin_consents"] = ["user_id", "scope"];
    let reads = 0;
    db.resolve = (q) => {
      if (q.table === "twin_consents" && q.mode === "select") {
        reads += 1;
        if (reads === 1) return { data: null };
      }
      return undefined;
    };
    const result = await grantConsent(db.client(), "u1", "likeness", {
      surface: "onboarding",
    });
    expect(result?.id).toBe("c-winner");
  });
});

describe("revokeConsent / hasConsent / requireConsent", () => {
  it("closes a live grant and reports true", async () => {
    db.tables["twin_consents"] = [{ ...grant }];
    expect(await revokeConsent(db.client(), "u1", "likeness")).toBe(true);
    expect(db.updates[0]?.patch).toHaveProperty("revoked_at");
    expect(db.rows("twin_consents")[0]?.["revoked_at"]).not.toBeNull();
  });

  it("reports false when nothing was live", async () => {
    db.tables["twin_consents"] = [{ ...grant }];
    expect(await revokeConsent(db.client(), "u1", "voice")).toBe(false);
  });

  it("hasConsent mirrors the live row; requireConsent throws a written line", async () => {
    db.tables["twin_consents"] = [{ ...grant }];
    expect(await hasConsent(db.client(), "u1", "likeness")).toBe(true);
    expect(await hasConsent(db.client(), "u1", "voice")).toBe(false);
    await expect(
      requireConsent(db.client(), "u1", "voice")
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("listConsents drops rows with unknown scopes", async () => {
    db.tables["twin_consents"] = [
      { ...grant },
      { ...grant, id: "c-x", scope: "telepathy" },
    ];
    const consents = await listConsents(db.client(), "u1");
    expect(consents.map((row) => row.id)).toEqual(["c-1"]);
  });
});
