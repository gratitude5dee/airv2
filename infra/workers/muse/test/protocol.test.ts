import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const endpoint = "https://muse.wzrd.tech";

function form(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("Air × Muse MM0 protocol probe", () => {
  it("serves only the explicit data-free health and contract endpoints", async () => {
    const health = await SELF.fetch(`${endpoint}/__air/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ ok: true, stage: "mm0" });
    expect(health.headers.get("cache-control")).toBe("no-store");

    const contract = await SELF.fetch(`${endpoint}/muse.md`);
    expect(contract.status).toBe(200);
    await expect(contract.text()).resolves.toContain("data-free OAuth and MCP protocol probe");
  });

  it("publishes OAuth metadata and challenges an unauthenticated MCP request", async () => {
    const asMetadata = await SELF.fetch(`${endpoint}/.well-known/oauth-authorization-server`);
    expect(asMetadata.status).toBe(200);
    await expect(asMetadata.json()).resolves.toMatchObject({
      issuer: "https://muse.wzrd.tech",
      authorization_endpoint: "https://muse.wzrd.tech/authorize",
      token_endpoint: "https://muse.wzrd.tech/token",
      registration_endpoint: "https://muse.wzrd.tech/register",
      code_challenge_methods_supported: ["S256"]
    });

    const protectedResource = await SELF.fetch(
      `${endpoint}/.well-known/oauth-protected-resource/mcp`
    );
    expect(protectedResource.status).toBe(200);
    await expect(protectedResource.json()).resolves.toMatchObject({
      resource: "https://muse.wzrd.tech/mcp",
      authorization_servers: ["https://muse.wzrd.tech"]
    });

    const mcp = await SELF.fetch(`${endpoint}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    expect(mcp.status).toBe(401);
    expect(mcp.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("does not automatically approve authorization", async () => {
    const response = await SELF.fetch(`${endpoint}/authorize`);
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Authorization request rejected");
  });

  it("uses DCR, S256 PKCE, explicit consent, and a bearer token for the fixed tool", async () => {
    const registration = await SELF.fetch(`${endpoint}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "MM0 local conformance client",
        redirect_uris: ["https://client.example.test/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none"
      })
    });
    expect(registration.status).toBe(201);
    const client = (await registration.json()) as { client_id: string };
    expect(client.client_id).toEqual(expect.any(String));

    const verifier = "mm0-local-test-verifier-that-is-long-enough-for-s256-pkce-0123456789";
    const authorizeQuery = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "https://client.example.test/callback",
      scope: "air.whoami",
      state: "test-state",
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: "S256",
      resource: `${endpoint}/mcp`
    });
    const authorize = await SELF.fetch(`${endpoint}/authorize?${authorizeQuery}`, { redirect: "manual" });
    expect(authorize.status).toBe(200);
    const authorizeHtml = await authorize.text();
    const csrf = /name="csrf" value="([^"]+)"/.exec(authorizeHtml)?.[1];
    const csrfCookie = /__Host-air_muse_mm0_csrf=([^;]+)/.exec(authorize.headers.get("set-cookie") ?? "")?.[1];
    expect(csrf).toEqual(expect.any(String));
    expect(csrfCookie).toEqual(expect.any(String));

    const consent = await SELF.fetch(`${endpoint}/authorize?${authorizeQuery}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-air_muse_mm0_csrf=${csrfCookie}`
      },
      body: form({ csrf: csrf!, approve: "yes" })
    });
    expect(consent.status).toBe(302);
    const callback = new URL(consent.headers.get("location")!);
    expect(callback.origin).toBe("https://client.example.test");
    expect(callback.searchParams.get("state")).toBe("test-state");
    expect(callback.searchParams.get("iss")).toBe(endpoint);
    const code = callback.searchParams.get("code");
    expect(code).toEqual(expect.any(String));

    const tokenResponse = await SELF.fetch(`${endpoint}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "https://client.example.test/callback",
        client_id: client.client_id,
        code_verifier: verifier,
        resource: `${endpoint}/mcp`
      })
    });
    expect(tokenResponse.status).toBe(200);
    const token = (await tokenResponse.json()) as { access_token: string; refresh_token: string };
    expect(token.access_token).toEqual(expect.any(String));
    expect(token.refresh_token).toEqual(expect.any(String));

    const call = await SELF.fetch(`${endpoint}/mcp`, {
      method: "POST",
      headers: {
        host: "muse.wzrd.tech",
        authorization: `Bearer ${token.access_token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": "air.whoami"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "whoami",
        method: "tools/call",
        params: {
          name: "air.whoami",
          arguments: {},
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": {}
          }
        }
      })
    });
    const callBody = await call.text();
    expect(call.status, callBody).toBe(200);
    expect(JSON.parse(callBody)).toMatchObject({
      jsonrpc: "2.0",
      id: "whoami",
      result: {
        structuredContent: {
          handle_display: "MM0 probe",
          link: "stub",
          box: "none",
          stage: "mm0"
        }
      }
    });

    const legacy = await SELF.fetch(`${endpoint}/mcp`, {
      method: "POST",
      headers: {
        host: "muse.wzrd.tech",
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-06-18"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "legacy", method: "tools/list", params: {} })
    });
    expect(legacy.status).toBe(400);
    expect(legacy.headers.get("content-type")).toContain("application/json");
    await expect(legacy.json()).resolves.toMatchObject({ error: { code: -32_022 } });
  });
});
