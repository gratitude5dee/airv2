import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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
}

interface Call {
  table: string;
  op: string;
  values?: unknown;
}

interface FakeOptions {
  provisioning?: Row | null;
  /** Whether the boxes table reports a row for the user. */
  hasBox?: boolean;
  /** What a handles select resolves to for signupSender. */
  existingHandleUserId?: string | null;
  /** Resolve the handle only on the (1-based) Nth handles select. */
  existingHandleOnSelect?: number;
  handleInsertError?: { code: string; message?: string } | null;
  nextUserId?: string;
}

function fakeSupabase(opts: Row | null | FakeOptions): SupabaseClient & {
  calls: Call[];
  provisioningRow: () => Row | null;
} {
  const options: FakeOptions =
    opts === null || "bound_phone" in opts
      ? { provisioning: opts as Row | null }
      : (opts as FakeOptions);
  let provisioningRow = options.provisioning ?? null;
  let handlesSelects = 0;
  const calls: Call[] = [];

  const builder = (table: string, op: string, values?: unknown) => {
    calls.push({ table, op, values });
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const key of ["select", "eq", "neq", "in", "is"]) {
      chain[key] = self;
    }
    chain["maybeSingle"] = async () => {
      if (table === "handles") {
        handlesSelects += 1;
        const resolves =
          options.existingHandleUserId &&
          (options.existingHandleOnSelect === undefined ||
            handlesSelects >= options.existingHandleOnSelect);
        return {
          data: resolves ? { user_id: options.existingHandleUserId } : null,
          error: null,
        };
      }
      return {
        data:
          table === "provisioning"
            ? provisioningRow
            : table === "boxes"
              ? options.hasBox
                ? { user_id: "u1" }
                : null
              : null,
        error: null,
      };
    };
    chain["single"] = async () => ({
      data: table === "users" ? { id: options.nextUserId ?? "u-new" } : null,
      error: null,
    });
    chain["then"] = (resolve: (value: unknown) => void) => {
      if (table === "handles" && op === "insert" && options.handleInsertError) {
        return resolve({ error: options.handleInsertError });
      }
      if (table === "provisioning" && op === "update") {
        const next = (values as { state?: string }).state;
        if (next === "active") {
          // activate()'s atomic transition claim: a row already active wins
          // nothing — mirrors update ... where state != 'active' returning.
          if (provisioningRow === null || provisioningRow.state === "active") {
            return resolve({ data: [], error: null });
          }
          provisioningRow = { ...provisioningRow, state: "active" };
          return resolve({ data: [{ user_id: "u1" }], error: null });
        }
        if (next && provisioningRow) {
          provisioningRow = { ...provisioningRow, state: next };
        }
        return resolve({ data: null, error: null });
      }
      return resolve({ data: null, error: null });
    };
    return chain;
  };

  const client = {
    calls,
    provisioningRow: () => provisioningRow,
    from: (table: string) => ({
      select: () => builder(table, "select"),
      insert: (values: unknown) => builder(table, "insert", values),
      update: (values: unknown) => builder(table, "update", values),
      delete: () => builder(table, "delete"),
    }),
  };
  return client as unknown as SupabaseClient & {
    calls: Call[];
    provisioningRow: () => Row | null;
  };
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
      fakeSupabase({
        provisioning: {
          state: "claimed",
          bound_phone: "+15551234567",
          otp_attempts: 0,
        },
        hasBox: true,
      }),
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("reply");
    if (action.kind === "reply") {
      expect(action.text).toContain("Verified");
      expect(action.startCompute).toBeUndefined();
    }
  });

  it("flags compute provisioning when activation wins and no box exists", async () => {
    const action = await handleOnboarding(
      fakeSupabase({
        provisioning: {
          state: "claimed",
          bound_phone: "+15551234567",
          otp_attempts: 0,
        },
        hasBox: false,
      }),
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
    const action = await handleOnboarding(
      fakeSupabase({
        provisioning: {
          state: "claimed",
          bound_phone: "+15551234567",
          otp_attempts: 0,
        },
        hasBox: true,
      }),
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
    const action = await handleOnboarding(
      fakeSupabase({
        provisioning: {
          state: "active",
          bound_phone: "+15551234567",
          otp_attempts: 0,
        },
        hasBox: false,
      }),
      "u1",
      "+15551234567",
      "123456"
    );
    expect(action.kind).toBe("continue");
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

describe("signupSender", () => {
  it("creates a pending account bound to the sender's normalized handle", async () => {
    const client = fakeSupabase({ nextUserId: "u-new" });
    const userId = await signupSender(client, "+1 (510) 634-1410");
    expect(userId).toBe("u-new");
    const inserts = client.calls.filter((c) => c.op === "insert");
    expect(inserts.map((c) => c.table)).toEqual([
      "users",
      "entitlements",
      "provisioning",
      "handles",
      "senders",
    ]);
    const provisioning = inserts.find((c) => c.table === "provisioning");
    expect(provisioning?.values).toMatchObject({
      user_id: "u-new",
      state: "created",
      bound_phone: "+15106341410",
    });
    const sender = inserts.find((c) => c.table === "senders");
    expect(sender?.values).toMatchObject({
      user_id: "u-new",
      platform: "imessage",
      address: "+15106341410",
      trust_tier: 0,
    });
  });

  it("resolves the existing account when the handle already exists", async () => {
    const client = fakeSupabase({ existingHandleUserId: "u-existing" });
    const userId = await signupSender(client, "+15106341410");
    expect(userId).toBe("u-existing");
    expect(client.calls.filter((c) => c.op === "insert")).toHaveLength(0);
  });

  it("recovers the winner's account when a concurrent signup took the handle", async () => {
    const client = fakeSupabase({
      nextUserId: "u-lost",
      handleInsertError: { code: "23505" },
      // First handles select misses; the re-select after the 23505 sees the
      // concurrent webhook's row.
      existingHandleUserId: "u-winner",
      existingHandleOnSelect: 2,
    });
    const userId = await signupSender(client, "+15106341410");
    expect(userId).toBe("u-winner");
    // The losing account's rows cascade away with its user.
    expect(
      client.calls.some((c) => c.table === "users" && c.op === "delete")
    ).toBe(true);
  });

  it("rolls back the user row when signup fails partway through", async () => {
    const client = fakeSupabase({
      nextUserId: "u-dead",
      handleInsertError: { code: "42501", message: "rls denied" },
    });
    await expect(signupSender(client, "+15106341410")).rejects.toThrow(
      "handles insert failed"
    );
    expect(
      client.calls.some((c) => c.table === "users" && c.op === "delete")
    ).toBe(true);
  });
});
