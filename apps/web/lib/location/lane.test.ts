import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";

const mocks = vi.hoisted(() => ({
  completeLocationRequest: vi.fn(),
  createLocationRequest: vi.fn(),
  expediteLocationRequest: vi.fn(),
  pendingLocationRequest: vi.fn(),
  recentSharedLocation: vi.fn(),
  supersedeLocationRequests: vi.fn(),
}));

vi.mock("./address", () => ({
  participantAddressFromDmChatGuid: () => "+15105550123",
}));

vi.mock("./requests", () => ({
  LOCATION_CONTEXT_PREFIX: "[Location context]",
  ...mocks,
}));

import { maybeRunLocationLane } from "./lane";

describe("maybeRunLocationLane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recentSharedLocation.mockResolvedValue(undefined);
    mocks.supersedeLocationRequests.mockResolvedValue(undefined);
    mocks.createLocationRequest.mockResolvedValue({ id: "request-1", revision: 1 });
    mocks.completeLocationRequest.mockResolvedValue(undefined);
    mocks.expediteLocationRequest.mockResolvedValue(null);
  });

  it("keeps a local shop search in the agent conversation when Find My cannot send a card", async () => {
    const sender = {
      requestLocation: vi.fn().mockResolvedValue(undefined),
      sendText: vi.fn().mockResolvedValue(undefined),
    } as unknown as SpectrumSender;

    const result = await maybeRunLocationLane(
      {} as SupabaseClient,
      sender,
      {
        spaceId: "any;-;+15105550123",
        userId: "user-1",
        phone: "+15105550123",
        senderTier: 0,
      },
      "/shop find me the cheapest burrito near me",
      "message-1"
    );

    expect(result).toEqual({
      handled: false,
      contextLine:
        "[Location unavailable: ask the owner for a neighborhood, then continue this exact search.]",
    });
    expect(mocks.completeLocationRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "request-1" }),
      { status: "declined" }
    );
    expect(sender.sendText).not.toHaveBeenCalled();
  });
});
