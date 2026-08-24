import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runFlush } from "./flush";
import { createRun } from "../hermes/client";
import { createSpectrumSender } from "../spectrum/sender";
import { ensureBoxAwake } from "./boxes";

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
}));
vi.mock("./boxes", () => ({
  armStopAfter: vi.fn().mockResolvedValue(undefined),
  ensureBoxAwake: vi.fn(),
}));
vi.mock("./sharedBridge", () => ({
  BRIDGE_MESSAGE_ID_PREFIX: "bridge:",
  bridgeCarryMarker: (reply: string) => `[bridge] ${reply}`,
  isBridgeMarkerId: (id: string) => id.startsWith("bridge:"),
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

function fakeSupabase() {
  const deleted: string[] = [];
  const supabase = {
    deleted,
    from: (table: string) => ({
      select: () => {
        if (table === "mini_apps") {
          return {
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: registryApp, error: null }),
            }),
          };
        }
        if (table === "flush_jobs") {
          return {
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { cancelled_at: null },
                  error: null,
                }),
            }),
          };
        }
        const rows =
          table === "batch_queue"
            ? [{ id: "q1", message_id: "m1", body: "/image-editor" }]
            : [];
        return {
          eq: () => ({
            order: () => Promise.resolve({ data: rows, error: null }),
          }),
        };
      },
      delete: () => {
        deleted.push(table);
        const chain = {
          eq: () => chain,
          in: () => Promise.resolve({ error: null }),
          then: (resolve: (value: { error: null }) => void) =>
            resolve({ error: null }),
        };
        return chain;
      },
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
  };
  return supabase as unknown as SupabaseClient & { deleted: string[] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runFlush mini-app commands", () => {
  it("sends an aliased mini-app URL without waking the box or running Hermes", async () => {
    const sendRichLink = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendRichLink,
      sendText: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockRejectedValue(
      new Error("the mini-app command must not wake the box")
    );

    const supabase = fakeSupabase();
    await runFlush(
      supabase,
      {
        spaceId: "space-1",
        userId: "user-1",
        phone: "+15551234567",
        attempts: 0,
      },
      "2026-08-24T00:00:00.000Z"
    );

    expect(sendRichLink).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      "https://mini.wzrd.tech/image?t=signed"
    );
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(supabase.deleted).toContain("flush_jobs");
  });
});
