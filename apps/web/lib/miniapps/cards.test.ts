import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UnsupportedError } from "spectrum-ts";
import { createSpectrumSender } from "../spectrum/sender";
import {
  sendMiniAppCard,
  updateMiniAppCard,
} from "./cards";

vi.mock("../spectrum/sender", () => ({
  createSpectrumSender: vi.fn(),
}));

const SESSION = {
  chatGuid: "chat-guid",
  messageGuid: "message-guid",
  sessionId: "session-id",
  targetMessageGuid: "target-message-guid",
};

function makeSupabase(options?: {
  session?: typeof SESSION;
  persistError?: boolean;
}) {
  let session = options?.session;
  const upserts: unknown[] = [];
  const client = {
    from: (table: string) => {
      if (table === "imessage_destinations") {
        const builder = {
          eq: () => builder,
          maybeSingle: async () => ({
            data: { space_id: "space-1", phone: "+15555550123" },
            error: null,
          }),
        };
        return {
          select: () => builder,
        };
      }
      expect(table).toBe("miniapp_card_sessions");
      return {
        select: () => {
          const builder = {
            eq: () => builder,
            maybeSingle: async () => ({
              data: session ? { session } : null,
              error: null,
            }),
          };
          return builder;
        },
        upsert: async (row: unknown) => {
          upserts.push(row);
          if (options?.persistError) {
            return { error: { message: "database unavailable" } };
          }
          session = (row as { session: typeof SESSION }).session;
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, upserts, getSession: () => session };
}

const senderMock = {
  sendApp: vi.fn(),
  editApp: vi.fn(),
  close: vi.fn(async () => undefined),
};
const sender =
  senderMock as unknown as Awaited<ReturnType<typeof createSpectrumSender>>;

describe("mini-app card session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSpectrumSender).mockResolvedValue(sender);
    senderMock.sendApp.mockResolvedValue({ miniAppCardSession: SESSION });
    senderMock.editApp.mockResolvedValue(SESSION);
  });

  it("persists the session returned by a fresh send and updates in place", async () => {
    const { client, getSession } = makeSupabase();
    await sendMiniAppCard(
      client,
      "space-1",
      "+15555550123",
      "user-1",
      "vault",
      "default"
    );
    expect(getSession()).toEqual(SESSION);

    await updateMiniAppCard(client, "user-1", "vault", "default");
    expect(senderMock.editApp).toHaveBeenCalledOnce();
    expect(senderMock.sendApp).toHaveBeenCalledOnce();
  });

  it("falls back to a fresh send when no session is stored", async () => {
    const { client } = makeSupabase();
    await updateMiniAppCard(client, "user-1", "vault", "default");
    expect(senderMock.sendApp).toHaveBeenCalledOnce();
    expect(senderMock.editApp).not.toHaveBeenCalled();
  });

  it("falls back to a fresh send when editing is unsupported", async () => {
    const { client } = makeSupabase({ session: SESSION });
    senderMock.editApp.mockRejectedValueOnce(
      UnsupportedError.content("edit", "imessage", "not supported")
    );
    await updateMiniAppCard(client, "user-1", "vault", "default");
    expect(senderMock.editApp).toHaveBeenCalledOnce();
    expect(senderMock.sendApp).toHaveBeenCalledOnce();
  });

  it("does not propagate a session persistence failure", async () => {
    const { client } = makeSupabase({ persistError: true });
    await expect(
      sendMiniAppCard(
        client,
        "space-1",
        "+15555550123",
        "user-1",
        "vault",
        "default"
      )
    ).resolves.toBeUndefined();
    expect(senderMock.sendApp).toHaveBeenCalledOnce();
  });
});
