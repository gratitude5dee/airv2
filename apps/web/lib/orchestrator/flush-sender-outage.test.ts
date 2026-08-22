/**
 * Spectrum outage resilience: runFlush drains (deletes) the queued burst,
 * so any Spectrum failure that fires before a reply exists must leave the
 * burst recoverable. A sender that cannot be created (e.g. a Cloudflare
 * 502 from spectrum.photon.codes) reschedules with backoff before touching
 * the queue; a holding-line send failure after a wake failure must not
 * throw past the reschedule.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runFlush } from "./flush";
import { createSpectrumSender } from "../spectrum/sender";
import { ensureBoxAwake } from "./boxes";
import { sharedBridgeReply } from "./sharedBridge";

vi.mock("../spectrum/sender", () => ({ createSpectrumSender: vi.fn() }));
vi.mock("../box/client", () => ({ command: vi.fn(), writeFile: vi.fn() }));
vi.mock("../hermes/client", () => ({
  createRun: vi.fn(),
  ensureSession: vi.fn(),
  MAIN_SESSION: "main",
  runEvents: vi.fn(),
  stopRun: vi.fn(),
}));
vi.mock("../bots/client", () => ({
  botTarget: vi.fn(),
  BOT_CHAT_SESSION: "bot-chat",
  BOT_CHAT_TITLE: "Bot Chat",
}));
vi.mock("../bots/mentions", () => ({ parseMention: vi.fn() }));
vi.mock("../bots/store", () => ({ listBots: vi.fn().mockResolvedValue([]) }));
vi.mock("../spectrum/tapbacks", () => ({ probeForTapback: vi.fn() }));
vi.mock("../creative/imessage", () => ({
  maybeRunCreativeLane: vi.fn().mockResolvedValue(false),
}));
vi.mock("./boxes", () => ({
  armStopAfter: vi.fn().mockResolvedValue(undefined),
  ensureBoxAwake: vi.fn(),
}));
vi.mock("./sharedBridge", () => ({
  BRIDGE_MESSAGE_ID_PREFIX: "bridge:",
  bridgeCarryMarker: (reply: string) => `[bridge] ${reply}`,
  isBridgeMarkerId: (id: string) => id.startsWith("bridge:"),
  sharedBridgeReply: vi.fn(),
}));

interface TableOps {
  reads: string[];
  deletes: string[];
  updates: Array<{ table: string; values: Record<string, unknown> }>;
  inserts: Array<{ table: string; rows: unknown }>;
}

function fakeSupabase(queueRows: Array<Record<string, unknown>>) {
  const ops: TableOps = { reads: [], deletes: [], updates: [], inserts: [] };
  const supabase = {
    ops,
    from: (table: string) => ({
      select: () => {
        ops.reads.push(table);
        const rows = table === "batch_queue" ? queueRows : [];
        return {
          eq: () => ({
            order: () => Promise.resolve({ data: rows, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      },
      delete: () => {
        ops.deletes.push(table);
        const chain = {
          eq: () => chain,
          in: () => Promise.resolve({ error: null }),
          then: (resolve: (value: { error: null }) => void) =>
            resolve({ error: null }),
        };
        return chain;
      },
      update: (values: Record<string, unknown>) => {
        ops.updates.push({ table, values });
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert: (rows: unknown) => {
        ops.inserts.push({ table, rows });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return supabase as unknown as SupabaseClient & { ops: TableOps };
}

const job = {
  spaceId: "space-1",
  userId: "user-1",
  phone: "+15551234567",
  attempts: 0,
};

beforeEach(() => {
  vi.mocked(createSpectrumSender).mockReset();
  vi.mocked(ensureBoxAwake).mockReset();
  vi.mocked(sharedBridgeReply).mockReset();
});

describe("runFlush during a Spectrum outage", () => {
  it("reschedules without draining when the sender cannot be created", async () => {
    vi.mocked(createSpectrumSender).mockRejectedValue(
      new Error("502 Bad gateway")
    );
    const supabase = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);
    await runFlush(supabase, job, new Date().toISOString());
    expect(supabase.ops.reads).not.toContain("batch_queue");
    expect(supabase.ops.deletes).not.toContain("batch_queue");
    const reschedule = supabase.ops.updates.find(
      (update) => update.table === "flush_jobs"
    );
    expect(reschedule?.values.attempts).toBe(1);
    expect(reschedule?.values.chain_started_at).toBeNull();
  });

  it("rethrows sender-creation failure once attempts are exhausted", async () => {
    vi.mocked(createSpectrumSender).mockRejectedValue(
      new Error("502 Bad gateway")
    );
    const supabase = fakeSupabase([]);
    await expect(
      runFlush(supabase, { ...job, attempts: 5 }, new Date().toISOString())
    ).rejects.toThrow("502 Bad gateway");
    expect(supabase.ops.reads).not.toContain("batch_queue");
  });

  it("still reschedules when the holding line fails after a wake failure", async () => {
    const sendText = vi.fn().mockRejectedValue(new Error("502 Bad gateway"));
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockRejectedValue(new Error("box wake failed"));
    vi.mocked(sharedBridgeReply).mockResolvedValue(null);
    const supabase = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);
    await runFlush(supabase, job, new Date().toISOString());
    const carried = supabase.ops.inserts.find(
      (insert) => insert.table === "carried_messages"
    );
    expect(carried).toBeDefined();
    const reschedule = supabase.ops.updates.find(
      (update) => update.table === "flush_jobs"
    );
    expect(reschedule?.values.attempts).toBe(1);
  });

  it("does not carry a bridge marker when the bridged reply fails to send", async () => {
    const sendText = vi.fn().mockRejectedValue(new Error("502 Bad gateway"));
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockRejectedValue(new Error("box wake failed"));
    vi.mocked(sharedBridgeReply).mockResolvedValue("on it — one sec");
    const supabase = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);
    await runFlush(supabase, job, new Date().toISOString());
    const carries = supabase.ops.inserts.filter(
      (insert) => insert.table === "carried_messages"
    );
    expect(carries).toHaveLength(1);
    const reschedule = supabase.ops.updates.find(
      (update) => update.table === "flush_jobs"
    );
    expect(reschedule?.values.attempts).toBe(1);
  });
});
