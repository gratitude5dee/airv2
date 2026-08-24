import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runFlush } from "./flush";
import { createRun } from "../hermes/client";
import { createSpectrumSender } from "../spectrum/sender";
import { ensureBoxAwake } from "./boxes";
import { mintSignedLink } from "../miniapps/cards";

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

function fakeSupabase(options: { registryError?: string } = {}) {
  const deleted: string[] = [];
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; rows: unknown }> = [];
  const supabase = {
    deleted,
    updates,
    inserts,
    from: (table: string) => ({
      select: () => {
        if (table === "mini_apps") {
          return {
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve(
                  options.registryError
                    ? {
                        data: null,
                        error: { message: options.registryError },
                      }
                    : { data: registryApp, error: null }
                ),
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
      update: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
      insert: (rows: unknown) => {
        inserts.push({ table, rows });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return supabase as unknown as SupabaseClient & {
    deleted: string[];
    updates: Array<{ table: string; values: Record<string, unknown> }>;
    inserts: Array<{ table: string; rows: unknown }>;
  };
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
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(supabase.deleted).toContain("flush_jobs");
  });

  it("does not mint an owner link for a non-owner sender", async () => {
    const sendRichLink = vi.fn().mockResolvedValue(undefined);
    const sendText = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendRichLink,
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);

    const supabase = fakeSupabase();
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

    expect(sendRichLink).not.toHaveBeenCalled();
    expect(mintSignedLink).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      "only the owner can open mini-apps."
    );
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(supabase.deleted).toContain("flush_jobs");
  });

  it("requeues and reschedules a slash command when the registry lookup fails", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendRichLink: vi.fn().mockResolvedValue(undefined),
      sendText,
      close: vi.fn().mockResolvedValue(undefined),
    } as never);

    const supabase = fakeSupabase({ registryError: "database unavailable" });
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
      supabase.inserts.find((insert) => insert.table === "batch_queue")?.rows
    ).toEqual([
      {
        user_id: "user-1",
        space_id: "space-1",
        phone: "+15551234567",
        message_id: "m1",
        body: "/image-editor",
      },
    ]);
    expect(
      supabase.updates.find((update) => update.table === "flush_jobs")?.values
        .attempts
    ).toBe(1);
    expect(sendText).not.toHaveBeenCalled();
    expect(supabase.deleted).not.toContain("flush_jobs");
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
  });
});
