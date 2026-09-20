import {
  AuthorizationError,
  OAuthProvider,
  type AuthRequest,
  type OAuthHelpers
} from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { WorkerEntrypoint } from "cloudflare:workers";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

/**
 * MM0 is purposefully not an Air identity. It exists only to measure Muse's
 * OAuth/MCP client behaviour without authorizing any Air capability.
 */
const MM0_IDENTITY = {
  handle_display: "MM0 probe",
  link: "stub",
  box: "none",
  stage: "mm0"
} as const;

const csrfCookieName = "__Host-air_muse_mm0_csrf";

type AuthProps = {
  subject: "mm0-probe";
};

type MuseEnv = Env & {
  OAUTH_PROVIDER: OAuthHelpers;
};

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function document(body: string, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "text/html; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set(
    "content-security-policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  responseHeaders.set("referrer-policy", "no-referrer");
  responseHeaders.set("x-content-type-options", "nosniff");
  return new Response(body, { status, headers: responseHeaders });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'\"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character] ?? character;
  });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const entry of header.split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

async function csrfMatches(actual: string | undefined, expected: string | undefined): Promise<boolean> {
  if (!actual || !expected || actual.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const actualBytes = new Uint8Array(actualDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let different = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    different |= actualBytes[index] ^ expectedBytes[index];
  }
  return different === 0;
}

function authorizationErrorResponse(error: AuthorizationError): Response {
  if (!error.redirectUri) {
    return document(`<h1>Authorization request rejected</h1><p>${escapeHtml(error.description)}</p>`, 400);
  }
  const redirect = new URL(error.redirectUri);
  redirect.searchParams.set("error", error.code);
  redirect.searchParams.set("error_description", error.description);
  if (error.state) redirect.searchParams.set("state", error.state);
  if (error.issuer) redirect.searchParams.set("iss", error.issuer);
  return Response.redirect(redirect.toString(), 302);
}

async function parseAuthorization(request: Request, env: MuseEnv): Promise<AuthRequest | Response> {
  try {
    return await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    throw error;
  }
}

function deniedAuthorization(request: AuthRequest): Response {
  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("error", "access_denied");
  redirect.searchParams.set("error_description", "The MM0 probe was not approved.");
  if (request.state) redirect.searchParams.set("state", request.state);
  if (request.issuer) redirect.searchParams.set("iss", request.issuer);
  return Response.redirect(redirect.toString(), 302);
}

function authorizePage(request: Request, clientName: string, csrf: string): Response {
  const action = escapeHtml(new URL(request.url).toString());
  return document(`<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Air MM0 probe</title>
<style>body{font:16px system-ui,sans-serif;max-width:42rem;margin:5rem auto;padding:0 1rem;color:#171717}button{font:inherit;padding:.65rem 1rem;margin-right:.5rem}.note{color:#555}</style>
<main><h1>Air connector protocol probe</h1>
<p><strong>${escapeHtml(clientName)}</strong> is requesting a token for the data-free <code>air.whoami</code> MM0 probe.</p>
<p class="note">This test account has no Air identity, line, Box, inbox, calendar, wallet, or decision authority. Approving only lets the client call a fixed response.</p>
<form method="post" action="${action}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
<button name="approve" value="yes" type="submit">Approve MM0 probe</button><button name="approve" value="no" type="submit">Cancel</button></form>
</main></html>` , 200, {
    "set-cookie": `${csrfCookieName}=${csrf}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  });
}

async function authorize(request: Request, env: MuseEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  }

  const parsed = await parseAuthorization(request, env);
  if (parsed instanceof Response) return parsed;

  if (request.method === "GET") {
    const client = await env.OAUTH_PROVIDER.lookupClient(parsed.clientId);
    if (!client) return document("<h1>Unknown OAuth client</h1>", 400);
    return authorizePage(request, client.clientName ?? "An OAuth client", randomToken());
  }

  const form = await request.formData();
  const approved = form.get("approve") === "yes";
  const formCsrf = form.get("csrf");
  const cookieCsrf = cookie(request, csrfCookieName);
  if (typeof formCsrf !== "string" || !(await csrfMatches(formCsrf, cookieCsrf))) {
    return document("<h1>Expired or invalid approval</h1><p>Please return to the connector and try again.</p>", 403);
  }
  if (!approved) return deniedAuthorization(parsed);

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: parsed,
    userId: "mm0-probe",
    // OAuth grant metadata is storage-visible: do not place identity data here.
    metadata: { stage: "mm0" },
    scope: parsed.scope.filter((scope) => scope === "air.whoami"),
    props: { subject: "mm0-probe" satisfies AuthProps["subject"] }
  });
  return Response.redirect(redirectTo, 302);
}

function createAirServer(): McpServer {
  const server = new McpServer({ name: "air-muse-mm0", version: "0.1.0" });
  server.registerTool(
    "air.whoami",
    {
      title: "Air MM0 probe",
      description: "Returns a fixed MM0 identity. It never reads Air user data.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        handle_display: z.literal("MM0 probe"),
        link: z.literal("stub"),
        box: z.literal("none"),
        stage: z.literal("mm0")
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(MM0_IDENTITY) }],
      structuredContent: MM0_IDENTITY
    })
  );
  return server;
}

const mcpHandler = createMcpHandler(createAirServer, {
  route: "/mcp",
  // The product contract is stateless JSON over POST. Do not silently
  // downgrade a connector to the retired 2025 transport, which uses SSE.
  legacy: "reject",
  responseMode: "json",
  corsOptions: false,
  allowedHostnames: ["muse.wzrd.tech"],
  allowedOriginHostnames: ["muse.ai", "www.muse.ai", "platform.muse.ai"]
});

class McpApiHandler extends WorkerEntrypoint<MuseEnv, AuthProps> {
  fetch(request: Request): Promise<Response> {
    return mcpHandler(request, this.env, this.ctx);
  }
}

const defaultHandler: ExportedHandler<MuseEnv> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/authorize") return authorize(request, env);
    if (url.pathname === "/__air/health" && request.method === "GET") {
      return json({ ok: true, stage: "mm0", service: "air-muse" });
    }
    if (url.pathname === "/muse.md" && request.method === "GET") {
      return new Response(
        "# Air × Muse MM0\n\nThis endpoint is a data-free OAuth and MCP protocol probe. It only exposes `air.whoami`, which returns a fixed stub identity.\n",
        { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } }
      );
    }
    if (url.pathname === "/" && request.method === "GET") {
      return document("<h1>Air × Muse MM0</h1><p>OAuth/MCP protocol probe only. <a href=\"/muse.md\">Read the probe contract.</a></p>");
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    }
    return document("<h1>Not found</h1>", 404);
  }
};

export default new OAuthProvider<MuseEnv>({
  apiRoute: "/mcp",
  apiHandler: McpApiHandler,
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  // MM0 needs the ordinary OAuth 2.1 code + refresh flow in order to observe
  // what Muse actually sends. Plain PKCE and implicit grants remain disabled.
  accessTokenTTL: 3600,
  refreshTokenTTL: 2_592_000,
  clientRegistrationTTL: 7_776_000,
  scopesSupported: ["air.whoami"],
  clientIdMetadataDocumentEnabled: true,
  resourceMetadata: {
    resource: "https://muse.wzrd.tech/mcp",
    authorization_servers: ["https://muse.wzrd.tech"],
    scopes_supported: ["air.whoami"],
    resource_name: "Air × Muse MM0 protocol probe"
  }
});
