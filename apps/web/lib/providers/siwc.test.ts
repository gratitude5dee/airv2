/**
 * Sign in with ChatGPT (SIWC): the registration/paste-back contract — the
 * authorize URL carries the dynamic client + host id only on first
 * registration, attempts are sealed at rest and expire, and finishSiwc
 * rejects every malformed/mismatched callback before a token is ever asked
 * for. The sealed bundle never leaves the server (models_cache is the only
 * post-sign-in field the UI reads).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

import {
  beginSiwc,
  disconnectSiwc,
  finishSiwc,
  pendingSiwcUrl,
  SIWC_DYNAMIC_CLIENT,
  siwcModelAllowed,
  siwcStatus,
} from "./siwc";

const VAULT_KEY = "b".repeat(64);
const db = new FakeSupabase();
const supabase = db.client();

const seedPending = async () => {
  const result = await beginSiwc(supabase, "u-1");
  expect(result.ok).toBe(true);
  return result as { ok: true; url: string };
};

const pendingRow = () => {
  const row = db.tables["provider_oauth_attempts"]?.[0];
  if (!row) throw new Error("missing attempt row");
  return row;
};

beforeEach(() => {
  vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
  db.reset();
  db.uniques["provider_oauth"] = ["user_id", "provider"];
  db.uniques["provider_oauth_attempts"] = ["user_id", "provider"];
});

describe("beginSiwc", () => {
  it("first registration carries the dynamic client, a minted host id, and the air agent hint", async () => {
    const { url } = await seedPending();
    const params = new URL(url).searchParams;
    expect(url.startsWith("https://auth.openai.com/api/accounts/authorize")).toBe(true);
    expect(params.get("client_id")).toBe(SIWC_DYNAMIC_CLIENT);
    expect(params.get("ext_agent_host_id")).toMatch(/^urn:uuid:/);
    expect(params.get("agent_name_hint")).toBe("air");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toBeTruthy();
    expect(params.get("nonce")).toBeTruthy();
    expect(params.get("scope")).toContain("chatgpt.tokens.use.direct");
  });

  it("seals the attempt — the PKCE verifier never touches the row in plaintext", async () => {
    await seedPending();
    const row = pendingRow();
    expect(row["user_id"]).toBe("u-1");
    expect(row["provider"]).toBe("openai");
    expect(String(row["attempt_sealed"])).not.toContain("verifier");
    expect(String(row["attempt_sealed"])).not.toContain("nonce");
    expect(row["state"]).toBeTruthy();
  });

  it("fails closed when the vault is disabled", async () => {
    vi.stubEnv("PROVIDER_VAULT_KEY", "");
    const result = await beginSiwc(supabase, "u-1");
    expect(result.ok).toBe(false);
    expect(db.tables["provider_oauth_attempts"] ?? []).toHaveLength(0);
  });

  it("re-auth reuses the issued client id and drops the agent hint", async () => {
    db.tables["provider_oauth"] = [
      {
        user_id: "u-1",
        provider: "openai",
        client_id: "oaiapp_abc123",
        host_id: "urn:uuid:host-1",
        bundle_sealed: "sealed",
      },
    ];
    const { url } = await seedPending();
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe("oaiapp_abc123");
    expect(params.get("ext_agent_host_id")).toBe("urn:uuid:host-1");
    expect(params.get("agent_name_hint")).toBeNull();
  });
});

describe("pendingSiwcUrl", () => {
  it("rebuilds the authorize URL for a pending attempt and is null with none", async () => {
    expect(await pendingSiwcUrl(supabase, "u-1")).toBeNull();
    const { url } = await seedPending();
    expect(await pendingSiwcUrl(supabase, "u-1")).toBe(url);
  });
});

describe("finishSiwc", () => {
  const pendingState = async () => {
    await seedPending();
    return String(pendingRow()["state"]);
  };

  it("requires a live attempt", async () => {
    const result = await finishSiwc(supabase, "u-1", "http://127.0.0.1:1455/auth/callback?code=x&state=y");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("expired");
  });

  it("rejects a non-URL paste and a URL without a code", async () => {
    await seedPending();
    const bad = await finishSiwc(supabase, "u-1", "not a url");
    expect(bad.ok).toBe(false);
    const missing = await finishSiwc(supabase, "u-1", "http://127.0.0.1:1455/auth/callback?state=whatever");
    expect(missing.ok).toBe(false);
  });

  it("an OAuth error in the pasted URL cancels the attempt", async () => {
    const state = await pendingState();
    const result = await finishSiwc(
      supabase,
      "u-1",
      `http://127.0.0.1:1455/auth/callback?error=access_denied&state=${state}`
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cancelled");
    expect(db.tables["provider_oauth_attempts"]).toHaveLength(0);
  });

  it("rejects a state mismatch — the attempt survives for retry", async () => {
    await pendingState();
    const result = await finishSiwc(
      supabase,
      "u-1",
      "http://127.0.0.1:1455/auth/callback?code=ok&state=WRONG"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("state mismatch");
    expect(db.tables["provider_oauth_attempts"]).toHaveLength(1);
  });

  it("first registration must return the issued client_id", async () => {
    const state = await pendingState();
    const result = await finishSiwc(
      supabase,
      "u-1",
      `http://127.0.0.1:1455/auth/callback?code=ok&state=${state}`
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("client id");
  });

  it("a mismatched issued client_id is rejected, never re-bound", async () => {
    db.tables["provider_oauth"] = [
      {
        user_id: "u-1",
        provider: "openai",
        client_id: "oaiapp_mine",
        host_id: "urn:uuid:h",
        bundle_sealed: "sealed",
      },
    ];
    const state = await pendingState();
    const result = await finishSiwc(
      supabase,
      "u-1",
      `http://127.0.0.1:1455/auth/callback?code=ok&state=${state}&client_id=oaiapp_other`
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("mismatch");
  });

  it("a callback on another redirect_uri is rejected before the token call", async () => {
    const state = await pendingState();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await finishSiwc(
      supabase,
      "u-1",
      `http://127.0.0.1:9999/auth/callback?code=ok&state=${state}&client_id=oaiapp_1`
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Callback URI");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("siwcStatus + disconnect", () => {
  it("reports disconnected with no row and surfaces a pending URL", async () => {
    const empty = await siwcStatus(supabase, "u-1");
    expect(empty.connected).toBe(false);
    expect(empty.pendingUrl).toBeNull();
    await seedPending();
    const pending = await siwcStatus(supabase, "u-1");
    expect(pending.connected).toBe(false);
    expect(pending.pendingUrl).toContain("auth.openai.com");
  });

  it("disconnect wipes the credential and the attempt", async () => {
    await seedPending();
    db.tables["provider_oauth"] = [
      {
        user_id: "u-1",
        provider: "openai",
        bundle_sealed: "sealed",
        account_label: "me@example.com",
        models_cache: ["gpt-5.4"],
      },
    ];
    const ok = await disconnectSiwc(supabase, "u-1");
    expect(ok).toBe(true);
    expect(db.tables["provider_oauth"]).toHaveLength(0);
    expect(db.tables["provider_oauth_attempts"]).toHaveLength(0);
  });
});

describe("siwcModelAllowed", () => {
  it("only allows models the account advertised", () => {
    expect(siwcModelAllowed(["gpt-5.4", "gpt-5.4-pro"], "gpt-5.4")).toBe(true);
    expect(siwcModelAllowed(["gpt-5.4"], "gpt-5.4-pro")).toBe(false);
    expect(siwcModelAllowed([], "gpt-5.4")).toBe(false);
  });
});
