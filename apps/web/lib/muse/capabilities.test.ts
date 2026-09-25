import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../box/client", () => ({
  command: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("../orchestrator/boxes", () => ({
  armStopAfter: vi.fn(async () => undefined),
  ensureBoxAwake: vi.fn(),
  peekUserBox: vi.fn(),
}));
vi.mock("../hermes/client", () => ({
  createRun: vi.fn(),
  runEvents: vi.fn(),
}));
vi.mock("../hermes/terminal", () => ({
  createTerminalScanner: vi.fn(() => ({ push: vi.fn(), flush: vi.fn() })),
}));
vi.mock("../agentmail/calendar", () => ({ createCalendarEvent: vi.fn() }));
vi.mock("../mail/client", () => ({ createDraft: vi.fn(), listThreads: vi.fn() }));
vi.mock("../wallet/read", () => ({ readWalletSummary: vi.fn() }));
vi.mock("../thirdweb/client", () => ({ sendWalletTokens: vi.fn() }));
vi.mock("./spend", () => ({
  checkMuseRunSpend: vi.fn(async () => ({ ok: true })),
}));

import { sendWalletTokens } from "../thirdweb/client";
import { AdminFakeDb } from "../admin/testing/fakeDb";
import { MuseCapabilityError, runMuseCapability } from "./capabilities";

const USER = "user-1";
const TO = "0x52908400098527886E0F7030069857D2E4169EE7";
const GRANT = { user_id: USER, scopes: ["profile", "wallet:request"], revoked_at: null };

const seededDb = () => {
  const db = new AdminFakeDb();
  db.rows("muse_grants").push({ ...GRANT });
  return db;
};

const walletInserts = (db: AdminFakeDb) =>
  db.inserts.filter((entry) => entry.table === "wallet_transfers");
const decisionInserts = (db: AdminFakeDb) =>
  db.inserts.filter((entry) => entry.table === "decisions");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["WALLET_USDC_ADDRESS"];
});

describe("runMuseCapability wallet-request", () => {
  it("files exactly one pending run_approval decision and executes no transfer", async () => {
    const db = seededDb();
    const result = await runMuseCapability(db.client(), USER, "wallet-request", {
      to: TO,
      amount_display: "0.01",
    });
    const transfers = walletInserts(db);
    const decisions = decisionInserts(db);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.row["to_address"]).toBe(TO);
    expect(transfers[0]?.row["status"]).toBeUndefined();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.row["kind"]).toBe("run_approval");
    expect(decisions[0]?.row["ref"]).toBe(transfers[0]?.row["id"]);
    expect((decisions[0]?.row["payload"] as Record<string, unknown>)["wallet_send"]).toBe(true);
    expect(result["decision_id"]).toBe(decisions[0]?.row["id"]);
    // The gate is the whole point: nothing may reach the provider or claim
    // the transfer row before the owner approves the decision.
    expect(sendWalletTokens).not.toHaveBeenCalled();
    expect(
      db.updates.filter((entry) => entry.table === "wallet_transfers"),
    ).toHaveLength(0);
    const event = db.inserts.find((entry) => entry.table === "muse_events");
    expect(event?.row["kind"]).toBe("decision");
    expect(event?.row["status"]).toBe("wallet_request");
  });

  it("files the same approval for a USDC request", async () => {
    process.env["WALLET_USDC_ADDRESS"] = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const db = seededDb();
    await runMuseCapability(db.client(), USER, "wallet-request", {
      to: TO,
      amount_display: "2.5",
      token_address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    });
    const transfers = walletInserts(db);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.row["token_symbol"]).toBe("USDC");
    expect(transfers[0]?.row["amount_wei"]).toBe("2500000");
    expect(sendWalletTokens).not.toHaveBeenCalled();
  });

  it("403s when the owner has no active Muse grant and writes nothing", async () => {
    const db = new AdminFakeDb();
    await expect(
      runMuseCapability(db.client(), USER, "wallet-request", {
        to: TO,
        amount_display: "0.01",
      }),
    ).rejects.toMatchObject({ name: "MuseCapabilityError", status: 403 });
    expect(db.inserts).toHaveLength(0);
    expect(sendWalletTokens).not.toHaveBeenCalled();
  });

  it("403s when the grant lacks the wallet:request scope", async () => {
    const db = new AdminFakeDb();
    db.rows("muse_grants").push({ user_id: USER, scopes: ["profile", "wallet:read"], revoked_at: null });
    await expect(
      runMuseCapability(db.client(), USER, "wallet-request", {
        to: TO,
        amount_display: "0.01",
      }),
    ).rejects.toMatchObject({ name: "MuseCapabilityError", status: 403 });
    expect(db.inserts).toHaveLength(0);
  });

  it("ignores revoked grants", async () => {
    const db = new AdminFakeDb();
    db.rows("muse_grants").push({ ...GRANT, revoked_at: "2026-01-01T00:00:00Z" });
    await expect(
      runMuseCapability(db.client(), USER, "wallet-request", {
        to: TO,
        amount_display: "0.01",
      }),
    ).rejects.toBeInstanceOf(MuseCapabilityError);
    expect(db.inserts).toHaveLength(0);
  });
});
