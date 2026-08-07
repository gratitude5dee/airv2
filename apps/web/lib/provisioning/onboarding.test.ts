import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleOnboarding } from "./onboarding";

vi.mock("../thirdweb/client", () => ({
  initiateSmsAuth: vi.fn(async () => undefined),
  completeSmsAuth: vi.fn(async (_phone: string, code: string) => {
    if (code !== "123456") throw new Error("bad code");
    return { walletAddress: "0xabc", isNewUser: true, token: "jwt" };
  }),
}));

interface Row {
  state: string;
  bound_phone: string;
  otp_attempts: number;
}

function fakeSupabase(row: Row | null): SupabaseClient {
  const updates: Record<string, unknown>[] = [];
  const client = {
    updates,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row }),
        }),
      }),
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        const chain = {
          eq: () => chain,
          is: () => chain,
          then: (resolve: (value: { error: null }) => void) =>
            resolve({ error: null }),
        };
        return chain;
      },
    }),
  };
  return client as unknown as SupabaseClient;
}

describe("handleOnboarding", () => {
  it("continues for active accounts", async () => {
    const action = await handleOnboarding(
      fakeSupabase({ state: "active", bound_phone: "+15551234567", otp_attempts: 0 }),
      "u1",
      "+15551234567",
      "hi"
    );
    expect(action.kind).toBe("continue");
  });

  it("continues when no provisioning row exists", async () => {
    const action = await handleOnboarding(fakeSupabase(null), "u1", "+15551234567", "hi");
    expect(action.kind).toBe("continue");
  });

  it("ignores pre-active inbound from a different sender (C11)", async () => {
    const action = await handleOnboarding(
      fakeSupabase({ state: "invited", bound_phone: "+15551234567", otp_attempts: 0 }),
      "u1",
      "+19998887777",
      "hi"
    );
    expect(action.kind).toBe("ignore");
  });

  it("claims on first inbound from bound_phone and starts the OTP", async () => {
    const action = await handleOnboarding(
      fakeSupabase({ state: "invited", bound_phone: "+15551234567", otp_attempts: 0 }),
      "u1",
      "+1 (555) 123-4567",
      "Hi! Send this to get started."
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("6-digit code");
    }
  });

  it("activates on a correct OTP code", async () => {
    const action = await handleOnboarding(
      fakeSupabase({ state: "claimed", bound_phone: "+15551234567", otp_attempts: 0 }),
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("Verified");
    }
  });

  it("re-prompts on a wrong code without activating", async () => {
    const action = await handleOnboarding(
      fakeSupabase({ state: "claimed", bound_phone: "+15551234567", otp_attempts: 0 }),
      "u1",
      "+15551234567",
      "000000"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("didn't match");
    }
  });

  it("re-prompts when the reply has no code", async () => {
    const action = await handleOnboarding(
      fakeSupabase({ state: "claimed", bound_phone: "+15551234567", otp_attempts: 0 }),
      "u1",
      "+15551234567",
      "what code?"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("6-digit code");
    }
  });
});
