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
import {
  FULL_SCOPES,
  MuseUser,
  allowMuseRequest,
  fullEnabled,
  fullMcpHandler,
  fullRestHandler,
  fullScopes,
  isAllowedRedirect,
  openApi,
  type FullProps,
  type RestPrincipal,
} from "./full";

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
const fullCsrfCookieName = "__Host-air_muse_csrf";
const fullLoginCookieName = "__Host-air_muse_login";

type AuthProps = { subject: "mm0-probe" } | FullProps;

type MuseEnv = Env & {
  OAUTH_PROVIDER: OAuthHelpers;
  // Worker secrets are intentionally absent from wrangler's generated vars
  // declaration. They are supplied only at runtime through `wrangler secret`.
  MUSE_WORKER_TOKEN?: string;
  MUSE_INTERNAL_TOKEN?: string;
  /** Server-to-server only: redeems WZRDMail's Thirdweb identity handoff. */
  WZRDMAIL_CONNECTOR_TOKEN?: string;
  WZRDMAIL_API_ORIGIN?: string;
  WZRDMAIL_CONSOLE_ORIGIN?: string;
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
    props: { subject: "mm0-probe" }
  });
  return Response.redirect(redirectTo, 302);
}

interface LoginState {
  userId?: string;
  subject?: string;
  expiresAt: number;
}

interface WzrdmailFlowState {
  /** Original, validated OAuth request; never supplied back by the browser. */
  authorizationUrl: string;
  expiresAt: number;
}

function fullScopeCopy(scope: string): string {
  const copy: Record<string, string> = {
    profile: "See that this Air is yours and whether it is awake.",
    "updates:write": "Text you updates on your Air line within limits you set.",
    control: "Receive the instructions you text with /muse and reply to them.",
    "agent:run": "Ask your Air agent to work; sends, payments and bookings still ask you first.",
    "mail:read": "Read your Air inbox.",
    "mail:draft": "Write email drafts without sending them.",
    "files:read": "See files in your Air inbox folder.",
    "files:write": "Drop files into your Air inbox folder.",
    "calendar:write": "Propose calendar changes for your approval.",
    "schedule:write": "Propose recurring Air tasks for your approval.",
    "wallet:read": "See wallet balances.",
    "wallet:request": "Ask to send from your wallet; only you can approve it."
  };
  return copy[scope] ?? scope;
}

function fullPage(title: string, body: string, csrf?: string, login?: string): Response {
  const response = document(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font:16px system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem;color:#171717}input,button{font:inherit;padding:.65rem;margin:.35rem 0}input[type=tel],input[type=text]{width:min(100%,28rem)}button{margin-right:.5rem}.note{color:#555;line-height:1.5}.scope{display:block;padding:.65rem 0;border-top:1px solid #ddd}.scope small{display:block;color:#555;margin:.2rem 0 0 1.7rem}</style>
<main>${body}</main></html>`);
  // Set-Cookie is deliberately appended once per cookie. Combining values in
  // a comma-separated header is not a valid multi-cookie response and loses
  // the opaque OTP login state in several user agents.
  if (csrf) response.headers.append("set-cookie", `${fullCsrfCookieName}=${csrf}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  if (login) response.headers.append("set-cookie", `${fullLoginCookieName}=${login}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  return response;
}

function fullPhonePage(request: AuthRequest, action: string, clientName: string, csrf: string, error?: string, login?: string): Response {
  return fullPage("Sign in to Air", `<h1>Sign in to Air</h1><p><strong>${escapeHtml(clientName)}</strong> wants to connect to your Air.</p>
<p class="note">Your WZRDMail account is signed in with Thirdweb. Verify the US mobile number you will use to text your Air line. New accounts receive their own iMessage line, WZRDMail, and a computer after verification.</p>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post" action="${escapeHtml(action)}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="stage" value="phone"><label>Mobile number<br><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label><br><button type="submit">Send code</button></form>`, csrf, login);
}

function fullCodePage(request: AuthRequest, action: string, phone: string, csrf: string, error?: string): Response {
  return fullPage("Verify your phone", `<h1>Verify your phone</h1><p>We sent a six-digit code to <strong>${escapeHtml(phone)}</strong>.</p>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post" action="${escapeHtml(action)}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="stage" value="code"><input type="hidden" name="phone" value="${escapeHtml(phone)}"><label>Code<br><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><br><button type="submit">Verify</button></form>`, csrf);
}

function fullConsentPage(request: AuthRequest, action: string, clientName: string, scopes: string[], csrf: string, login: string, inviteUrl?: string): Response {
  const checks = scopes.map((scope) => `<label class="scope"><input type="checkbox" name="scope" value="${escapeHtml(scope)}"${scope === "profile" ? " checked disabled" : " checked"}><strong> ${escapeHtml(scope)}</strong><small>${escapeHtml(fullScopeCopy(scope))}</small></label>`).join("");
  return fullPage("Connect Air to Muse", `<h1>Connect Air to Muse</h1><p><strong>${escapeHtml(clientName)}</strong> will connect to one Air account.</p>
${inviteUrl ? `<p class="note">Your Air iMessage line is ready: <a href="${escapeHtml(inviteUrl)}">open Messages</a>. You can also sign back into Air later with this same phone number.</p>` : ""}
<form method="post" action="${escapeHtml(action)}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="stage" value="consent">${checks}<p class="note">Muse does the thinking on your Muse plan. Air does the doing on your Air. Nothing gives Muse your Air passwords, and nothing sends, pays, books or schedules without your tap.</p><button name="approve" value="yes" type="submit">Connect Air</button><button name="approve" value="no" type="submit">Cancel</button></form>`, csrf, login);
}

async function controlPlane<T>(env: MuseEnv, path: string, body: unknown): Promise<{ status: number; value: T & { error?: string } }> {
  const origin = (env.CONTROL_PLANE_ORIGIN ?? "https://app.wzrd.tech").replace(/\/+$/, "");
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.MUSE_WORKER_TOKEN ?? ""}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, value: await response.json().catch(() => ({})) as T & { error?: string } };
}

async function wzrdmail<T>(env: MuseEnv, path: string, body: unknown): Promise<{ status: number; value: T & { error?: string } }> {
  const origin = (env.WZRDMAIL_API_ORIGIN ?? "https://api.wzrd.tech").replace(/\/+$/, "");
  const response = await fetch(`${origin}/v0/console/muse/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WZRDMAIL_CONNECTOR_TOKEN ?? ""}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, value: await response.json().catch(() => ({})) as T & { error?: string } };
}

function wzrdmailConsoleUrl(env: MuseEnv, flow: string): string {
  const origin = (env.WZRDMAIL_CONSOLE_ORIGIN ?? "https://console.mail.wzrd.tech").replace(/\/+$/, "");
  const callback = new URL("https://muse.wzrd.tech/authorize");
  callback.searchParams.set("wzrdmail_flow", flow);
  const destination = new URL(`${origin}/connect/muse`);
  destination.searchParams.set("return_to", callback.toString());
  return destination.toString();
}

async function resumeWzrdmailAuthorization(
  request: Request,
  env: MuseEnv,
  flow: string,
  code: string,
): Promise<{ parsed: AuthRequest; action: string; clientName: string; subject: string } | Response> {
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(flow) || !/^wmc_[a-f0-9]{64}$/.test(code)) {
    return document("<h1>Expired connection</h1><p>Return to Muse and start the connection again.</p>", 400);
  }
  const raw = await env.OAUTH_KV.get(`muse:wzrdmail-flow:${flow}`);
  const state = raw ? JSON.parse(raw) as WzrdmailFlowState : null;
  if (!state || state.expiresAt < Date.now()) {
    return document("<h1>Expired connection</h1><p>Return to Muse and start the connection again.</p>", 400);
  }
  const parsed = await parseAuthorization(new Request(state.authorizationUrl), env);
  if (parsed instanceof Response || !isAllowedRedirect(parsed.redirectUri)) {
    return parsed instanceof Response ? parsed : document("<h1>Authorization request rejected</h1>", 400);
  }
  const client = await env.OAUTH_PROVIDER.lookupClient(parsed.clientId);
  if (!client) return document("<h1>Unknown OAuth client</h1>", 400);
  const redemption = await wzrdmail<{ subject?: string }>(env, "redeem", { code });
  if (redemption.status !== 200 || !redemption.value.subject) {
    return document("<h1>Could not verify WZRDMail</h1><p>Return to Muse and try connecting again.</p>", 401);
  }
  await env.OAUTH_KV.delete(`muse:wzrdmail-flow:${flow}`);
  return {
    parsed,
    action: state.authorizationUrl,
    clientName: client.clientName ?? "Muse",
    subject: redemption.value.subject,
  };
}

async function fullAuthorize(request: Request, env: MuseEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  const currentUrl = new URL(request.url);
  let parsed: AuthRequest;
  let action: string;
  let clientName: string;
  let subject: string | undefined;
  if (request.method === "GET" && currentUrl.searchParams.has("wzrdmail_flow")) {
    const flow = currentUrl.searchParams.get("wzrdmail_flow") ?? "";
    const code = currentUrl.searchParams.get("wzrdmail_code") ?? "";
    const resumed = await resumeWzrdmailAuthorization(request, env, flow, code);
    if (resumed instanceof Response) return resumed;
    ({ parsed, action, clientName, subject } = resumed);
    const identityLogin = randomToken();
    await env.OAUTH_KV.put(
      `muse:login:${identityLogin}`,
      JSON.stringify({ subject, expiresAt: Date.now() + 10 * 60 * 1000 } satisfies LoginState),
      { expirationTtl: 600 },
    );
    return fullPhonePage(parsed, action, clientName, randomToken(), undefined, identityLogin);
  }
  const parsedRequest = await parseAuthorization(request, env);
  if (parsedRequest instanceof Response) return parsedRequest;
  if (!isAllowedRedirect(parsedRequest.redirectUri)) return document("<h1>Authorization request rejected</h1><p>This redirect URI is not allowed for Air × Muse.</p>", 400);
  const client = await env.OAUTH_PROVIDER.lookupClient(parsedRequest.clientId);
  if (!client) return document("<h1>Unknown OAuth client</h1>", 400);
  parsed = parsedRequest;
  clientName = client.clientName ?? "Muse";
  action = currentUrl.toString();
  if (request.method === "GET") {
    const flow = randomToken();
    await env.OAUTH_KV.put(
      `muse:wzrdmail-flow:${flow}`,
      JSON.stringify({ authorizationUrl: action, expiresAt: Date.now() + 10 * 60 * 1000 } satisfies WzrdmailFlowState),
      { expirationTtl: 600 },
    );
    return Response.redirect(wzrdmailConsoleUrl(env, flow), 302);
  }

  const form = await request.formData();
  const csrf = form.get("csrf");
  if (typeof csrf !== "string" || !(await csrfMatches(csrf, cookie(request, fullCsrfCookieName)))) return document("<h1>Expired or invalid approval</h1><p>Please return to the connector and try again.</p>", 403);
  const stage = form.get("stage");
  const login = cookie(request, fullLoginCookieName);
  const raw = login ? await env.OAUTH_KV.get(`muse:login:${login}`) : null;
  const loginState = raw ? JSON.parse(raw) as LoginState : null;
  if (stage === "phone") {
    const phone = form.get("phone");
    if (typeof phone !== "string") return fullPhonePage(parsed, action, clientName, randomToken(), "Enter a mobile number.");
    // A phone binds the iMessage relay to its owner; WZRDMail's Thirdweb
    // project performs the possession check rather than Air issuing a second
    // account credential.
    const outcome = await wzrdmail(env, "phone/start", { phone });
    if (outcome.status !== 200) return fullPhonePage(parsed, action, clientName, randomToken(), outcome.value.error === "invalid_phone" ? "Use a US mobile number that can receive SMS and iMessage." : "We could not send a code. Try again shortly.");
    return fullCodePage(parsed, action, phone, randomToken());
  }
  if (stage === "code") {
    const phone = form.get("phone");
    const code = form.get("code");
    if (typeof phone !== "string" || typeof code !== "string") return fullPhonePage(parsed, action, clientName, randomToken(), "Start again and request a new code.");
    // The WZRDMail subject is staged in the HttpOnly login cookie by the
    // callback. A direct POST cannot turn a phone OTP into an Air account.
    const loginSubject = loginState?.subject;
    if (!loginSubject) return fullPhonePage(parsed, action, clientName, randomToken(), "Your WZRDMail sign-in expired. Return to Muse and try again.");
    const verified = await wzrdmail(env, "phone/complete", { phone, code });
    if (verified.status !== 200) return fullCodePage(parsed, action, phone, randomToken(), "That code did not work. Try again.");
    const outcome = await controlPlane<{ user_id?: string; invite_url?: string | null }>(env, "/api/muse/wzrdmail/complete", { subject: loginSubject, phone });
    if (outcome.status !== 200 || !outcome.value.user_id) return fullCodePage(parsed, action, phone, randomToken(), outcome.value.error === "no_line_available" ? "Air's current iMessage user capacity is full. Please try again later." : "That code did not work. Try again.");
    const consentLogin = randomToken();
    await env.OAUTH_KV.put(`muse:login:${consentLogin}`, JSON.stringify({ userId: outcome.value.user_id, expiresAt: Date.now() + 10 * 60 * 1000 } satisfies LoginState), { expirationTtl: 600 });
    const scopes = fullScopes(parsed.scope);
    return fullConsentPage(parsed, action, clientName, scopes.includes("profile") ? scopes : ["profile", ...scopes], randomToken(), consentLogin, outcome.value.invite_url ?? undefined);
  }
  if (stage === "consent") {
    if (form.get("approve") !== "yes") return deniedAuthorization(parsed);
    const state = loginState;
    if (!login || !state?.userId || state.expiresAt < Date.now()) return fullPhonePage(parsed, action, clientName, randomToken(), "Your verification expired. Request another code.");
    const requested = fullScopes(parsed.scope);
    const selected = fullScopes(form.getAll("scope").filter((scope): scope is string => typeof scope === "string"));
    const scopes = selected.filter((scope) => requested.includes(scope));
    if (!scopes.includes("profile")) scopes.unshift("profile");
    const grant = await controlPlane<{ grant_id?: string }>(env, "/api/muse/grants", { user_id: state.userId, client_id: parsed.clientId, client_name: client.clientName ?? null, scopes });
    if (grant.status !== 200 || !grant.value.grant_id) return document("<h1>Air is unavailable</h1><p>Your connection was not completed. Please return to Muse and try again.</p>", 503);
    await env.OAUTH_KV.delete(`muse:login:${login}`);
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: parsed,
      userId: state.userId,
      metadata: { grant_ref: grant.value.grant_id },
      scope: scopes,
      props: { userId: state.userId, grantId: grant.value.grant_id, scopes } satisfies FullProps
    });
    return Response.redirect(redirectTo, 302);
  }
  return fullPhonePage(parsed, action, clientName, randomToken(), "Start again and request a new code.");
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
  async fetch(request: Request): Promise<Response> {
    if (!fullEnabled(this.env)) return mcpHandler(request, this.env, this.ctx);
    const props = this.ctx.props;
    if (!props || !("grantId" in props) || !("userId" in props)) {
      return json({ error: "invalid_token" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
    }
    // Database revocation is propagated here before the owner receives the
    // disconnect response. This inexpensive KV tombstone is the final check
    // in the data plane, so a still-valid refresh token cannot resurrect a
    // revoked grant.
    if (await this.env.OAUTH_KV.get(`muse:revoked:${props.grantId}`)) {
      return json({ error: "invalid_token" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
    }
    const allowed = await allowMuseRequest(this.env, props.userId, `grant:${props.grantId}`);
    if (allowed === false) return json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
    if (allowed === null) return json({ error: "relay_state_unavailable" }, { status: 503 });
    return fullMcpHandler(request, this.env, this.ctx);
  }
}

function fullBrief(env: MuseEnv): string {
  const docs = env.DOCS_URL ?? "https://air.wzrd.tech/docs/muse";
  return `# Air × Muse\n\nConnect one owner’s Air account to Muse. OAuth 2.1 authorization-code flow with PKCE is required. Air updates and /muse commands use the owner’s project-provisioned iMessage line. Every send, payment, booking, calendar change, and schedule remains behind Air’s Needs you decisions.\n\n## Access requirements\n\n- Sign in through WZRDMail’s existing Thirdweb authentication (email, Google, or Apple).\n- A US mobile number that can receive the Thirdweb verification code and will own the Air relay.\n- An available user seat in Air's current Photon Spectrum Pro project (up to 100 users).\n- Every verified user receives their own distinct Air “Texts on” iMessage number from that project; no dedicated-line or Business plan is required.\n- WZRDMail passes Air only a five-minute, single-use opaque subject. Thirdweb tokens and email addresses never cross the service boundary. New owners receive an Air account, line, Box, and WZRDMail during setup.\n\n## Capabilities\n\n- Connection: \`air.whoami\`, \`air.decisions.status\`\n- Relay: \`air.notify\`, \`air.commands.pull\`, \`air.commands.reply\`, \`air.commands.ack\`, \`air.agents.register\`\n- Air work: \`air.run\`, \`air.run.status\`\n- Mail and files: \`air.mail.list\`, \`air.mail.draft\`, \`air.files.put\`, \`air.files.list\`\n- Approval-gated changes: \`air.calendar.add\`, \`air.schedule.create\`, \`air.wallet.request\`\n- Wallet read: \`air.wallet.balance\`\n\n- MCP: \`https://muse.wzrd.tech/mcp\`\n- REST OpenAPI: \`https://muse.wzrd.tech/openapi.json\`\n- Documentation: ${docs}\n`;
}

/**
 * `/v1/*` stays outside OAuthProvider's API-route matcher so MUSE_ENABLED
 * can make it a true 404 in MM0. For full mode we unwrap the same opaque
 * OAuth access token locally and apply the same revocation tombstone that
 * protects `/mcp` before passing a scoped principal to the REST facade.
 */
async function oauthRestPrincipal(request: Request, env: MuseEnv): Promise<RestPrincipal | null> {
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ")
    ? request.headers.get("authorization")!.slice(7)
    : null;
  if (!bearer || bearer.startsWith("wzrd_muse_")) return null;
  const token = await env.OAUTH_PROVIDER.unwrapToken<FullProps>(bearer).catch(() => null);
  const props = token?.grant.props;
  if (!token || !props || props.userId !== token.userId || props.grantId !== token.grantId) return null;
  if (await env.OAUTH_KV.get(`muse:revoked:${props.grantId}`)) return null;
  const audience = token.audience;
  const audienceMatches = Array.isArray(audience) ? audience.includes("https://muse.wzrd.tech/mcp") : audience === "https://muse.wzrd.tech/mcp";
  if (!audienceMatches) return null;
  return {
    user_id: props.userId,
    token_id: props.grantId,
    scopes: fullScopes(token.scope),
    credential: "grant",
  };
}

async function internalAuthorized(request: Request, env: MuseEnv): Promise<boolean> {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  return csrfMatches(bearer, env.MUSE_INTERNAL_TOKEN);
}

async function internalHandler(request: Request, env: MuseEnv): Promise<Response> {
  if (!fullEnabled(env) || !(await internalAuthorized(request, env))) return new Response(null, { status: 404 });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const url = new URL(request.url);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.user_id !== "string") return json({ error: "invalid_request" }, { status: 400 });
  if (url.pathname === "/internal/revoke") {
    if (typeof body.grant_id !== "string") return json({ error: "invalid_request" }, { status: 400 });
    await env.OAUTH_KV.put(`muse:revoked:${body.grant_id}`, "1", { expirationTtl: 31 * 24 * 60 * 60 });
    return json({ ok: true });
  }
  const stub = env.MUSE_USER.get(env.MUSE_USER.idFromName(body.user_id));
  if (url.pathname === "/internal/commands") {
    if (typeof body.text !== "string" || typeof body.message_id !== "string") return json({ error: "invalid_request" }, { status: 400 });
    return stub.fetch("https://muse-user/enqueue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: body.text, message_id: body.message_id, agent_hint: body.agent_hint }) });
  }
  if (url.pathname === "/internal/status") return stub.fetch("https://muse-user/status");
  if (url.pathname === "/internal/purge") return stub.fetch("https://muse-user/purge", { method: "POST" });
  return json({ error: "not_found" }, { status: 404 });
}

const defaultHandler: ExportedHandler<MuseEnv> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/authorize") return fullEnabled(env) ? fullAuthorize(request, env) : authorize(request, env);
    if (url.pathname.startsWith("/internal/")) return internalHandler(request, env);
    if (url.pathname === "/__air/health" && request.method === "GET") {
      return json({ ok: true, stage: fullEnabled(env) ? "ready" : "mm0", service: "air-muse" });
    }
    if (url.pathname === "/muse.md" && request.method === "GET") {
      return new Response(
        fullEnabled(env) ? fullBrief(env) : "# Air × Muse MM0\n\nThis endpoint is a data-free OAuth and MCP protocol probe. It only exposes `air.whoami`, which returns a fixed stub identity.\n",
        { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } }
      );
    }
    if (fullEnabled(env) && url.pathname === "/openapi.json" && request.method === "GET") return json(openApi());
    if (fullEnabled(env) && url.pathname === "/.well-known/mcp.json" && request.method === "GET") return json({ name: "Air × Muse", endpoint: "https://muse.wzrd.tech/mcp", authorization: "https://muse.wzrd.tech/.well-known/oauth-protected-resource/mcp", documentation: env.DOCS_URL ?? "https://air.wzrd.tech/docs/muse" });
    if (fullEnabled(env) && url.pathname === "/docs" && request.method === "GET") return Response.redirect(env.DOCS_URL ?? "https://air.wzrd.tech/docs/muse", 302);
    if (fullEnabled(env) && url.pathname.startsWith("/v1/")) {
      return fullRestHandler(request, env, await oauthRestPrincipal(request, env));
    }
    if (url.pathname === "/" && request.method === "GET") {
      return document(fullEnabled(env) ? "<h1>Air × Muse</h1><p>Connect your Air account to Muse with OAuth 2.1 and PKCE. <a href=\"/muse.md\">Read the connector contract.</a></p>" : "<h1>Air × Muse MM0</h1><p>OAuth/MCP protocol probe only. <a href=\"/muse.md\">Read the probe contract.</a></p>");
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
  // These capabilities are only issued when MUSE_ENABLED and both data-plane
  // secrets are present. With the flag off, authorize() filters every grant
  // back to the fixed, data-free MM0 probe.
  scopesSupported: ["air.whoami", ...FULL_SCOPES],
  clientIdMetadataDocumentEnabled: true,
  resourceMetadata: {
    resource: "https://muse.wzrd.tech/mcp",
    authorization_servers: ["https://muse.wzrd.tech"],
    scopes_supported: ["air.whoami", ...FULL_SCOPES],
    resource_name: "Air × Muse"
  }
});

export { MuseUser };
