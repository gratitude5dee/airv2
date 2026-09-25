import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import { handleOnboarding, signupSender } from "./onboarding";

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
  [key: string]: unknown;
}

const db = new FakeSupabase();
const supabase = db.client();

/** Seed the account-under-test: its provisioning row plus the box a prior
 * activation may have already brought up. */
function seed(opts: {
  provisioning?: Row | null;
  /** Whether the boxes table reports a row for the user. */
  hasBox?: boolean;
}): void {
  db.tables["provisioning"] = opts.provisioning
    ? [{ user_id: "u1", ...opts.provisioning }]
    : [];
  db.tables["boxes"] = opts.hasBox ? [{ user_id: "u1" }] : [];
}

beforeEach(() => db.reset());

describe("handleOnboarding", () => {
  it("continues for active accounts", async () => {
    seed({
      provisioning: {
        state: "active",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+15551234567",
      "hi"
    );
    expect(action.kind).toBe("continue");
  });

  it("continues when no provisioning row exists", async () => {
    seed({ provisioning: null });
    const action = await handleOnboarding(supabase, "u1", "+15551234567", "hi");
    expect(action.kind).toBe("continue");
  });

  it("ignores pre-active inbound from a different sender (C11)", async () => {
    seed({
      provisioning: {
        state: "invited",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+19998887777",
      "hi"
    );
    expect(action.kind).toBe("ignore");
  });

  it("claims on first inbound from bound_phone and starts the OTP", async () => {
    seed({
      provisioning: {
        state: "invited",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+1 (555) 123-4567",
      "Hi! Send this to get started."
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("6-digit code");
    }
    expect(db.rows("provisioning")[0]?.["state"]).toBe("claimed");
  });

  it("activates on a correct OTP code", async () => {
    seed({
      provisioning: {
        state: "claimed",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
      hasBox: true,
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("Verified");
      expect(action.startCompute).toBeUndefined();
    }
    expect(db.rows("provisioning")[0]?.["state"]).toBe("active");
  });

  it("flags compute provisioning when activation wins and no box exists", async () => {
    seed({
      provisioning: {
        state: "claimed",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
      hasBox: false,
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.startCompute).toBe(true);
      expect(action.text).toContain("setting up");
    }
  });

  it("does not flag compute when the user already has a box", async () => {
    seed({
      provisioning: {
        state: "claimed",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
      hasBox: true,
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.startCompute).toBeUndefined();
    }
  });

  it("does not re-flag compute on a replayed OTP (activation already won)", async () => {
    seed({
      provisioning: {
        state: "active",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
      hasBox: false,
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("continue");
  });

  it("re-prompts on a wrong code without activating", async () => {
    seed({
      provisioning: {
        state: "claimed",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
    });
    const action = await handleOnboarding(
      supabase,
      "u1",
      "+15551234567",
      "000000"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("didn't match");
    }
    expect(db.rows("provisioning")[0]?.["state"]).toBe("claimed");
  });

  it("re-prompts when the reply has no code", async () => {
    seed({
      provisioning: {
        state: "claimed",
        bound_phone: "+15551234567",
        otp_attempts: 0,
      },
    });
    const action = await handleOnboarding(
      supabase,
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

describe("signupSender", () => {
  it("creates a pending account bound to the sender's normalized handle", async () => {
    const userId = await signupSender(supabase, "+1 (510) 634-1410");
    const inserts = db.inserts.map((entry) => entry.table);
    expect(inserts).toEqual([
      "users",
      "entitlements",
      "provisioning",
      "handles",
      "senders",
    ]);
    const provisioning = db.inserts.find(
      (entry) => entry.table === "provisioning"
    )?.row;
    expect(provisioning).toMatchObject({
      user_id: userId,
      state: "created",
      bound_phone: "+15106341410",
    });
    const sender = db.inserts.find((entry) => entry.table === "senders")?.row;
    expect(sender).toMatchObject({
      user_id: userId,
      platform: "imessage",
      address: "+15106341410",
      trust_tier: 0,
    });
  });

  it("resolves the existing account when the handle already exists", async () => {
    db.tables["handles"] = [
      {
        user_id: "u-existing",
        platform: "imessage",
        address: "+15106341410",
      },
    ];
    const userId = await signupSender(supabase, "+15106341410");
    expect(userId).toBe("u-existing");
    expect(db.inserts).toHaveLength(0);
  });

  it("recovers the winner's account when a concurrent signup took the handle", async () => {
    // The concurrent webhook's insert lands between our handles miss and our
    // own insert: the insert collides (23505) and the re-select sees its row.
    db.resolve = (query) => {
      if (query.table !== "handles" || query.mode !== "insert") {
        return undefined;
      }
      (db.tables["handles"] ??= []).push({
        user_id: "u-winner",
        platform: "imessage",
        address: "+15106341410",
      });
      return { error: { code: "23505", message: "duplicate key" } };
    };
    const userId = await signupSender(supabase, "+15106341410");
    expect(userId).toBe("u-winner");
    // The losing account's rows cascade away with its user.
    expect(db.deletes.some((entry) => entry.table === "users")).toBe(true);
  });

  it("rolls back the user row when signup fails partway through", async () => {
    db.opErrors["handles:insert"] = { code: "42501", message: "rls denied" };
    await expect(signupSender(supabase, "+15106341410")).rejects.toThrow(
      "handles insert failed"
    );
    expect(db.deletes.some((entry) => entry.table === "users")).toBe(true);
  });
});
