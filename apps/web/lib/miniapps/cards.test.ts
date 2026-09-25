import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnsupportedError } from "spectrum-ts";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { createSpectrumSender } from "../spectrum/sender";
import {
  checkoutCardLayout,
  mintSignedLink,
  sendMiniAppCard,
  updateMiniAppCard,
} from "./cards";
import { verifyToken } from "./tokens";

import { expectLog } from "../testing/expectLog";
vi.mock("../spectrum/sender", () => ({
  createSpectrumSender: vi.fn(),
}));

const SESSION = {
  chatGuid: "chat-guid",
  messageGuid: "message-guid",
  sessionId: "session-id",
  targetMessageGuid: "target-message-guid",
};

function makeDb(options?: {
  session?: typeof SESSION;
  persistError?: boolean;
}) {
  const db = new FakeSupabase();
  db.tables["imessage_destinations"] = [
    { user_id: "user-1", space_id: "space-1", phone: "+15555550123" },
  ];
  db.tables["miniapp_card_sessions"] = options?.["session"]
    ? [
        {
          user_id: "user-1",
          kind: "vault",
          resource_id: "default",
          space_id: "space-1",
          session: options["session"],
        },
      ]
    : [];
  if (options?.persistError) {
    db.opErrors["miniapp_card_sessions:upsert"] = {
      message: "database unavailable",
    };
  }
  return db;
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
    const db = makeDb();
    await sendMiniAppCard(
      db.client(),
      "space-1",
      "+15555550123",
      "user-1",
      "vault",
      "default"
    );
    expect(db.rows("miniapp_card_sessions")[0]?.["session"]).toEqual(SESSION);

    await updateMiniAppCard(db.client(), "user-1", "vault", "default");
    expect(senderMock.editApp).toHaveBeenCalledOnce();
    expect(senderMock.sendApp).toHaveBeenCalledOnce();
  });

  it("does nothing when no session is stored", async () => {
    const db = makeDb();
    await updateMiniAppCard(db.client(), "user-1", "vault", "default");
    expect(senderMock.sendApp).not.toHaveBeenCalled();
    expect(senderMock.editApp).not.toHaveBeenCalled();
  });

  it("deletes the session without sending when the refreshed session is invalid", async () => {
    const db = makeDb({ session: SESSION });
    senderMock.editApp.mockResolvedValueOnce(undefined);
    await updateMiniAppCard(db.client(), "user-1", "vault", "default");
    expect(senderMock.sendApp).not.toHaveBeenCalled();
    expect(db.deletes).toHaveLength(1);
    expect(db.rows("miniapp_card_sessions")).toHaveLength(0);
  });

  it("deletes the session without sending when editing is unsupported", async () => {
    const db = makeDb({ session: SESSION });
    senderMock.editApp.mockRejectedValueOnce(
      UnsupportedError.content("edit", "imessage", "not supported")
    );
    await updateMiniAppCard(db.client(), "user-1", "vault", "default");
    expect(senderMock.editApp).toHaveBeenCalledOnce();
    expect(senderMock.sendApp).not.toHaveBeenCalled();
    expect(db.deletes).toHaveLength(1);
    expect(db.rows("miniapp_card_sessions")).toHaveLength(0);
  });

  it("does not propagate a session persistence failure", async () => {
    const db = makeDb({ persistError: true });
    await expect(
      sendMiniAppCard(
        db.client(),
        "space-1",
        "+15555550123",
        "user-1",
        "vault",
        "default"
      )
    ).resolves.toBeUndefined();
    expect(senderMock.sendApp).toHaveBeenCalledOnce();
    expectLog(/mini\-app\ card\ session\ persistence\ failed/, { level: "error" });
  });
});

describe("mintSignedLink surface", () => {
  beforeEach(() => {
    process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
    process.env["MINIAPP_ORIGIN"] = "https://mini.example";
  });

  function claims(url: string) {
    const token = new URL(url).searchParams.get("t") ?? "";
    return verifyToken(token, "onboarding");
  }

  it("marks card links as opening in a Messages webview", () => {
    expect(
      claims(mintSignedLink("user-1", "onboarding", "default", "card"))?.via
    ).toBe("card");
  });

  it("leaves browser launches unmarked so apps render full", () => {
    expect(
      claims(mintSignedLink("user-1", "onboarding", "default"))?.via
    ).toBeUndefined();
  });
});

describe("checkoutCardLayout", () => {
  it("keeps progress information value-free in the Messages card", () => {
    expect(checkoutCardLayout("needs_human")).toEqual({
      caption: "Checkout",
      subcaption: "Needs your attention",
      summary: "Checkout — Needs your attention",
    });
    expect(checkoutCardLayout("completed").subcaption).toBe(
      "Completed — verify receipt"
    );
  });
});
