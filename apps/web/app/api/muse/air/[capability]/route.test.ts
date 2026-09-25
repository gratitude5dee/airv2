import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  fake: null as unknown as { client: () => unknown },
}));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.fake.client(),
}));

vi.mock("@/lib/box/client", () => ({
  command: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  armStopAfter: vi.fn(async () => undefined),
  ensureBoxAwake: vi.fn(),
  peekUserBox: vi.fn(),
}));
vi.mock("@/lib/hermes/client", () => ({
  createRun: vi.fn(),
  runEvents: vi.fn(),
}));
vi.mock("@/lib/hermes/terminal", () => ({
  createTerminalScanner: vi.fn(() => ({ push: vi.fn(), flush: vi.fn() })),
}));
vi.mock("@/lib/agentmail/calendar", () => ({ createCalendarEvent: vi.fn() }));
vi.mock("@/lib/mail/client", () => ({ createDraft: vi.fn(), listThreads: vi.fn() }));
vi.mock("@/lib/wallet/read", () => ({ readWalletSummary: vi.fn() }));
vi.mock("@/lib/thirdweb/client", () => ({ sendWalletTokens: vi.fn() }));
vi.mock("@/lib/muse/spend", () => ({
  checkMuseRunSpend: vi.fn(async () => ({ ok: true })),
}));

import { POST } from "./route";
import { sendWalletTokens } from "@/lib/thirdweb/client";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";

const BASE = "https://air.test/api/muse/air/";
const USER = "user-1";
const TO = "0x52908400098527886E0F7030069857D2E4169EE7";

const post = (capability: string, body: unknown, bearer?: string) =>
  POST(
    new NextRequest(`${BASE}${capability}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    }),
    { params: Promise.resolve({ capability }) },
  );

const walletBody = {
  user_id: USER,
  input: { to: TO, amount_display: "0.01" },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env["MUSE_ENABLED"] = "true";
  process.env["MUSE_WORKER_TOKEN"] = "worker-secret";
  db.fake = new AdminFakeDb();
});

describe("POST /api/muse/air/[capability]", () => {
  it("404s without or with a wrong worker bearer", async () => {
    expect((await post("wallet-request", walletBody)).status).toBe(404);
    expect((await post("wallet-request", walletBody, "not-the-token")).status).toBe(404);
    expect((await post("wallet-request", walletBody, "worker-secret")).status).not.toBe(404);
  });

  it("403s a user without a Muse grant and has no side effect", async () => {
    const response = await post("wallet-request", walletBody, "worker-secret");
    expect(response.status).toBe(403);
    const fake = db.fake as AdminFakeDb;
    expect(fake.inserts).toHaveLength(0);
    expect(sendWalletTokens).not.toHaveBeenCalled();
  });

  it("files an approval decision and never calls executeTransfer", async () => {
    const fake = db.fake as AdminFakeDb;
    fake.rows("muse_grants").push({ user_id: USER, scopes: ["profile", "wallet:request"], revoked_at: null });
    const response = await post("wallet-request", walletBody, "worker-secret");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body["decision_id"]).toBeTruthy();
    expect(body["transfer_id"]).toBeUndefined();
    expect(body["transaction_id"]).toBeUndefined();
    const transfers = fake.inserts.filter((entry) => entry.table === "wallet_transfers");
    const decisions = fake.inserts.filter((entry) => entry.table === "decisions");
    expect(transfers).toHaveLength(1);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.row["kind"]).toBe("run_approval");
    // No path may submit or claim the transfer: the only execution route is
    // the owner's approve action on the decision row.
    expect(sendWalletTokens).not.toHaveBeenCalled();
    expect(fake.updates.filter((entry) => entry.table === "wallet_transfers")).toHaveLength(0);
  });

  it("403s a grant that lacks the capability's scope", async () => {
    const fake = db.fake as AdminFakeDb;
    fake.rows("muse_grants").push({ user_id: USER, scopes: ["profile"], revoked_at: null });
    const response = await post("wallet-request", walletBody, "worker-secret");
    expect(response.status).toBe(403);
    expect(fake.inserts).toHaveLength(0);
  });
});
