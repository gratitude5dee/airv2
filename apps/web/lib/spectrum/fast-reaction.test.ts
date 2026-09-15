import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(async () => undefined),
  createGrpcClient: vi.fn(),
  issueImessageTokens: vi.fn(),
  setReaction: vi.fn(async () => ({ guid: "reaction-1" })),
}));

vi.mock("@photon-ai/advanced-imessage/grpc", () => ({
  createGrpcClient: mocks.createGrpcClient,
}));

vi.mock("spectrum-ts", () => ({
  cloud: { issueImessageTokens: mocks.issueImessageTokens },
}));

vi.mock("../env", () => ({
  env: {
    spectrumProjectId: () => "project-1",
    spectrumProjectSecret: () => "project-secret",
  },
}));

describe("fast iMessage reactions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env["SPECTRUM_IMESSAGE_ADDRESS"];
    mocks.createGrpcClient.mockReturnValue({
      close: mocks.close,
      messages: { setReaction: mocks.setReaction },
    });
  });

  it("uses one direct gRPC call and reuses a warm shared token", async () => {
    mocks.issueImessageTokens.mockResolvedValue({
      type: "shared",
      token: "shared-token",
      expiresIn: 3600,
    });
    const { createFastReactionSender } = await import("./fast-reaction");
    const first = await createFastReactionSender("shared");
    const second = await createFastReactionSender("shared");

    await first?.react("any;-;+15550001111", "message-1", "👀");

    expect(mocks.issueImessageTokens).toHaveBeenCalledTimes(1);
    expect(mocks.createGrpcClient).toHaveBeenCalledTimes(2);
    expect(mocks.createGrpcClient).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "imessage.spectrum.photon.codes:443",
        token: "shared-token",
      }),
    );
    expect(mocks.setReaction).toHaveBeenCalledWith(
      "any;-;+15550001111",
      "message-1",
      { kind: "emoji", emoji: "👀" },
      true,
      undefined,
    );
    await first?.close();
    await second?.close();
  });

  it("selects a dedicated line and preserves multipart reaction targets", async () => {
    mocks.issueImessageTokens.mockResolvedValue({
      type: "dedicated",
      expiresIn: 3600,
      auth: { "line-a": "token-a", "line-b": "token-b" },
      numbers: {
        "line-a": "+15550001111",
        "line-b": "+15550002222",
      },
    });
    const { createFastReactionSender } = await import("./fast-reaction");
    const sender = await createFastReactionSender("+15550002222");

    await sender?.react("any;-;+15550003333", "p:2/parent-guid", "👀");

    expect(mocks.createGrpcClient).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "line-b.imsg.photon.codes:443",
        token: "token-b",
      }),
    );
    expect(mocks.setReaction).toHaveBeenCalledWith(
      "any;-;+15550003333",
      "parent-guid",
      { kind: "emoji", emoji: "👀" },
      true,
      { partIndex: 2 },
    );
  });

  it("returns no sender when a dedicated phone is not attached", async () => {
    mocks.issueImessageTokens.mockResolvedValue({
      type: "dedicated",
      expiresIn: 3600,
      auth: { "line-a": "token-a" },
      numbers: { "line-a": "+15550001111" },
    });
    const { createFastReactionSender } = await import("./fast-reaction");

    await expect(
      createFastReactionSender("+15550009999"),
    ).resolves.toBeUndefined();
    expect(mocks.createGrpcClient).not.toHaveBeenCalled();
  });
});
