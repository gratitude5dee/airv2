/**
 * GitHub App client: the App JWT GitHub accepts, webhook HMAC as an
 * all-or-nothing gate, and the install-round-trip state that binds an
 * arriving installation to the session that started it.
 */
import { createHmac, createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appJwt,
  assertFullName,
  githubAppConfigured,
  installUrl,
  signSetupState,
  verifySetupState,
  verifyWebhookSignature,
} from "./app";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

beforeEach(() => {
  process.env["GITHUB_APP_ID"] = "4242";
  process.env["GITHUB_APP_SLUG"] = "wzrd-create";
  process.env["GITHUB_APP_PRIVATE_KEY"] = PEM.replace(/\n/g, "\\n");
  process.env["GITHUB_APP_WEBHOOK_SECRET"] = "whsec-test";
  process.env["SESSION_SECRET"] = "test-session-secret";
  delete process.env["GITHUB_STATE_SIGNING_KEY"];
});

afterEach(() => {
  for (const key of [
    "GITHUB_APP_ID",
    "GITHUB_APP_SLUG",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_WEBHOOK_SECRET",
  ]) {
    delete process.env[key];
  }
});

function decode(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("githubAppConfigured", () => {
  it("needs all four values", () => {
    expect(githubAppConfigured()).toBe(true);
    delete process.env["GITHUB_APP_WEBHOOK_SECRET"];
    expect(githubAppConfigured()).toBe(false);
  });
});

describe("appJwt", () => {
  it("is an RS256 JWT for the App id, issued 60s back, under 10 minutes long", () => {
    const now = 1_800_000_000_000;
    const token = appJwt(now);
    const [h, p, s] = token.split(".") as [string, string, string];
    expect(decode(h)).toEqual({ alg: "RS256", typ: "JWT" });
    const payload = decode(p);
    expect(payload["iss"]).toBe("4242");
    expect(payload["iat"]).toBe(now / 1000 - 60);
    expect((payload["exp"] as number) - (payload["iat"] as number)).toBeLessThanOrEqual(600);
    const ok = createVerify("RSA-SHA256")
      .update(`${h}.${p}`)
      .verify(publicKey, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  it("restores the escaped newlines a one-line env value carries", () => {
    expect(process.env["GITHUB_APP_PRIVATE_KEY"]).not.toContain("\n");
    expect(() => appJwt()).not.toThrow();
  });

  it("503s when the App is not configured", () => {
    delete process.env["GITHUB_APP_ID"];
    expect(() => appJwt()).toThrow(/not configured/);
  });
});

describe("installUrl", () => {
  it("points at the App's install screen with the state", () => {
    expect(installUrl("a.b")).toBe(
      "https://github.com/apps/wzrd-create/installations/new?state=a.b"
    );
  });
});

describe("verifyWebhookSignature", () => {
  const body = Buffer.from('{"action":"created"}');
  const good = `sha256=${createHmac("sha256", "whsec-test").update(body).digest("hex")}`;

  it("accepts the HMAC of the raw body", () => {
    expect(verifyWebhookSignature(body, good)).toBe(true);
  });

  it.each([
    ["missing", null],
    ["wrong prefix", good.replace("sha256=", "sha1=")],
    ["truncated", good.slice(0, -2)],
    ["different key", `sha256=${createHmac("sha256", "other").update(body).digest("hex")}`],
    ["not hex", "sha256=zz"],
  ])("rejects a %s header", (_label, header) => {
    expect(verifyWebhookSignature(body, header)).toBe(false);
  });

  it("rejects a valid signature over a different body", () => {
    expect(verifyWebhookSignature(Buffer.from("{}"), good)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    delete process.env["GITHUB_APP_WEBHOOK_SECRET"];
    expect(verifyWebhookSignature(body, good)).toBe(false);
  });
});

describe("setup state", () => {
  it("round-trips the user within 15 minutes", () => {
    const now = 1_800_000_000_000;
    const state = signSetupState("user-alice", now);
    expect(verifySetupState(state, now + 14 * 60_000)).toBe("user-alice");
  });

  it("expires after 15 minutes", () => {
    const now = 1_800_000_000_000;
    const state = signSetupState("user-alice", now);
    expect(verifySetupState(state, now + 15 * 60_000 + 1)).toBeNull();
  });

  it("rejects a tampered payload and a tampered mac", () => {
    const state = signSetupState("user-alice");
    const [payload, mac] = state.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ u: "user-mallory", e: Date.now() + 60_000 })).toString(
      "base64url"
    );
    expect(verifySetupState(`${forged}.${mac}`)).toBeNull();
    expect(verifySetupState(`${payload}.${mac.slice(1)}x`)).toBeNull();
    expect(verifySetupState(payload)).toBeNull();
    expect(verifySetupState(null)).toBeNull();
    expect(verifySetupState("")).toBeNull();
  });

  it("prefers GITHUB_STATE_SIGNING_KEY over SESSION_SECRET", () => {
    const state = signSetupState("user-alice");
    process.env["GITHUB_STATE_SIGNING_KEY"] = "rotated";
    expect(verifySetupState(state)).toBeNull();
    expect(verifySetupState(signSetupState("user-alice"))).toBe("user-alice");
    delete process.env["GITHUB_STATE_SIGNING_KEY"];
  });
});

describe("assertFullName", () => {
  it.each(["alice/site", "WZRD-Tech-Inc/create.push", "a_b/c-d"])("accepts %s", (name) => {
    expect(assertFullName(name)).toBe(name);
  });

  it.each(["alice", "alice/site/extra", "../x", "alice/../etc", "alice/site?x=1", ""])(
    "rejects %s",
    (name) => {
      expect(() => assertFullName(name)).toThrow();
    }
  );
});
