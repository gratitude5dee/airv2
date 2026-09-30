/**
 * Claude subscription sign-in: the box-local contract. Status reads the
 * provider_oauth marker row (never a credential — the official claude CLI
 * owns it under ~/.claude) and the pinned catalog keeps a stable picker
 * independent of CLI version. Box calls are mocked; the relay's pty/fifo
 * mechanics are exercised on the box itself.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { sealSecret } from "@/lib/crypto/secretbox";

vi.mock("@/lib/orchestrator/boxes", () => ({
  loadTarget: vi.fn(async () => null),
  runCommand: vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "" })),
  restartServices: vi.fn(async () => ({ ok: true })),
}));

import {
  CLAUDE_MODELS,
  CLAUDE_PROVIDER_ID,
  claudeStatus,
} from "./claude";

const VAULT_KEY = "c".repeat(64);
const db = new FakeSupabase();
const supabase = db.client();

beforeEach(() => {
  vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
  db.reset();
});

describe("catalog", () => {
  it("pins the DirectSDK provider id the box plugin registers under", () => {
    expect(CLAUDE_PROVIDER_ID).toBe("claude-subscription-directsdk-experimental");
  });

  it("keeps the six-entry picker — sonnet, opus, haiku plus the pinned opus/fable ids", () => {
    expect(CLAUDE_MODELS).toHaveLength(6);
    const ids = CLAUDE_MODELS.map((model) => model.id);
    expect(ids).toContain("sonnet");
    expect(ids).toContain("opus");
    expect(ids).toContain("haiku");
    for (const entry of CLAUDE_MODELS) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

describe("claudeStatus", () => {
  it("is disconnected with no rows", async () => {
    const status = await claudeStatus(supabase, "u-1");
    expect(status.connected).toBe(false);
    expect(status.accountLabel).toBeNull();
    expect(status.pendingUrl).toBeNull();
  });

  it("reads the connected row's label and catalog models", async () => {
    db.tables["provider_oauth"] = [
      {
        user_id: "u-1",
        provider: "anthropic",
        account_label: "me@anthropic.example",
        models_cache: CLAUDE_MODELS.map((model) => model.id),
        bundle_sealed: null,
      },
    ];
    const status = await claudeStatus(supabase, "u-1");
    expect(status.connected).toBe(true);
    expect(status.accountLabel).toBe("me@anthropic.example");
    expect(status.models).toContain("sonnet");
  });

  it("unseals a pending login URL for the card link", async () => {
    db.tables["provider_oauth_attempts"] = [
      {
        user_id: "u-1",
        provider: "anthropic",
        state: "claude",
        attempt_sealed: sealSecret(
          JSON.stringify({ url: "https://claude.ai/oauth/authorize?code_challenge=x" }),
          VAULT_KEY
        ),
        created_at: new Date().toISOString(),
      },
    ];
    const status = await claudeStatus(supabase, "u-1");
    expect(status.pendingUrl).toContain("claude.ai");
  });
});
