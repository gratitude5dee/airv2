/**
 * /twin grammar and the iMessage lane: owner-only, bare command answers with
 * status + builder link, `say` renders speech, anything else renders an
 * image, and delivery goes through the creative lane's helper with the
 * synthetic-media caption.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";

const twin = vi.hoisted(() => ({
  createTwinSpeechVideo: vi.fn(),
  createTwinImage: vi.fn(),
}));
vi.mock("./twin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./twin")>()),
  createTwinSpeechVideo: (...args: unknown[]) =>
    twin.createTwinSpeechVideo(...(args as [])),
  createTwinImage: (...args: unknown[]) => twin.createTwinImage(...(args as [])),
}));

const resolve = vi.hoisted(() => ({ resolveIdentityReference: vi.fn() }));
vi.mock("./resolve", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resolve")>()),
  resolveIdentityReference: (...args: unknown[]) =>
    resolve.resolveIdentityReference(...(args as [])),
}));

const delivery = vi.hoisted(() => ({ deliverCreativeResult: vi.fn(async () => undefined) }));
vi.mock("../creative/imessage", () => ({
  deliverCreativeResult: (...args: unknown[]) =>
    delivery.deliverCreativeResult(...(args as [])),
}));

vi.mock("../miniapps/cards", () => ({
  mintSignedLink: vi.fn(
    (_userId: string, slug: string) => `https://mini.wzrd.tech/${slug}?t=signed`
  ),
}));

import {
  maybeRunTwinLane,
  parseTwinCommand,
  runTwinCommand,
  twinBuilderLink,
  TWIN_SYNTHETIC_LINE,
} from "./twinCommand";

describe("parseTwinCommand", () => {
  it("parses the four shapes and defaults the handle to the caller", () => {
    expect(parseTwinCommand("/twin")).toEqual({ kind: "card" });
    expect(parseTwinCommand("/twin @grat")).toEqual({ kind: "status", handle: "grat" });
    expect(parseTwinCommand("/twin say Welcome to AirV2")).toEqual({
      kind: "speak",
      handle: null,
      script: "Welcome to AirV2",
    });
    expect(parseTwinCommand('/twin @Grat Say: "Welcome to AirV2"')).toEqual({
      kind: "speak",
      handle: "grat",
      script: "Welcome to AirV2",
    });
    expect(
      parseTwinCommand("/twin @grat Create a profile image in a futuristic editorial style")
    ).toEqual({
      kind: "image",
      handle: "grat",
      prompt: "Create a profile image in a futuristic editorial style",
    });
    expect(parseTwinCommand("/TWIN a portrait in soft light")).toEqual({
      kind: "image",
      handle: null,
      prompt: "a portrait in soft light",
    });
  });

  it("ignores prose, other commands and look-alikes", () => {
    expect(parseTwinCommand("my twin sister")).toBeNull();
    expect(parseTwinCommand("/twins are fun")).toBeNull();
    expect(parseTwinCommand("/zap @grat")).toBeNull();
    expect(parseTwinCommand("/twin say")).toEqual({ kind: "card" });
  });
});

describe("twinBuilderLink", () => {
  it("opens onboarding on the consent panel", () => {
    expect(twinBuilderLink("u1", "card")).toBe(
      "https://mini.wzrd.tech/onboarding?t=signed&step=consent"
    );
  });
});

function fakeSupabase(username: string | null) {
  return {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: username ? { username } : null, error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

function fakeSender() {
  const texts: string[] = [];
  return {
    texts,
    sender: {
      sendText: vi.fn(async (_space: string, _phone: string, text: string) => {
        texts.push(text);
      }),
      sendAttachment: vi.fn(),
      sendRichLink: vi.fn(),
      getAttachment: vi.fn(),
    } as unknown as SpectrumSender,
  };
}

const job = { spaceId: "space", userId: "u1", phone: "+1", senderTier: 0 };

beforeEach(() => {
  twin.createTwinSpeechVideo.mockReset();
  twin.createTwinImage.mockReset();
  resolve.resolveIdentityReference.mockReset();
  delivery.deliverCreativeResult.mockClear();
});

describe("maybeRunTwinLane", () => {
  it("passes ordinary prose through", async () => {
    const { sender } = fakeSender();
    expect(await maybeRunTwinLane(fakeSupabase("grat"), sender, job, "hello")).toBe(false);
  });

  it("refuses non-owners before anything runs", async () => {
    const { sender, texts } = fakeSender();
    const handled = await maybeRunTwinLane(
      fakeSupabase("grat"),
      sender,
      { ...job, senderTier: 1 },
      "/twin say hi"
    );
    expect(handled).toBe(true);
    expect(texts[0]).toContain("only the owner");
    expect(twin.createTwinSpeechVideo).not.toHaveBeenCalled();
  });

  it("answers a bare /twin with status, help and the builder link", async () => {
    resolve.resolveIdentityReference.mockResolvedValue({
      ok: true,
      twin: {
        username: "grat",
        isOwner: true,
        twin: { voice_status: "ready", avatar_status: "off" },
        profileImage: { asset_id: "p1" },
      },
    });
    const { sender, texts } = fakeSender();
    await maybeRunTwinLane(fakeSupabase("grat"), sender, job, "[attachment:a1]\n/twin");
    expect(texts[0]).toContain("@grat — profile image ✓ · voice ✓ · video avatar off.");
    expect(texts[0]).toContain("https://mini.wzrd.tech/onboarding?t=signed&step=consent");
  });

  it("renders speech and delivers with the synthetic caption", async () => {
    twin.createTwinSpeechVideo.mockResolvedValue({
      ok: true,
      status: "delivered",
      line: "here is your twin",
      asset: { id: "a1", storage_key: "k", sha256: "abcdef01", ext: "mp4" },
      deliveryUrl: "https://signed.example/twin.mp4",
      kind: "video",
      jobId: "job-1",
    });
    const { sender } = fakeSender();
    const supabase = fakeSupabase("grat");
    const handled = await maybeRunTwinLane(supabase, sender, job, "/twin say Welcome to AirV2");
    expect(handled).toBe(true);
    expect(twin.createTwinSpeechVideo).toHaveBeenCalledWith(supabase, "u1", {
      channel: "imessage",
      script: "Welcome to AirV2",
    });
    const args = delivery.deliverCreativeResult.mock.calls[0] as unknown[];
    expect(args[3]).toMatchObject({
      status: "delivered",
      deliveryLine: `here is your twin — ${TWIN_SYNTHETIC_LINE("grat")}`,
    });
    expect(args[4]).toBe("job-1");
    expect(args[5]).toBe("twin");
  });

  it("sends the refusal line when the twin cannot render", async () => {
    twin.createTwinImage.mockResolvedValue({
      ok: false,
      status: "refused",
      line: "no approved profile image yet — finish the Photo Booth in onboarding.",
      jobId: "job-2",
    });
    const { sender, texts } = fakeSender();
    await maybeRunTwinLane(fakeSupabase("grat"), sender, job, "/twin a portrait");
    expect(texts[0]).toContain("no approved profile image yet");
    expect(delivery.deliverCreativeResult).not.toHaveBeenCalled();
  });
});

describe("runTwinCommand with a named handle", () => {
  const supabase = fakeSupabase("grat");

  it("refuses someone else's twin for /twin (public twins go through /zap)", async () => {
    resolve.resolveIdentityReference.mockResolvedValue({
      ok: true,
      twin: { username: "bob", isOwner: false },
    });
    const result = await runTwinCommand(
      supabase,
      "u1",
      { kind: "image", handle: "bob", prompt: "as an astronaut" },
      { channel: "web" }
    );
    expect(result.ok).toBe(false);
    expect(result.line).toContain("/zap or /imagine with @bob");
    expect(twin.createTwinImage).not.toHaveBeenCalled();
  });

  it("relays the resolver's line for a private or unknown handle", async () => {
    resolve.resolveIdentityReference.mockResolvedValue({
      ok: false,
      reason: "not_found",
      line: "@zed isn't a twin you can use.",
    });
    const result = await runTwinCommand(
      supabase,
      "u1",
      { kind: "speak", handle: "zed", script: "hi" },
      { channel: "web" }
    );
    expect(result).toEqual({
      ok: false,
      status: "refused",
      line: "@zed isn't a twin you can use.",
      jobId: null,
    });
  });
});
