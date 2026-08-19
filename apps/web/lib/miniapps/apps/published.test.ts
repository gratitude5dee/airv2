import { describe, expect, it } from "vitest";
import type { RegistryApp } from "../registry";
import { publishedModule, publisherCsp } from "./published";

const row = (overrides: Partial<RegistryApp>): RegistryApp =>
  ({
    id: "a1",
    slug: "alice-todo",
    kind: "render",
    owner_user_id: null,
    name: "Todo",
    description: "",
    icon_key: null,
    publisher_username: null,
    publisher_wallet: null,
    agent_identity: null,
    visibility: "unlisted",
    access: "single",
    password_hash: null,
    x402_enabled: false,
    x402_price_usdc: null,
    plugin_signin_enabled: false,
    status: "draft",
    bundle_version: null,
    listed_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as RegistryApp;

describe("publisherCsp", () => {
  it("locks the bundle down and pins frame ancestry", () => {
    const csp = publisherCsp();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toMatch(/frame-ancestors 'self' https:\/\//);
    // No wildcard sources anywhere.
    expect(csp).not.toContain("*");
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("publishedModule dispatch", () => {
  it("never matches first-party rows (owner_user_id null)", () => {
    expect(publishedModule(row({ bundle_version: "v1" }))).toBeNull();
  });
  it("never matches publisher rows without an uploaded bundle", () => {
    expect(publishedModule(row({ owner_user_id: "u1" }))).toBeNull();
  });
  it("matches only owner_user_id + bundle_version rows", () => {
    expect(
      publishedModule(row({ owner_user_id: "u1", bundle_version: "v1" }))
    ).not.toBeNull();
  });
});
