/**
 * V11 §13.5 Create cards: `create` opens the Create surface, `app <slug>`
 * carries one owner app and is edited in place; `/create` is owner-only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { CARD_MARKER } from "../orchestrator/outbound";
import {
  createSurfacePath,
  mintSignedLink,
  parseCardMarker,
  sendOrUpdateAppCard,
} from "./cards";
import { isCardKind } from "./cardSends";
import { maybeSendMiniAppLink, OWNER_ONLY_CARD_LINE } from "./imessageCommand";
import { STORE_APP, storeNextPath } from "./storeSession";
import { verifyToken } from "./tokens";

vi.mock("../spectrum/sender", () => ({
  createSpectrumSender: vi.fn(),
}));
const registry = vi.hoisted(() => ({ getRegistryApp: vi.fn(async () => null) }));
vi.mock("./registry", () => registry);
const sessions = vi.hoisted(() => ({
  readMiniAppCardSession: vi.fn(async (): Promise<unknown> => undefined),
  upsertMiniAppCardSession: vi.fn(async () => undefined),
  deleteMiniAppCardSession: vi.fn(async () => undefined),
  parseMiniAppCardSession: vi.fn(() => undefined),
}));
vi.mock("./cardSessions", () => sessions);
const sends = vi.hoisted(() => ({
  claimCardSend: vi.fn(async (): Promise<{ release: () => Promise<void> } | null> => ({
    release: async () => undefined,
  })),
}));
vi.mock("./cardSends", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cardSends")>()),
  claimCardSend: sends.claimCardSend,
}));

import { createSpectrumSender } from "../spectrum/sender";

beforeEach(() => {
  vi.clearAllMocks();
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
  process.env["MINIAPP_ORIGIN"] = "https://mini.example";
});

describe("card kinds", () => {
  it("registers create and app", () => {
    expect(isCardKind("create")).toBe(true);
    expect(isCardKind("app")).toBe(true);
  });
});

describe("parseCardMarker", () => {
  it("accepts bare kinds and app <slug>", () => {
    expect(parseCardMarker("onboarding")).toEqual({ kind: "onboarding", resourceId: "default" });
    expect(parseCardMarker("create")).toEqual({ kind: "create", resourceId: "default" });
    expect(parseCardMarker("app alice-promo")).toEqual({ kind: "app", resourceId: "alice-promo" });
  });

  it("rejects an app card without a slug, a bad slug, or an unknown kind", () => {
    expect(parseCardMarker("app")).toBeNull();
    expect(parseCardMarker("app ../x")).toBeNull();
    expect(parseCardMarker("nope")).toBeNull();
  });
});

describe("CARD_MARKER", () => {
  it("captures [card: app <slug>] alongside bare kinds", () => {
    const text = "done [card: app alice-promo] and [card: create] but [card: not a kind]";
    const found = [...text.matchAll(CARD_MARKER)].map((m) => m[1]);
    expect(found).toEqual(["app alice-promo", "create"]);
  });
});

describe("Create card links", () => {
  it("land on the Create surface through the store handoff", () => {
    const url = new URL(mintSignedLink("user-1", "create", "default", "card"));
    expect(url.origin + url.pathname).toBe("https://mini.example/api/mini/session");
    expect(url.searchParams.get("next")).toBe("/create");
    const claims = verifyToken(url.searchParams.get("t") ?? "", STORE_APP);
    expect(claims?.userId).toBe("user-1");
    expect(claims?.via).toBe("card");
  });

  it("preselect the app for an app card", () => {
    const url = new URL(mintSignedLink("user-1", "app", "alice-promo", "card"));
    expect(url.searchParams.get("next")).toBe("/create?app=alice-promo");
    expect(createSurfacePath("app", "default")).toBe("/create");
  });

  it("never leave the store: storeNextPath only admits /create targets", () => {
    expect(storeNextPath("/create")).toBe("/create");
    expect(storeNextPath("/create?app=alice-promo")).toBe("/create?app=alice-promo");
    expect(storeNextPath("https://evil.example/")).toBe("/");
    expect(storeNextPath("/create?app=../x")).toBe("/");
    expect(storeNextPath("//evil.example")).toBe("/");
    expect(storeNextPath(null)).toBe("/");
  });
});

function fakeSender() {
  return {
    sendApp: vi.fn(async () => undefined),
    editApp: vi.fn(async () => undefined),
    sendRichLink: vi.fn(async () => undefined),
    sendText: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

describe("/create slash command", () => {
  const supabase = {} as unknown as SupabaseClient;
  const job = { spaceId: "space-1", userId: "user-1", phone: "+15550001111" };

  it("sends the Create card to the owner without a registry lookup", async () => {
    const sender = fakeSender();
    const handled = await maybeSendMiniAppLink(
      supabase,
      sender as unknown as SpectrumSender,
      { ...job, senderTier: 0 },
      "/create"
    );
    expect(handled).toBe(true);
    expect(registry.getRegistryApp).not.toHaveBeenCalled();
    expect(sender.sendApp).toHaveBeenCalledTimes(1);
    const [, , mint, layout] = sender.sendApp.mock.calls[0] as unknown as [
      string,
      string,
      () => string,
      { caption: string },
    ];
    expect(layout.caption).toBe("Create");
    expect(new URL(mint()).searchParams.get("next")).toBe("/create");
  });

  it("tells a non-owner sender it is owner-only", async () => {
    const sender = fakeSender();
    await maybeSendMiniAppLink(
      supabase,
      sender as unknown as SpectrumSender,
      { ...job, senderTier: 1 },
      "/create"
    );
    expect(sender.sendApp).not.toHaveBeenCalled();
    expect(sender.sendText).toHaveBeenCalledWith("space-1", "+15550001111", OWNER_ONLY_CARD_LINE);
  });
});

describe("sendOrUpdateAppCard", () => {
  const owner = { userId: "user-1", spaceId: "space-1", phone: "+15550001111" };
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { space_id: "space-1", phone: "+15550001111" },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  it("sends a fresh card when the owner has none for the slug", async () => {
    const sender = fakeSender();
    vi.mocked(createSpectrumSender).mockResolvedValue(sender as unknown as SpectrumSender);
    registry.getRegistryApp.mockResolvedValueOnce({
      slug: "alice-promo",
      name: "Promo",
      owner_user_id: "user-1",
      status: "draft",
      draft_version: "v1",
      bundle_version: null,
    } as never);
    expect(await sendOrUpdateAppCard(supabase, owner, "alice-promo")).toBe("sent");
    expect(sends.claimCardSend).toHaveBeenCalledWith(supabase, "user-1", "app");
    const [, , , layout] = sender.sendApp.mock.calls[0] as unknown as [
      string,
      string,
      () => string,
      { caption: string; subcaption: string },
    ];
    expect(layout).toMatchObject({ caption: "Promo", subcaption: "Draft — preview & publish" });
  });

  it("edits the existing bubble in place without a new claim", async () => {
    const sender = fakeSender();
    vi.mocked(createSpectrumSender).mockResolvedValue(sender as unknown as SpectrumSender);
    sessions.readMiniAppCardSession.mockResolvedValue({ sessionId: "s" });
    expect(await sendOrUpdateAppCard(supabase, owner, "alice-promo")).toBe("updated");
    expect(sends.claimCardSend).not.toHaveBeenCalled();
    expect(sender.sendApp).not.toHaveBeenCalled();
    expect(sender.editApp).toHaveBeenCalledTimes(1);
  });

  it("respects the cooldown for a first send", async () => {
    sessions.readMiniAppCardSession.mockResolvedValue(undefined);
    sends.claimCardSend.mockResolvedValueOnce(null);
    expect(await sendOrUpdateAppCard(supabase, owner, "alice-promo")).toBe("cooldown");
  });
});
