import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";

export const FULL_SCOPES = [
  "profile", "updates:write", "control", "agent:run", "mail:read", "mail:draft",
  "files:read", "files:write", "calendar:write", "schedule:write", "wallet:read", "wallet:request",
] as const;

export type MuseScope = (typeof FULL_SCOPES)[number];
export type FullProps = { userId: string; grantId: string; scopes: MuseScope[] };

type FullEnv = Env & {
  MUSE_ENABLED?: string;
  CONTROL_PLANE_ORIGIN?: string;
  DOCS_URL?: string;
  MUSE_WORKER_TOKEN?: string;
  MUSE_INTERNAL_TOKEN?: string;
  MUSE_USER: DurableObjectNamespace;
};

const scopeSet = new Set<string>(FULL_SCOPES);
const agentSchema = z.string().regex(/^[a-z0-9][a-z0-9 _-]{0,31}$/i);
const commandIdSchema = z.string().uuid();

export function fullEnabled(env: FullEnv): boolean {
  return String(env.MUSE_ENABLED) === "true" && Boolean(env.MUSE_WORKER_TOKEN) && Boolean(env.MUSE_INTERNAL_TOKEN);
}

export function fullScopes(scopes: readonly string[]): MuseScope[] {
  const wanted = new Set(scopes.filter((scope): scope is MuseScope => scopeSet.has(scope)));
  return FULL_SCOPES.filter((scope) => wanted.has(scope));
}

function props(): FullProps {
  const value = getMcpAuthContext()?.props;
  if (!value || typeof value.userId !== "string" || typeof value.grantId !== "string" || !Array.isArray(value.scopes)) {
    throw new Error("missing Air authorization context");
  }
  return { userId: value.userId, grantId: value.grantId, scopes: fullScopes(value.scopes.filter((scope): scope is string => typeof scope === "string")) };
}

function hasScope(context: FullProps, scope: MuseScope): boolean {
  return context.scopes.includes(scope);
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> };
}

function toolError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function cp<T>(env: FullEnv, path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const origin = (env.CONTROL_PLANE_ORIGIN ?? "https://app.wzrd.tech").replace(/\/+$/, "");
  const response = await fetch(`${origin}${path}`, {
    method: init.method ?? "POST",
    headers: {
      authorization: `Bearer ${env.MUSE_WORKER_TOKEN ?? ""}`,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ControlPlaneError(response.status, typeof body.error === "string" ? body.error : "control_plane_error");
  return body;
}

class ControlPlaneError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function objectFor(env: FullEnv, userId: string): DurableObjectStub {
  return env.MUSE_USER.get(env.MUSE_USER.idFromName(userId));
}

async function doCall<T>(env: FullEnv, userId: string, path: string, body?: unknown): Promise<T> {
  const response = await objectFor(env, userId).fetch(`https://muse-user${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error("relay state unavailable");
  return data;
}

/** JSON-only, stateless MCP handler. The factory is per request so the Worker
 * secret stays in the closure rather than a token's encrypted props. */
export async function fullMcpHandler(request: Request, env: FullEnv, ctx: ExecutionContext): Promise<Response> {
  const handler = createMcpHandler(() => createFullServer(env), {
    route: "/mcp",
    legacy: "stateless",
    responseMode: "json",
    corsOptions: false,
    allowedHostnames: ["muse.wzrd.tech"],
    allowedOriginHostnames: ["muse.ai", "www.muse.ai", "platform.muse.ai"],
  });
  return handler(request, env, ctx);
}

function createFullServer(env: FullEnv): McpServer {
  const server = new McpServer({ name: "air-muse", version: "1.0.0" }, {
    instructions: "Air is the connected user's personal agent. Never ask for an Air password or a second MCP URL. Sending, paying, booking, and scheduling stay behind the owner's Air approval."
  });
  const context = props();

  if (hasScope(context, "profile")) {
    server.registerTool("air.whoami", {
      title: "Air connection status",
      description: "See whether this owner's Air is connected and ready. It never returns a phone number, host, or credential.",
      inputSchema: z.object({}),
      outputSchema: z.object({ handle_display: z.string(), link: z.enum(["active", "revoked"]), box: z.enum(["ready", "stopped", "none"]), updates: z.object({ enabled: z.boolean(), daily_cap: z.number() }), relay: z.object({ last_pull_at: z.string().nullable() }) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => {
      try {
        return result(await cp(env, "/api/muse/profile", { body: { user_id: context.userId, grant_id: context.grantId } }));
      } catch (error) {
        return toolError(error instanceof ControlPlaneError ? error.message : "Air is unavailable");
      }
    });
  }

  if (hasScope(context, "updates:write")) {
    server.registerTool("air.notify", {
      title: "Text an update through Air",
      description: "Text the owner a Muse update on their Air line. Air applies their pause, quiet-hour, daily-cap, and first-message protections.",
      inputSchema: z.object({ agent: agentSchema, text: z.string().min(1).max(900), kind: z.enum(["info", "question", "done", "alert"]).default("info"), dedupe_key: z.string().max(64).optional() }),
      outputSchema: z.object({ delivered: z.boolean(), deferred: z.boolean(), deduped: z.boolean(), remaining_today: z.number() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ agent, text, kind, dedupe_key }) => {
      try {
        const gate = await doCall<{ deduped: boolean }>(env, context.userId, "/notify", { agent, dedupe_key });
        if (gate.deduped) return result({ delivered: false, deferred: false, deduped: true, remaining_today: 0 });
        const delivery = await cp<{ delivered: boolean; deferred: boolean; remaining_today: number }>(env, "/api/muse/notify", { body: { user_id: context.userId, agent, text, kind } });
        return result({ ...delivery, deduped: false });
      } catch (error) {
        if (error instanceof ControlPlaneError && error.status === 429) return toolError("daily_cap_reached");
        return toolError(error instanceof ControlPlaneError ? error.message : "Air could not deliver the update");
      }
    });
  }

  if (hasScope(context, "control")) {
    server.registerTool("air.commands.pull", {
      title: "Pull owner commands",
      description: "Pull commands the owner texted as /muse. Call from the owner's scheduled Muse relay agent. Waits at most 10 seconds.",
      inputSchema: z.object({ max: z.number().int().min(1).max(5).default(5), wait_seconds: z.number().int().min(0).max(10).default(10) }),
      outputSchema: z.object({ commands: z.array(z.object({ id: z.string().uuid(), text: z.string(), created_at: z.string(), agent_hint: z.string().optional() })) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ max, wait_seconds }) => {
      try {
        const pulled = await doCall<{ commands: unknown[] }>(env, context.userId, "/pull", { max, wait_seconds });
        await cp(env, "/api/muse/pulls", { body: { user_id: context.userId } }).catch(() => undefined);
        return result(pulled);
      } catch {
        return toolError("command_queue_unavailable");
      }
    });
    server.registerTool("air.commands.reply", {
      title: "Reply to an owner command",
      description: "Deliver a short result for one command pulled from Air. A command may be replied to once.",
      inputSchema: z.object({ command_id: commandIdSchema, agent: agentSchema, text: z.string().min(1).max(900) }),
      outputSchema: z.object({ delivered: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ command_id, agent, text }) => {
      let claimed = false;
      try {
        const claim = await doCall<{ ok: boolean }>(env, context.userId, "/reply/claim", { command_id });
        if (!claim.ok) return toolError("command_already_replied_or_expired");
        claimed = true;
        const reply = await cp<{ delivered: boolean }>(env, "/api/muse/reply", { body: { user_id: context.userId, command_id, agent, text } });
        await doCall(env, context.userId, "/reply/complete", { command_id, delivered: reply.delivered });
        return result(reply);
      } catch (error) {
        if (claimed) await doCall(env, context.userId, "/reply/release", { command_id }).catch(() => undefined);
        return toolError(error instanceof ControlPlaneError ? error.message : "Air could not deliver the reply");
      }
    });
    server.registerTool("air.commands.ack", {
      title: "Acknowledge an owner command",
      description: "Acknowledge a pulled command when you cannot complete it. It is removed without sending a reply.",
      inputSchema: z.object({ command_id: commandIdSchema }),
      outputSchema: z.object({ ok: z.literal(true) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ command_id }) => {
      try {
        return result(await doCall(env, context.userId, "/ack", { command_id }));
      } catch { return toolError("command_queue_unavailable"); }
    });
    server.registerTool("air.agents.register", {
      title: "Name a Muse agent",
      description: "Register the short agent name that appears in the owner's Air messages.",
      inputSchema: z.object({ agent: agentSchema, purpose: z.string().max(140) }),
      outputSchema: z.object({ ok: z.literal(true) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ agent, purpose }) => {
      try { return result(await doCall(env, context.userId, "/agents", { agent, purpose })); }
      catch { return toolError("relay_state_unavailable"); }
    });
  }

  return server;
}

interface RestPrincipal {
  user_id: string;
  token_id: string;
  scopes: string[];
}

function restJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function restPrincipal(request: Request, env: FullEnv): Promise<RestPrincipal | null> {
  const token = bearer(request);
  if (!token || !token.startsWith("wzrd_muse_")) return null;
  try {
    const principal = await cp<RestPrincipal>(env, "/api/muse/keys/verify", { body: { token } });
    return typeof principal.user_id === "string" && typeof principal.token_id === "string" && Array.isArray(principal.scopes)
      ? principal
      : null;
  } catch { return null; }
}

function allows(principal: RestPrincipal, scope: MuseScope): boolean {
  return principal.scopes.includes(scope);
}

async function restBody(request: Request): Promise<Record<string, unknown> | null> {
  const value = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * JSON REST facade for owner-created API keys. OAuth is used for the MCP
 * transport; REST keys are separately mintable/revocable in the Muse app so
 * a copied bearer never conveys an OAuth refresh token.
 */
export async function fullRestHandler(request: Request, env: FullEnv): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const principal = await restPrincipal(request, env);
  if (!principal) return restJson({ error: "invalid_token" }, 401);
  const path = new URL(request.url).pathname;
  if (path === "/v1/whoami") {
    if (!allows(principal, "profile")) return restJson({ error: "insufficient_scope" }, 403);
    try {
      const profile = await cp(env, "/api/muse/profile", { body: { user_id: principal.user_id, key_id: principal.token_id } });
      return restJson(profile);
    } catch { return restJson({ error: "air_unavailable" }, 503); }
  }
  const body = await restBody(request);
  if (!body) return restJson({ error: "invalid_request" }, 400);
  if (path === "/v1/notify") {
    if (!allows(principal, "updates:write")) return restJson({ error: "insufficient_scope" }, 403);
    const { agent, text, kind } = body;
    if (typeof agent !== "string" || !/^[a-z0-9][a-z0-9 _-]{0,31}$/i.test(agent) || typeof text !== "string" || text.length < 1 || text.length > 900 || !["info", "question", "done", "alert"].includes(String(kind ?? "info"))) return restJson({ error: "invalid_request" }, 400);
    try { return restJson(await cp(env, "/api/muse/notify", { body: { user_id: principal.user_id, agent, text, kind: kind ?? "info" } })); }
    catch (error) { return restJson({ error: error instanceof ControlPlaneError ? error.message : "air_unavailable" }, error instanceof ControlPlaneError ? error.status : 503); }
  }
  if (!allows(principal, "control")) return restJson({ error: "insufficient_scope" }, 403);
  if (path === "/v1/commands/pull") {
    const max = typeof body.max === "number" && Number.isInteger(body.max) ? Math.min(5, Math.max(1, body.max)) : 5;
    const wait_seconds = typeof body.wait_seconds === "number" && Number.isInteger(body.wait_seconds) ? Math.min(10, Math.max(0, body.wait_seconds)) : 0;
    try {
      const pulled = await doCall(env, principal.user_id, "/pull", { max, wait_seconds });
      await cp(env, "/api/muse/pulls", { body: { user_id: principal.user_id } }).catch(() => undefined);
      return restJson(pulled);
    } catch { return restJson({ error: "command_queue_unavailable" }, 503); }
  }
  if (path === "/v1/commands/ack") {
    if (typeof body.command_id !== "string") return restJson({ error: "invalid_request" }, 400);
    try { return restJson(await doCall(env, principal.user_id, "/ack", { command_id: body.command_id })); }
    catch { return restJson({ error: "command_queue_unavailable" }, 503); }
  }
  if (path === "/v1/commands/reply") {
    const { command_id, agent, text } = body;
    if (typeof command_id !== "string" || typeof agent !== "string" || !/^[a-z0-9][a-z0-9 _-]{0,31}$/i.test(agent) || typeof text !== "string" || text.length < 1 || text.length > 900) return restJson({ error: "invalid_request" }, 400);
    let claimed = false;
    try {
      const claim = await doCall<{ ok: boolean }>(env, principal.user_id, "/reply/claim", { command_id });
      if (!claim.ok) return restJson({ error: "command_already_replied_or_expired" }, 409);
      claimed = true;
      const reply = await cp(env, "/api/muse/reply", { body: { user_id: principal.user_id, command_id, agent, text } });
      await doCall(env, principal.user_id, "/reply/complete", { command_id, delivered: (reply as { delivered?: unknown }).delivered === true });
      return restJson(reply);
    } catch (error) {
      if (claimed) await doCall(env, principal.user_id, "/reply/release", { command_id }).catch(() => undefined);
      return restJson({ error: error instanceof ControlPlaneError ? error.message : "air_unavailable" }, error instanceof ControlPlaneError ? error.status : 503);
    }
  }
  if (path === "/v1/agents/register") {
    const { agent, purpose } = body;
    if (typeof agent !== "string" || !/^[a-z0-9][a-z0-9 _-]{0,31}$/i.test(agent) || typeof purpose !== "string" || purpose.length > 140) return restJson({ error: "invalid_request" }, 400);
    try { return restJson(await doCall(env, principal.user_id, "/agents", { agent, purpose })); }
    catch { return restJson({ error: "relay_state_unavailable" }, 503); }
  }
  return restJson({ error: "not_found" }, 404);
}

export interface QueuedCommand {
  id: string;
  text: string;
  created_at: string;
  agent_hint?: string;
  message_id: string;
  lease_until?: string;
  reply_state?: "claimed";
}

interface MuseUserState {
  commands: QueuedCommand[];
  agents: Record<string, { purpose: string; last_seen_at: string }>;
  dedupe: Record<string, string>;
  last_pull_at: string | null;
}

function emptyState(): MuseUserState {
  return { commands: [], agents: {}, dedupe: {}, last_pull_at: null };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function nowIso(): string { return new Date().toISOString(); }
function uuid(): string { return crypto.randomUUID(); }

/**
 * Per-user private relay state. It holds command text only here, never in a
 * Worker log or Postgres, and alarm-based expiry erases it within 24 hours.
 */
export class MuseUser implements DurableObject {
  constructor(readonly ctx: DurableObjectState, readonly env: FullEnv) {}
  private async state(): Promise<MuseUserState> {
    return (await this.ctx.storage.get<MuseUserState>("state")) ?? emptyState();
  }

  private async save(state: MuseUserState): Promise<void> {
    await this.ctx.storage.put("state", state);
    if (state.commands.length > 0) await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }

  async alarm(): Promise<void> {
    const state = await this.state();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    state.commands = state.commands.filter((command) => Date.parse(command.created_at) >= cutoff);
    const dedupeCutoff = Date.now() - 24 * 60 * 60 * 1000;
    state.dedupe = Object.fromEntries(Object.entries(state.dedupe).filter(([, at]) => Date.parse(at) >= dedupeCutoff));
    await this.save(state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = await this.state();
    if (url.pathname === "/enqueue" && request.method === "POST") {
      const body = await request.json() as { text?: unknown; agent_hint?: unknown; message_id?: unknown };
      if (typeof body.text !== "string" || body.text.length < 1 || body.text.length > 2_000 || typeof body.message_id !== "string" || body.message_id.length > 200) return json({ error: "invalid_command" }, 400);
      const existing = state.commands.find((command) => command.message_id === body.message_id);
      if (existing) return json({ id: existing.id, deduped: true });
      const command: QueuedCommand = { id: uuid(), text: body.text, created_at: nowIso(), message_id: body.message_id, ...(typeof body.agent_hint === "string" && body.agent_hint.length <= 32 ? { agent_hint: body.agent_hint } : {}) };
      state.commands.push(command);
      await this.save(state);
      return json({ id: command.id, deduped: false });
    }
    if (url.pathname === "/pull" && request.method === "POST") {
      const body = await request.json() as { max?: unknown; wait_seconds?: unknown };
      const max = typeof body.max === "number" && Number.isInteger(body.max) ? Math.min(5, Math.max(1, body.max)) : 5;
      const wait = typeof body.wait_seconds === "number" && Number.isInteger(body.wait_seconds) ? Math.min(10, Math.max(0, body.wait_seconds)) : 0;
      if (state.commands.length === 0 && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      const refreshed = await this.state();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      refreshed.commands = refreshed.commands.filter((command) => Date.parse(command.created_at) >= cutoff);
      const at = nowIso();
      refreshed.last_pull_at = at;
      const leaseUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const commands = refreshed.commands
        .filter((command) => !command.reply_state && (!command.lease_until || Date.parse(command.lease_until) < Date.now()))
        .slice(0, max)
        .map((command) => ({ id: command.id, text: command.text, created_at: command.created_at, ...(command.agent_hint ? { agent_hint: command.agent_hint } : {}) }));
      const selected = new Set(commands.map((command) => command.id));
      refreshed.commands = refreshed.commands.map((command) => selected.has(command.id) ? { ...command, lease_until: leaseUntil } : command);
      await this.save(refreshed);
      return json({ commands });
    }
    if (url.pathname === "/reply/claim" && request.method === "POST") {
      const { command_id } = await request.json() as { command_id?: unknown };
      if (typeof command_id !== "string") return json({ ok: false }, 400);
      const command = state.commands.find((entry) => entry.id === command_id);
      if (!command || command.reply_state === "claimed" || Date.parse(command.created_at) < Date.now() - 24 * 60 * 60 * 1000) return json({ ok: false });
      command.reply_state = "claimed";
      await this.save(state);
      return json({ ok: true });
    }
    if (url.pathname === "/reply/complete" && request.method === "POST") {
      const { command_id, delivered } = await request.json() as { command_id?: unknown; delivered?: unknown };
      if (typeof command_id !== "string") return json({ ok: false }, 400);
      state.commands = state.commands.filter((command) => command.id !== command_id);
      await this.save(state);
      return json({ ok: true, delivered: delivered === true });
    }
    if (url.pathname === "/reply/release" && request.method === "POST") {
      const { command_id } = await request.json() as { command_id?: unknown };
      if (typeof command_id !== "string") return json({ ok: false }, 400);
      const command = state.commands.find((entry) => entry.id === command_id);
      if (!command || command.reply_state !== "claimed") return json({ ok: false });
      delete command.reply_state;
      await this.save(state);
      return json({ ok: true });
    }
    if (url.pathname === "/ack" && request.method === "POST") {
      const { command_id } = await request.json() as { command_id?: unknown };
      if (typeof command_id !== "string") return json({ ok: false }, 400);
      state.commands = state.commands.filter((command) => command.id !== command_id);
      await this.save(state);
      return json({ ok: true });
    }
    if (url.pathname === "/agents" && request.method === "POST") {
      const { agent, purpose } = await request.json() as { agent?: unknown; purpose?: unknown };
      if (typeof agent !== "string" || typeof purpose !== "string" || !/^[a-z0-9][a-z0-9 _-]{0,31}$/i.test(agent) || purpose.length > 140) return json({ error: "invalid_agent" }, 400);
      state.agents[agent] = { purpose, last_seen_at: nowIso() };
      await this.save(state);
      return json({ ok: true });
    }
    if (url.pathname === "/notify" && request.method === "POST") {
      const { agent, dedupe_key } = await request.json() as { agent?: unknown; dedupe_key?: unknown };
      if (typeof agent !== "string") return json({ error: "invalid_agent" }, 400);
      const key = typeof dedupe_key === "string" ? `${agent}:${dedupe_key}` : "";
      if (key && state.dedupe[key] && Date.now() - Date.parse(state.dedupe[key]) < 24 * 60 * 60 * 1000) return json({ deduped: true });
      if (key) state.dedupe[key] = nowIso();
      await this.save(state);
      return json({ deduped: false });
    }
    if (url.pathname === "/status") return json({ last_pull_at: state.last_pull_at, agents: Object.keys(state.agents) });
    if (url.pathname === "/purge" && request.method === "POST") {
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }
    return json({ error: "not_found" }, 404);
  }
}

export function isAllowedRedirect(uri: string): boolean {
  let url: URL;
  try { url = new URL(uri); } catch { return false; }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (loopback) return url.protocol === "http:" || url.protocol === "https:";
  if (url.protocol !== "https:") return false;
  return url.hostname === "muse.ai" || url.hostname.endsWith(".muse.ai") || url.hostname.endsWith(".meta.ai");
}

export function openApi(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const toolMap: Array<[string, MuseScope, string]> = [
    ["whoami", "profile", "Read the Air connection state."],
    ["notify", "updates:write", "Text an update through Air."],
    ["commands/pull", "control", "Pull queued owner commands."],
    ["commands/reply", "control", "Reply to a queued owner command."],
    ["commands/ack", "control", "Acknowledge a queued owner command."],
    ["agents/register", "control", "Register a visible Muse agent name."],
  ];
  for (const [path, scope, summary] of toolMap) {
    paths[`/v1/${path}`] = { post: { summary, security: [{ museApiKey: [] }], responses: { "200": { description: "Air response" } } } };
  }
  return {
    openapi: "3.1.0",
    info: { title: "Air × Muse", version: "1.0.0", description: "JSON-only REST facade for owner-created, revocable Air Muse API keys. OAuth with PKCE protects the MCP endpoint." },
    servers: [{ url: "https://muse.wzrd.tech" }],
    paths,
    components: { securitySchemes: { oauth2: { type: "oauth2", flows: { authorizationCode: { authorizationUrl: "https://muse.wzrd.tech/authorize", tokenUrl: "https://muse.wzrd.tech/token", scopes: Object.fromEntries(FULL_SCOPES.map((scope) => [scope, scope])) } } }, museApiKey: { type: "http", scheme: "bearer", bearerFormat: "wzrd_muse" } } },
  };
}
