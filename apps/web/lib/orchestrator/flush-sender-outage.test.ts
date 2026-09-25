/**
 * Spectrum outage resilience: runFlush drains (deletes) the queued burst,
 * so any Spectrum failure that fires before a reply exists must leave the
 * burst recoverable. A sender that cannot be created (e.g. a Cloudflare
 * 502 from spectrum.photon.codes) reschedules with backoff before touching
 * the queue; a holding-line send failure after a wake failure must not
 * throw past the reschedule.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runFlush } from "./flush";
import { createSpectrumSender } from "../spectrum/sender";
import {
  createRun,
  ensureSession,
  loadConversationTranscript,
  runEvents,
  stopRun,
} from "../hermes/client";
import { probeForTapback } from "../spectrum/tapbacks";
import { ensureBoxAwake } from "./boxes";
import { sharedBridgeReply } from "./sharedBridge";
import { FakeSupabase } from "../testing/fakeSupabase";

vi.mock("../spectrum/sender", () => ({ createSpectrumSender: vi.fn() }));
vi.mock("../box/client", () => ({ command: vi.fn(), writeFile: vi.fn() }));
vi.mock("../hermes/client", () => ({
  createRun: vi.fn(),
  ensureSession: vi.fn(),
  loadConversationTranscript: vi.fn(),
  MAIN_SESSION: "main",
  MAIN_SESSION_TITLE: "Air",
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
  progressUpdateReply: vi.fn().mockResolvedValue(null),
  sharedBridgeReply: vi.fn(),
}));

function fakeSupabase(queueRows: Array<Record<string, unknown>>) {
  const db = new FakeSupabase();
  db.tables["batch_queue"] = queueRows.map((row) => ({
    space_id: "space-1",
    ...row,
  }));
  return { supabase: db.client(), db };
}

const job = {
  spaceId: "space-1",
  userId: "user-1",
  phone: "+15551234567",
  attempts: 0,
  senderTier: 0,
};

beforeEach(() => {
  vi.mocked(createSpectrumSender).mockReset();
  vi.mocked(ensureBoxAwake).mockReset();
  vi.mocked(sharedBridgeReply).mockReset();
  vi.mocked(stopRun).mockResolvedValue(undefined);
});

describe("runFlush during a Spectrum outage", () => {
  it("reschedules without draining when the sender cannot be created", async () => {
    vi.mocked(createSpectrumSender).mockRejectedValue(
      new Error("502 Bad gateway")
    );
    const { supabase, db } = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);
    await runFlush(supabase, job, new Date().toISOString());
    expect(db.queries.map((q) => q.table)).not.toContain("batch_queue");
    expect(db.deletes.map((d) => d.table)).not.toContain("batch_queue");
    const reschedule = db.updates.find(
      (update) => update.table === "flush_jobs"
    );
    expect(reschedule?.patch["attempts"]).toBe(1);
    expect(reschedule?.patch["chain_started_at"]).toBeNull();
  });

  it("rethrows sender-creation failure once attempts are exhausted", async () => {
    vi.mocked(createSpectrumSender).mockRejectedValue(
      new Error("502 Bad gateway")
    );
    const { supabase, db } = fakeSupabase([]);
    await expect(
      runFlush(supabase, { ...job, attempts: 5 }, new Date().toISOString())
    ).rejects.toThrow("502 Bad gateway");
    expect(db.queries.map((q) => q.table)).not.toContain("batch_queue");
  });

  it("still reschedules when the holding line fails after a wake failure", async () => {
    const sendText = vi.fn().mockRejectedValue(new Error("502 Bad gateway"));
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockRejectedValue(new Error("box wake failed"));
    vi.mocked(sharedBridgeReply).mockResolvedValue(null);
    const { supabase, db } = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);
    await runFlush(supabase, job, new Date().toISOString());
    const carried = db.inserts.find(
      (insert) => insert.table === "carried_messages"
    );
    expect(carried).toBeDefined();
    const reschedule = db.updates.find(
      (update) => update.table === "flush_jobs"
    );
    expect(reschedule?.patch["attempts"]).toBe(1);
  });

  it("does not carry a bridge marker when the bridged reply fails to send", async () => {
    const sendText = vi.fn().mockRejectedValue(new Error("502 Bad gateway"));
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockRejectedValue(new Error("box wake failed"));
    vi.mocked(sharedBridgeReply).mockResolvedValue("on it — one sec");
    const { supabase, db } = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);
    await runFlush(supabase, job, new Date().toISOString());
    const carries = db.inserts.filter(
      (insert) => insert.table === "carried_messages"
    );
    expect(carries).toHaveLength(1);
    const reschedule = db.updates.find(
      (update) => update.table === "flush_jobs"
    );
    expect(reschedule?.patch["attempts"]).toBe(1);
  });

  it("carries and retries a model stream failure before any bubble is sent", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockResolvedValue({
      boxId: "box-1",
      target: {
        hostedUrl: "https://box.example",
        hostedToken: "t",
        apiServerKey: "k",
      },
    } as never);
    vi.mocked(ensureSession).mockResolvedValue({ created: false });
    vi.mocked(loadConversationTranscript).mockResolvedValue({
      rows: 2,
      history: [],
    });
    vi.mocked(createRun).mockResolvedValue({ run_id: "run-1" });
    vi.mocked(runEvents).mockResolvedValue(undefined as never);
    vi.mocked(probeForTapback).mockRejectedValue(
      new Error("Provider returned an empty stream with no finish_reason")
    );
    const { supabase, db } = fakeSupabase([
      { id: "q1", message_id: "m1", body: "hello" },
    ]);

    await runFlush(supabase, job, new Date().toISOString());

    expect(db.inserts).toContainEqual({
      table: "carried_messages",
      row: expect.objectContaining({ message_id: "m1", body: "hello" }),
    });
    const reschedule = db.updates.find(
      (update) =>
        update.table === "flush_jobs" && update.patch["attempts"] === 1
    );
    expect(reschedule?.patch).toMatchObject({
      attempts: 1,
      chain_started_at: null,
    });
    expect(sendText).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      "I need a little more time. I’m continuing with the same request."
    );
  });
});
