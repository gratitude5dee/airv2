/**
 * MA2.4 acceptance: device-code sign-in end to end — start → pending poll →
 * owner approval → bearer mint (single-use consume) — plus deny, expiry,
 * revocation with immediate effect, and hashed-at-rest storage.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";

const db = new FakeSupabase();

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
const supabase = db.client();

beforeAll(() => {
  process.env["SESSION_SECRET"] = "test-session-secret";
});

beforeEach(() => {
  db.reset();
  // Postgres column defaults the inserts rely on.
  db.defaults["plugin_device_codes"] = {
    status: "pending",
    user_id: null,
    approved_at: null,
  };
  db.defaults["plugin_tokens"] = () => ({
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked_at: null,
  });
});

describe("device-code sign-in", () => {
  it("start → pending → approve → token, consumed exactly once", async () => {
    const started = await startDeviceAuth(supabase, "codex", "https://app/home");
    expect(started.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(started.verification_uri).toBe("https://app/home");
    // The raw device code is never stored.
    expect(db.rows("plugin_device_codes")[0]?.["device_code_hash"]).not.toBe(
      started.device_code
    );

    const pending = await pollDeviceToken(supabase, started.device_code);
    expect(pending.status).toBe("authorization_pending");

    const tool = await approveDeviceCode(supabase, started.user_code, OWNER, "approved");
    expect(tool).toBe("codex");

    const minted = await pollDeviceToken(supabase, started.device_code);
    expect(minted.status).toBe("ok");
    if (minted.status !== "ok") return;
    expect(minted.token.startsWith("wzrd_plugin_")).toBe(true);
    // Hashed at rest.
    expect(db.rows("plugin_tokens")[0]?.["token_hash"]).toBe(
      hashPluginToken(minted.token)
    );
    expect(db.rows("plugin_tokens")[0]?.["token_hash"]).not.toContain(minted.token);

    // Single use: a second poll cannot mint again.
    const again = await pollDeviceToken(supabase, started.device_code);
    expect(again.status).toBe("expired_token");
    expect(db.rows("plugin_tokens")).toHaveLength(1);
  });

  it("denied codes never mint", async () => {
    const started = await startDeviceAuth(supabase, "claude-code", "https://app/home");
    await approveDeviceCode(supabase, started.user_code, OWNER, "denied");
    const result = await pollDeviceToken(supabase, started.device_code);
    expect(result.status).toBe("access_denied");
    expect(db.rows("plugin_tokens")).toHaveLength(0);
  });

  it("expired codes cannot be approved or redeemed", async () => {
    const started = await startDeviceAuth(supabase, "codex", "https://app/home");
    const row = db.rows("plugin_device_codes")[0];
    if (!row) throw new Error("missing device code row");
    row["expires_at"] = new Date(Date.now() - 1000).toISOString();
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
