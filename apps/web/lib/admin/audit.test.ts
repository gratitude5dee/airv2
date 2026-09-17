/**
 * V12 §12 — the operator audit row: shape, best-effort insert, and a failed
 * ledger write logging without throwing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminFakeDb } from "./testing/fakeDb";
import { adminAuditRow, recordAdminAudit } from "./audit";

const app = { id: "app-1", slug: "alice-promo", owner_user_id: "user-alice" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adminAuditRow", () => {
  it("carries the action, the app ids and a metadata detail only", () => {
    expect(
      adminAuditRow({ action: "dev_renew", app, detail: { version: "v1700000000001" } })
    ).toEqual({
      actor: "admin",
      action: "dev_renew",
      app_id: "app-1",
      user_id: "user-alice",
      slug: "alice-promo",
      detail: { version: "v1700000000001" },
    });
    expect(adminAuditRow({ action: "suspend", app }).detail).toEqual({});
  });
});

describe("recordAdminAudit", () => {
  it("inserts one admin_audit row", async () => {
    const db = new AdminFakeDb();
    expect(await recordAdminAudit(db.client(), { action: "dev_revoke", app })).toBe(true);
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({
      table: "admin_audit",
      row: { action: "dev_revoke", app_id: "app-1", slug: "alice-promo" },
    });
  });

  it("logs and returns false when the ledger write fails", async () => {
    const db = new AdminFakeDb();
    db.errors["admin_audit"] = { message: "relation does not exist" };
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordAdminAudit(db.client(), { action: "suspend", app })).toBe(false);
    expect(logged).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(logged.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({ msg: "admin audit insert failed", action: "suspend" });
  });
});
