import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  APP_TOKEN_TTL_SECONDS,
  appOriginConfigured,
  hashRuntimeToken,
  mintAppToken,
  mintRuntimeToken,
  verifyAppToken,
} from "./tokens";
import { anonPrincipal, appPrincipal, guestPrincipal } from "./identity";
import { appOriginUrl, appRoleFor, handoffUrl } from "./handoff";
import { makeApp } from "@/app/mini/loader-test-utils";
import { verifyToken } from "@/lib/miniapps/tokens";

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "mini-signing-key";
  process.env["APP_ORIGIN_SIGNING_KEY"] = "app-origin-signing-key";
  process.env["APPS_ORIGIN_SUFFIX"] = "apps.wzrd.tech";
});

afterEach(() => {
  process.env["APP_ORIGIN_SIGNING_KEY"] = "app-origin-signing-key";
});

const claims = {
  app: "alice-notes",
  principal: "p_0123456789abcdef0123456789abcdef",
  role: "owner" as const,
  resource: "default",
};

describe("app tokens (V11 §6.4)", () => {
  it("round-trips and binds to the app (script name)", () => {
    const token = mintAppToken(claims);
    expect(token).not.toBeNull();
    const verified = verifyAppToken(token!, "alice-notes");
    expect(verified).toMatchObject(claims);
    expect(verified?.jti).toHaveLength(16);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifyAppToken(token!, "alice-other")).toBeNull();
  });

  it("is signed under APP_ORIGIN_SIGNING_KEY, never MINIAPP_SIGNING_KEY", () => {
    const token = mintAppToken(claims)!;
    // Not a mini-origin token: the mini verifier rejects it outright.
    expect(verifyToken(token, "alice-notes")).toBeNull();
    process.env["APP_ORIGIN_SIGNING_KEY"] = "rotated";
    expect(verifyAppToken(token, "alice-notes")).toBeNull();
  });

  it("expires after 60 seconds and rejects skewed future tokens", () => {
    const token = mintAppToken(claims)!;
    const now = Math.floor(Date.now() / 1000);
    expect(verifyAppToken(token, "alice-notes", now + APP_TOKEN_TTL_SECONDS + 1)).toBeNull();
    expect(verifyAppToken(token, "alice-notes", now - 5)).toBeNull(); // exp - now > TTL
    expect(verifyAppToken(token, "alice-notes", now)).not.toBeNull();
  });

  it("rejects tampered claims, garbage, and unknown roles", () => {
    const token = mintAppToken(claims)!;
    const [payload, mac] = token.split(".");
    const parsed = JSON.parse(Buffer.from(payload!, "base64url").toString()) as {
      role: string;
    };
    parsed.role = "agent";
    const forged = `${Buffer.from(JSON.stringify(parsed)).toString("base64url")}.${mac}`;
    expect(verifyAppToken(forged, "alice-notes")).toBeNull();
    expect(verifyAppToken("", "alice-notes")).toBeNull();
    expect(verifyAppToken("nodot", "alice-notes")).toBeNull();
    expect(verifyAppToken(`${payload}.`, "alice-notes")).toBeNull();
  });

  it("carries the draft marker only when asked", () => {
    const live = verifyAppToken(mintAppToken(claims)!, "alice-notes");
    expect(live?.draft).toBeUndefined();
    const draft = verifyAppToken(
      mintAppToken({ ...claims, draft: true })!,
      "alice-notes"
    );
    expect(draft?.draft).toBe(true);
  });

  it("returns null (legacy lane) when the key is unset", () => {
    delete process.env["APP_ORIGIN_SIGNING_KEY"];
    expect(appOriginConfigured()).toBe(false);
    expect(mintAppToken(claims)).toBeNull();
  });

  it("refuses to mint without a principal or resource", () => {
    expect(mintAppToken({ ...claims, principal: "" })).toBeNull();
    expect(mintAppToken({ ...claims, resource: "" })).toBeNull();
  });
});

describe("pseudonymous identity (CR9)", () => {
  it("is stable per (user, app) and differs across apps", () => {
    const a = appPrincipal("user-1", "app-1");
    expect(a).toBe(appPrincipal("user-1", "app-1"));
    expect(a).not.toBe(appPrincipal("user-1", "app-2"));
    expect(a).not.toBe(appPrincipal("user-2", "app-1"));
    expect(a).toMatch(/^p_[0-9a-f]{32}$/);
    expect(a).not.toContain("user-1");
  });

  it("anonymous principals rotate daily and never carry the address", () => {
    const today = anonPrincipal("203.0.113.9", "app-1", "2026-09-04");
    expect(today).toMatch(/^anon:[0-9a-f]{16}$/);
    expect(today).not.toContain("203.0.113.9");
    expect(today).not.toBe(anonPrincipal("203.0.113.9", "app-1", "2026-09-05"));
  });

  it("anonymous principals are keyed, so an address cannot be confirmed offline", () => {
    const withKey = anonPrincipal("203.0.113.9", "app-1", "2026-09-04");
    process.env["APP_ORIGIN_SIGNING_KEY"] = "rotated";
    expect(anonPrincipal("203.0.113.9", "app-1", "2026-09-04")).not.toBe(withKey);
  });

  it("guest principals derive from the grant, not the granting owner", () => {
    const g = guestPrincipal("grant-1", "app-1");
    expect(g).toMatch(/^g_[0-9a-f]{32}$/);
    expect(g).toBe(guestPrincipal("grant-1", "app-1"));
    expect(g).not.toBe(guestPrincipal("grant-2", "app-1"));
    expect(g).not.toBe(guestPrincipal("grant-1", "app-2"));
  });
});

describe("runtime tokens (CR6)", () => {
  it("stores only a sha256 hash", () => {
    const { secret, hash } = mintRuntimeToken();
    expect(secret).toMatch(/^art_[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRuntimeToken(secret)).toBe(hash);
    expect(hash).not.toContain(secret.slice(4, 20));
  });
});

describe("mini → app-origin hand-off", () => {
  const app = makeApp({
    id: "app-notes",
    slug: "alice-notes",
    owner_user_id: "user-alice",
    publisher_username: "alice",
  });

  it("targets the isolated per-app origin with a one-minute token", () => {
    const url = handoffUrl(app, {
      userId: "user-alice",
      resourceId: "default",
      role: "owner",
    });
    expect(url).not.toBeNull();
    expect(url!.host).toBe("alice-notes.apps.wzrd.tech");
    expect(url!.pathname).toBe("/__air/enter");
    const token = url!.searchParams.get("t")!;
    const verified = verifyAppToken(token, "alice-notes");
    expect(verified?.role).toBe("owner");
    expect(verified?.principal).toBe(appPrincipal("user-alice", "app-notes"));
    expect(url!.toString()).not.toContain("user-alice");
    expect(appOriginUrl("alice-notes").origin).toBe(
      "https://alice-notes.apps.wzrd.tech"
    );
  });

  it("maps guest sessions to the guest role", () => {
    expect(appRoleFor({ userId: "u", resourceId: "r", role: "guest" })).toBe("guest");
    expect(appRoleFor({ userId: "u", resourceId: "r", role: "owner" })).toBe("owner");
  });

  it("a guest never inherits the owner's principal", () => {
    // Guest cookies carry the granting owner's user id (grant.created_by).
    const owner = handoffUrl(app, {
      userId: "user-alice",
      resourceId: "default",
      role: "owner",
    });
    const guest = handoffUrl(app, {
      userId: "user-alice",
      resourceId: "default",
      role: "guest",
      grantId: "grant-77",
    });
    const ownerClaims = verifyAppToken(owner!.searchParams.get("t")!, "alice-notes");
    const guestClaims = verifyAppToken(guest!.searchParams.get("t")!, "alice-notes");
    expect(guestClaims?.role).toBe("guest");
    expect(guestClaims?.principal).toBe(guestPrincipal("grant-77", "app-notes"));
    expect(guestClaims?.principal).not.toBe(ownerClaims?.principal);
    // A guest session with no grant to bind to gets no token at all.
    expect(
      handoffUrl(app, { userId: "user-alice", resourceId: "default", role: "guest" })
    ).toBeNull();
  });

  it("is null when the app-origin lane is unconfigured", () => {
    delete process.env["APP_ORIGIN_SIGNING_KEY"];
    expect(
      handoffUrl(app, { userId: "user-alice", resourceId: "default", role: "owner" })
    ).toBeNull();
  });
});
