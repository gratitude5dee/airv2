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

/** A small, content-free first-line limit that applies equally to OAuth
 * grants and owner-minted REST keys. Production also attaches Cloudflare's
 * edge rule for registration/token abuse; keeping this state beside the
 * relay means the user-level cap survives a Worker isolate restart. */
export async function allowMuseRequest(
  env: FullEnv,
  userId: string,
  credentialId: string,
): Promise<boolean | null> {
  try {
    const response = await objectFor(env, userId).fetch("https://muse-user/rate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential_id: credentialId }),
    });
    if (response.status === 429) return false;
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { allowed?: unknown } | null;
    return body?.allowed === true;
  } catch {
    return null;
  }
}

/** The Worker validates scopes and tool schemas; the control plane owns the
 * actual Air capability so provider secrets and Box routes never reach this
 * edge process. Inputs are passed through without logging or persistence. */
async function capability<T>(env: FullEnv, userId: string, name: string, input: unknown): Promise<T> {
  return cp<T>(env, `/api/muse/air/${name}`, { body: { user_id: userId, input } });
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
    server.registerTool("air.decisions.status", {
      title: "Check an Air approval",
      description: "Check whether one Air Needs-you approval is pending, approved, denied, or expired. A decision id is not the result of the requested action.",
      inputSchema: z.object({ decision_id: commandIdSchema }),
      outputSchema: z.object({ status: z.enum(["pending", "approved", "denied", "expired"]), resolved_at: z.string().nullable() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ decision_id }) => {
      try { return result(await capability(env, context.userId, "decisions-status", { decision_id })); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air is unavailable"); }
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

  if (hasScope(context, "agent:run")) {
    server.registerTool("air.run", {
      title: "Hand work to Air",
      description: "Start a task on the owner's personal Air computer. Air applies the owner's plan and approval gates to every side effect.",
      inputSchema: z.object({ prompt: z.string().min(1).max(4000), agent: agentSchema, wait_seconds: z.number().int().min(0).max(8).default(0) }),
      outputSchema: z.object({ run_id: z.string(), status: z.enum(["running", "done", "error", "budget_exhausted"]), result: z.string().optional(), decision_ids: z.array(z.string().uuid()) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "run", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air could not start the task"); }
    });
    server.registerTool("air.run.status", {
      title: "Check Air work",
      description: "Check the status of a task previously delegated to Air. It does not wake the owner's computer.",
      inputSchema: z.object({ run_id: z.string().min(1).max(160) }),
      outputSchema: z.object({ run_id: z.string(), status: z.enum(["running", "done", "error", "budget_exhausted"]), result: z.string().optional(), decision_ids: z.array(z.string().uuid()) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "run-status", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air is unavailable"); }
    });
  }

  if (hasScope(context, "mail:read")) {
    server.registerTool("air.mail.list", {
      title: "List recent Air mail",
      description: "List recent threads from the owner's Air inbox. Use bodies only when essential; Air caps each returned body.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(25).default(10), include_body: z.boolean().default(false) }),
      outputSchema: z.object({ messages: z.array(z.object({ id: z.string(), from: z.string(), subject: z.string(), snippet: z.string(), received_at: z.string().nullable(), body: z.string().optional() })) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "mail-list", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air mail is unavailable"); }
    });
  }

  if (hasScope(context, "mail:draft")) {
    server.registerTool("air.mail.draft", {
      title: "Draft an Air email",
      description: "Create a draft in the owner's Air inbox. It cannot send until the owner approves the resulting Needs-you decision.",
      inputSchema: z.object({ to: z.array(z.string().email()).min(1).max(20), subject: z.string().min(1).max(240), body: z.string().min(1).max(20_000) }),
      outputSchema: z.object({ draft_id: z.string(), decision_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "mail-draft", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air could not create the draft"); }
    });
  }

  if (hasScope(context, "files:write")) {
    server.registerTool("air.files.put", {
      title: "Drop a file into Air",
      description: "Put a small file in the owner's Air inbox folder. Bytes go directly to that owner's computer and are never stored in Air's shared database.",
      inputSchema: z.object({ name: z.string().min(1).max(120), content_base64: z.string().optional(), url: z.string().url().optional() }).refine((input) => Boolean(input.content_base64) !== Boolean(input.url)),
      outputSchema: z.object({ path: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "files-put", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air could not store the file"); }
    });
  }

  if (hasScope(context, "files:read")) {
    server.registerTool("air.files.list", {
      title: "List Air inbox files",
      description: "List the files previously dropped in the owner's Muse inbox folder without reading their contents.",
      inputSchema: z.object({}),
      outputSchema: z.object({ files: z.array(z.object({ name: z.string(), bytes: z.number().int().nonnegative(), modified_at: z.string() })) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "files-list", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air files are unavailable"); }
    });
  }

  if (hasScope(context, "calendar:write")) {
    server.registerTool("air.calendar.add", {
      title: "Propose an Air calendar event",
      description: "Create a calendar proposal. Nothing is added until the owner approves it in Air's Needs-you queue.",
      inputSchema: z.object({ title: z.string().min(1).max(160), starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }).optional(), location: z.string().max(240).optional(), notes: z.string().max(2000).optional() }),
      outputSchema: z.object({ decision_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "calendar-add", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air could not create the proposal"); }
    });
  }

  if (hasScope(context, "schedule:write")) {
    server.registerTool("air.schedule.create", {
      title: "Propose a recurring Air task",
      description: "Propose a recurring task for the owner's Air computer. It remains inactive until the owner approves it.",
      inputSchema: z.object({ cron: z.string().min(1).max(120), prompt: z.string().min(1).max(2000), agent: agentSchema, timezone: z.string().min(1).max(80).default("UTC") }),
      outputSchema: z.object({ decision_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "schedule-create", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air could not create the proposal"); }
    });
  }

  if (hasScope(context, "wallet:read")) {
    server.registerTool("air.wallet.balance", {
      title: "Read Air wallet balances",
      description: "Read the owner's display balances on Air's configured chain. This never creates a transaction.",
      inputSchema: z.object({}),
      outputSchema: z.object({ chain_id: z.number().int(), native: z.object({ symbol: z.string(), display: z.string() }).nullable(), tokens: z.array(z.object({ symbol: z.string(), display: z.string() })) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "wallet-balance", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air wallet is unavailable"); }
    });
  }

  if (hasScope(context, "wallet:request")) {
    server.registerTool("air.wallet.request", {
      title: "Request an Air wallet send",
      description: "Create a wallet-send approval request. This tool never sends funds; only the owner can approve the request in Air.",
      inputSchema: z.object({ to: z.string().min(1).max(128), amount_display: z.string().min(1).max(32), token_address: z.string().nullable().optional(), memo: z.string().max(140).optional() }),
      outputSchema: z.object({ decision_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    }, async (input) => {
      try { return result(await capability(env, context.userId, "wallet-request", input)); }
      catch (error) { return toolError(error instanceof ControlPlaneError ? error.message : "Air could not create the approval"); }
    });
  }

  return server;
}

export interface RestPrincipal {
  user_id: string;
  token_id: string;
  scopes: string[];
  credential: "grant" | "key";
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
      ? { ...principal, credential: "key" }
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
 * JSON REST facade. It accepts the owner's revocable `wzrd_muse_` key or an
 * OAuth access token already issued for this resource. Both resolve to the
 * same scoped principal; raw bearer values never leave the Worker.
 */
export async function fullRestHandler(request: Request, env: FullEnv, authenticated?: RestPrincipal | null): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const principal = authenticated ?? await restPrincipal(request, env);
  if (!principal) return restJson({ error: "invalid_token" }, 401);
  const allowed = await allowMuseRequest(env, principal.user_id, `${principal.credential}:${principal.token_id}`);
  if (allowed === false) return restJson({ error: "rate_limited" }, 429);
  if (allowed === null) return restJson({ error: "air_unavailable" }, 503);
  const path = new URL(request.url).pathname;
  if (path === "/v1/whoami") {
    if (!allows(principal, "profile")) return restJson({ error: "insufficient_scope" }, 403);
    try {
      const profile = await cp(env, "/api/muse/profile", {
        body: {
          user_id: principal.user_id,
          ...(principal.credential === "grant" ? { grant_id: principal.token_id } : { key_id: principal.token_id }),
        },
      });
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
  const controlPaths = new Set(["/v1/commands/pull", "/v1/commands/ack", "/v1/commands/reply", "/v1/agents/register"]);
  if (controlPaths.has(path) && !allows(principal, "control")) return restJson({ error: "insufficient_scope" }, 403);
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
  const capabilityRoute: Record<string, { scope: MuseScope; capability: string }> = {
    "/v1/run": { scope: "agent:run", capability: "run" },
    "/v1/run/status": { scope: "agent:run", capability: "run-status" },
    "/v1/mail/list": { scope: "mail:read", capability: "mail-list" },
    "/v1/mail/draft": { scope: "mail:draft", capability: "mail-draft" },
    "/v1/files/put": { scope: "files:write", capability: "files-put" },
    "/v1/files/list": { scope: "files:read", capability: "files-list" },
    "/v1/calendar/add": { scope: "calendar:write", capability: "calendar-add" },
    "/v1/schedule/create": { scope: "schedule:write", capability: "schedule-create" },
    "/v1/wallet/balance": { scope: "wallet:read", capability: "wallet-balance" },
    "/v1/wallet/request": { scope: "wallet:request", capability: "wallet-request" },
    "/v1/decisions/status": { scope: "profile", capability: "decisions-status" },
  };
  const mapped = capabilityRoute[path];
  if (!mapped) return restJson({ error: "not_found" }, 404);
  if (!allows(principal, mapped.scope)) return restJson({ error: "insufficient_scope" }, 403);
  try {
    return restJson(await capability(env, principal.user_id, mapped.capability, body));
  } catch (error) {
    return restJson(
      { error: error instanceof ControlPlaneError ? error.message : "air_unavailable" },
      error instanceof ControlPlaneError ? error.status : 503,
    );
  }
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
  rate: Record<string, number[]>;
  last_pull_at: string | null;
}

function emptyState(): MuseUserState {
  return { commands: [], agents: {}, dedupe: {}, rate: {}, last_pull_at: null };
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
    const stored = await this.ctx.storage.get<Partial<MuseUserState>>("state");
    return stored
      ? { ...emptyState(), ...stored, rate: stored.rate ?? {} }
      : emptyState();
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
    const rateCutoff = Date.now() - 60_000;
    state.rate = Object.fromEntries(Object.entries(state.rate)
      .map(([key, hits]) => [key, hits.filter((at) => at >= rateCutoff)] as const)
      .filter(([, hits]) => hits.length > 0));
    await this.save(state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = await this.state();
    if (url.pathname === "/rate" && request.method === "POST") {
      const body = await request.json() as { credential_id?: unknown };
      if (typeof body.credential_id !== "string" || body.credential_id.length < 1 || body.credential_id.length > 160) {
        return json({ error: "invalid_credential" }, 400);
      }
      const now = Date.now();
      const hits = (state.rate[body.credential_id] ?? []).filter((at) => at >= now - 60_000);
      if (hits.length >= 60) {
        state.rate[body.credential_id] = hits;
        await this.save(state);
        return json({ allowed: false }, 429);
      }
      hits.push(now);
      state.rate[body.credential_id] = hits;
      await this.save(state);
      return json({ allowed: true });
    }
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
    ["run", "agent:run", "Delegate a task to the owner's Air computer."],
    ["run/status", "agent:run", "Read the status of an Air task."],
    ["mail/list", "mail:read", "List recent Air inbox threads."],
    ["mail/draft", "mail:draft", "Create an owner-approved Air email draft."],
    ["files/put", "files:write", "Drop a file into the owner's Air inbox folder."],
    ["files/list", "files:read", "List files in the owner's Air inbox folder."],
    ["calendar/add", "calendar:write", "Propose an Air calendar event for approval."],
    ["schedule/create", "schedule:write", "Propose a recurring Air task for approval."],
    ["wallet/balance", "wallet:read", "Read display wallet balances."],
    ["wallet/request", "wallet:request", "Request, but never execute, a wallet send."],
    ["decisions/status", "profile", "Read the status of an Air Needs-you decision."],
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
