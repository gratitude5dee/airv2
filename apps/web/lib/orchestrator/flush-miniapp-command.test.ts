import { beforeEach, describe, expect, it, vi } from "vitest";
import { runFlush } from "./flush";
import { createRun } from "../hermes/client";
import { createSpectrumSender } from "../spectrum/sender";
import { ensureBoxAwake } from "./boxes";
import { mintSignedLink } from "../miniapps/cards";
import { FakeSupabase } from "../testing/fakeSupabase";

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
vi.mock("../miniapps/cards", () => ({
  mintSignedLink: vi.fn(
    (_userId: string, slug: string) => `https://mini.wzrd.tech/${slug}?t=signed`
  ),
  cardLayout: vi.fn((slug: string) => ({ caption: slug })),
  persistCardSession: vi.fn().mockResolvedValue(undefined),
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
  sharedBridgeReply: vi.fn().mockResolvedValue(null),
}));

const registryApp = {
  id: "app-image",
  slug: "image",
  kind: "input",
  owner_user_id: null,
  name: "Image Editor",
  description: "Edit images",
  icon_key: null,
  publisher_username: null,
  publisher_wallet: null,
  agent_identity: null,
  visibility: "public",
  access: "single",
  password_hash: null,
  x402_enabled: false,
  x402_price_usdc: null,
  plugin_signin_enabled: false,
  status: "published",
  bundle_version: null,
  listed_at: null,
  updated_at: "2026-08-24T00:00:00.000Z",
};

function fakeSupabase(options: { registryError?: string } = {}) {
  const db = new FakeSupabase();
  db.tables["batch_queue"] = [
    {
      id: "q1",
      user_id: "user-1",
      space_id: "space-1",
      sender_id: null,
      message_id: "m1",
      body: "/image-editor",
      received_at: "2026-08-24T00:00:00.000Z",
    },
  ];
  if (options.registryError) {
    db.errors["mini_apps"] = { message: options.registryError };
  } else {
    db.tables["mini_apps"] = [{ ...registryApp }];
  }
  return { supabase: db.client(), db };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runFlush mini-app commands", () => {
  it("sends an aliased mini-app card without waking the box or running Hermes", async () => {
    const sendApp = vi.fn().mockResolvedValue(undefined);
    const sendRichLink = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendApp,
      sendRichLink,
      sendText: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockRejectedValue(
      new Error("the mini-app command must not wake the box")
    );

    const { supabase, db } = fakeSupabase();
    const job = {
      spaceId: "space-1",
      userId: "user-1",
      phone: "+15551234567",
      attempts: 0,
      senderTier: 0,
    };
    await runFlush(
      supabase,
      job,
      "2026-08-24T00:00:00.000Z"
    );

    expect(sendApp).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      expect.any(Function),
      { caption: "image" }
    );
    const urlThunk = sendApp.mock.calls[0]?.[2] as () => string;
    expect(urlThunk()).toBe("https://mini.wzrd.tech/image?t=signed");
    expect(sendRichLink).not.toHaveBeenCalled();
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(db.deletes.map((d) => d.table)).toContain("flush_jobs");
  });

  it("falls back to a rich link when the app card send fails", async () => {
    const sendApp = vi.fn().mockRejectedValue(new Error("unsupported"));
    const sendRichLink = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendApp,
      sendRichLink,
      sendText: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as never);

    const { supabase, db } = fakeSupabase();
    const job = {
      spaceId: "space-1",
      userId: "user-1",
      phone: "+15551234567",
      attempts: 0,
      senderTier: 0,
    };
    await runFlush(
      supabase,
      job,
      "2026-08-24T00:00:00.000Z"
    );

    expect(sendRichLink).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      "https://mini.wzrd.tech/image?t=signed"
    );
    expect(db.deletes.map((d) => d.table)).toContain("flush_jobs");
  });

  it("does not mint an owner link for a non-owner sender", async () => {
    const sendApp = vi.fn().mockResolvedValue(undefined);
    const sendRichLink = vi.fn().mockResolvedValue(undefined);
    const sendText = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendApp,
      sendRichLink,
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);

    const { supabase, db } = fakeSupabase();
    const job = {
      spaceId: "space-1",
      userId: "user-1",
      phone: "+15551234567",
      attempts: 0,
      senderTier: 1,
    };
    await runFlush(
      supabase,
      job,
      "2026-08-24T00:00:00.000Z"
    );

    expect(sendApp).not.toHaveBeenCalled();
    expect(sendRichLink).not.toHaveBeenCalled();
    expect(mintSignedLink).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      "only the owner can open mini-apps."
    );
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(db.deletes.map((d) => d.table)).toContain("flush_jobs");
  });

  it("requeues and reschedules a slash command when the registry lookup fails", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendApp: vi.fn().mockResolvedValue(undefined),
      sendRichLink: vi.fn().mockResolvedValue(undefined),
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);

    const { supabase, db } = fakeSupabase({ registryError: "database unavailable" });
    const job = {
      spaceId: "space-1",
      userId: "user-1",
      phone: "+15551234567",
      attempts: 0,
      senderTier: 0,
    };
    await runFlush(
      supabase,
      job,
      "2026-08-24T00:00:00.000Z"
    );

    expect(
      db.inserts.find((insert) => insert.table === "batch_queue")?.row
    ).toMatchObject({
      user_id: "user-1",
      space_id: "space-1",
      phone: "+15551234567",
      sender_id: null,
      message_id: "m1",
      body: "/image-editor",
    });
    expect(
      db.updates.find((update) => update.table === "flush_jobs")?.patch[
        "attempts"
      ]
    ).toBe(1);
    expect(sendText).not.toHaveBeenCalled();
    expect(db.deletes.map((d) => d.table)).not.toContain("flush_jobs");
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
  });
});
