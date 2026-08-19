/**
 * MA2.4 acceptance: device-code sign-in end to end — start → pending poll →
 * owner approval → bearer mint (single-use consume) — plus deny, expiry,
 * revocation with immediate effect, and hashed-at-rest storage.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

interface DeviceRow {
  id: string;
  device_code_hash: string;
  user_code: string;
  tool: string;
  status: string;
  user_id: string | null;
  expires_at: string;
  approved_at: string | null;
}

interface TokenRow {
  id: string;
  user_id: string;
  tool: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const db = { codes: [] as DeviceRow[], tokens: [] as TokenRow[] };
let nextId = 1;

type Row = Record<string, unknown>;

function matches(row: Row, filters: [string, string, unknown][]): boolean {
  return filters.every(([op, col, value]) => {
    const actual = row[col];
    if (op === "eq") return actual === value;
    if (op === "is") return actual === value;
    if (op === "gt") return typeof actual === "string" && actual > String(value);
    return false;
  });
}

function table(rows: Row[]) {
  return {
    async insert(row: Row) {
      rows.push({
        id: `row-${nextId++}`,
        created_at: new Date().toISOString(),
        user_id: null,
        last_used_at: null,
        revoked_at: null,
        approved_at: null,
        status: "pending",
        ...row,
      });
      return { error: null };
    },
    select() {
      const filters: [string, string, unknown][] = [];
      const chain = {
        eq(col: string, value: unknown) {
          filters.push(["eq", col, value]);
          return chain;
        },
        order() {
          return Promise.resolve({
            data: rows.filter((r) => matches(r, filters)),
            error: null,
          });
        },
        async maybeSingle() {
          return {
            data: rows.find((r) => matches(r, filters)) ?? null,
            error: null,
          };
        },
      };
      return chain;
    },
    update(patch: Row) {
      const filters: [string, string, unknown][] = [];
      const apply = () => {
        const hit = rows.filter((r) => matches(r, filters));
        for (const row of hit) Object.assign(row, patch);
        return hit;
      };
      const chain = {
        eq(col: string, value: unknown) {
          filters.push(["eq", col, value]);
          return chain;
        },
        is(col: string, value: unknown) {
          filters.push(["is", col, value]);
          return chain;
        },
        gt(col: string, value: unknown) {
          filters.push(["gt", col, value]);
          return chain;
        },
        async select() {
          return { data: apply(), error: null };
        },
        then(resolve: (v: { error: null }) => void) {
          apply();
          resolve({ error: null });
        },
      };
      return chain;
    },
  };
}

function fakeSupabase(): SupabaseClient {
  return {
    from(name: string) {
      if (name === "plugin_device_codes") return table(db.codes as unknown as Row[]);
      if (name === "plugin_tokens") return table(db.tokens as unknown as Row[]);
      throw new Error(`unexpected table ${name}`);
    },
  } as unknown as SupabaseClient;
}

import {
  approveDeviceCode,
  hashPluginToken,
  listPluginTokens,
  normalizeTool,
  pollDeviceToken,
  revokePluginToken,
  startDeviceAuth,
  verifyPluginToken,
} from "./auth";

const OWNER = "owner-user-1";
const supabase = fakeSupabase();

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret";
});

beforeEach(() => {
  db.codes = [];
  db.tokens = [];
});

describe("device-code sign-in", () => {
  it("start → pending → approve → token, consumed exactly once", async () => {
    const started = await startDeviceAuth(supabase, "codex", "https://app/home");
    expect(started.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(started.verification_uri).toBe("https://app/home");
    // The raw device code is never stored.
    expect(db.codes[0]?.device_code_hash).not.toBe(started.device_code);

    const pending = await pollDeviceToken(supabase, started.device_code);
    expect(pending.status).toBe("authorization_pending");

    const tool = await approveDeviceCode(supabase, started.user_code, OWNER, "approved");
    expect(tool).toBe("codex");

    const minted = await pollDeviceToken(supabase, started.device_code);
    expect(minted.status).toBe("ok");
    if (minted.status !== "ok") return;
    expect(minted.token.startsWith("wzrd_plugin_")).toBe(true);
    // Hashed at rest.
    expect(db.tokens[0]?.token_hash).toBe(hashPluginToken(minted.token));
    expect(db.tokens[0]?.token_hash).not.toContain(minted.token);

    // Single use: a second poll cannot mint again.
    const again = await pollDeviceToken(supabase, started.device_code);
    expect(again.status).toBe("expired_token");
    expect(db.tokens).toHaveLength(1);
  });

  it("denied codes never mint", async () => {
    const started = await startDeviceAuth(supabase, "claude-code", "https://app/home");
    await approveDeviceCode(supabase, started.user_code, OWNER, "denied");
    const result = await pollDeviceToken(supabase, started.device_code);
    expect(result.status).toBe("access_denied");
    expect(db.tokens).toHaveLength(0);
  });

  it("expired codes cannot be approved or redeemed", async () => {
    const started = await startDeviceAuth(supabase, "codex", "https://app/home");
    const row = db.codes[0];
    if (!row) throw new Error("missing device code row");
    row.expires_at = new Date(Date.now() - 1000).toISOString();
    const tool = await approveDeviceCode(supabase, started.user_code, OWNER, "approved");
    expect(tool).toBeNull();
    const result = await pollDeviceToken(supabase, started.device_code);
    expect(result.status).toBe("expired_token");
  });

  it("an unknown device code is rejected", async () => {
    const result = await pollDeviceToken(supabase, "bogus-code");
    expect(result.status).toBe("expired_token");
  });

  it("only known tools may start", () => {
    expect(normalizeTool("codex")).toBe("codex");
    expect(normalizeTool("Claude-Code")).toBe("claude-code");
    expect(normalizeTool("evil<script>")).toBeNull();
  });
});

describe("plugin tokens", () => {
  async function mint(): Promise<string> {
    const started = await startDeviceAuth(supabase, "codex", "https://app/home");
    await approveDeviceCode(supabase, started.user_code, OWNER, "approved");
    const result = await pollDeviceToken(supabase, started.device_code);
    if (result.status !== "ok") throw new Error("mint failed");
    return result.token;
  }

  it("verifies a live bearer and rejects garbage", async () => {
    const token = await mint();
    const principal = await verifyPluginToken(supabase, token);
    expect(principal?.userId).toBe(OWNER);
    expect(principal?.tool).toBe("codex");
    expect(await verifyPluginToken(supabase, "wzrd_plugin_nope")).toBeNull();
    expect(await verifyPluginToken(supabase, "Bearer whatever")).toBeNull();
  });

  it("revocation takes immediate effect and is owner-scoped", async () => {
    const token = await mint();
    const list = await listPluginTokens(supabase, OWNER);
    expect(list).toHaveLength(1);
    const tokenId = list[0]?.id;
    if (!tokenId) throw new Error("missing token row");
    // Another user cannot revoke it.
    expect(await revokePluginToken(supabase, "someone-else", tokenId)).toBe(false);
    expect(await verifyPluginToken(supabase, token)).not.toBeNull();
    // The owner can, and the bearer dies immediately.
    expect(await revokePluginToken(supabase, OWNER, tokenId)).toBe(true);
    expect(await verifyPluginToken(supabase, token)).toBeNull();
    // Idempotent: a second revoke reports not-found.
    expect(await revokePluginToken(supabase, OWNER, tokenId)).toBe(false);
  });
});
