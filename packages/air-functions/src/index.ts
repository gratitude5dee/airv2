/**
 * @air/functions — the SDK a mini-app's `functions/index.ts` imports
 * (docs/goal-create-v11.md §11). One file, no imports, so the Build Service
 * can vendor it byte for byte (packages/create-kit/functions/index.ts) and
 * a Worker module compiles with nothing but this, `hono`, and `zod`.
 *
 * Trust model: identity comes from the Dispatcher's headers (`X-Air-*`),
 * which it strips from every inbound request before setting them itself, so
 * `air.user(req)` never reads a client-forged value. Everything the Worker
 * needs from the platform (inference, the owner's state, actions, media) is
 * a plain `fetch` to `https://air.internal/v1/*`; the Outbound Worker turns
 * that into an authenticated control-plane call — the runtime token never
 * exists inside user code (CR6).
 */

export const RUNTIME_ORIGIN = "https://air.internal";
export const RUNTIME_MODELS = ["fast", "balanced", "deep"] as const;
export type RuntimeModel = (typeof RUNTIME_MODELS)[number];

export type AirRole = "owner" | "guest" | "anon" | "agent";

export interface AirUser {
  /** App-scoped pseudonym; stable per (user, app), never a user id (CR9). */
  principal: string;
  role: AirRole;
  app: string;
  version: string;
}

// ── Minimal Workers runtime shapes (structural; no workers-types dependency) ──

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}
export interface KVNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string | ArrayBuffer, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}
export interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** The bindings a user Worker may receive (§11.1) — and nothing else. */
export interface AirEnv {
  ASSETS?: Fetcher;
  DB?: D1Database;
  KV?: KVNamespace;
  [secret: string]: unknown;
}

// ── Identity ──────────────────────────────────────────────────────────────────

const ROLES = new Set<string>(["owner", "guest", "anon", "agent"]);

/** Who is calling, as the Dispatcher stamped it. Missing headers read as anon. */
export function user(req: Request): AirUser {
  const role = req.headers.get("x-air-role") ?? "anon";
  return {
    principal: req.headers.get("x-air-principal") ?? "",
    role: (ROLES.has(role) ? role : "anon") as AirRole,
    app: req.headers.get("x-air-app") ?? "",
    version: req.headers.get("x-air-version") ?? "",
  };
}

// ── Bindings ──────────────────────────────────────────────────────────────────

export class BindingError extends Error {
  constructor(binding: "DB" | "KV") {
    super(
      binding === "DB"
        ? 'no database: set "db": true under functions in air.json and rebuild'
        : 'no kv: set "kv": true under functions in air.json and rebuild'
    );
    this.name = "BindingError";
  }
}

export function db(env: AirEnv): D1Database {
  if (!env.DB) throw new BindingError("DB");
  return env.DB;
}

export function kv(env: AirEnv): KVNamespace {
  if (!env.KV) throw new BindingError("KV");
  return env.KV;
}

// ── Runtime API (`https://air.internal/v1/*`) ─────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ChatRequest {
  model: RuntimeModel;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

function runtimeUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(path, RUNTIME_ORIGIN);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

export const ai = {
  /**
   * OpenAI-compatible completion through the owner's gateway, metered to
   * this app's daily cap (CR8). `model` must be one of RUNTIME_MODELS — the
   * Outbound Worker refuses anything else, so this only fails earlier.
   */
  chat(body: ChatRequest, init?: { signal?: AbortSignal }): Promise<Response> {
    if (!RUNTIME_MODELS.includes(body.model)) {
      return Promise.reject(new Error(`model must be one of ${RUNTIME_MODELS.join("|")}`));
    }
    return fetch(runtimeUrl("/v1/chat/completions"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(init?.signal ? { signal: init.signal } : {}),
    });
  },
};

const RESOURCE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function assertResource(resource: string): string {
  if (!RESOURCE_RE.test(resource)) {
    throw new Error("resource must be 1–64 lowercase letters, digits, _ or -");
  }
  return resource;
}

export const state = {
  /** The owner's app state document `<resource>.json`; `{}` when unset. */
  async get<T = unknown>(resource: string): Promise<T> {
    const response = await fetch(
      runtimeUrl("/v1/state", { resource: assertResource(resource) })
    );
    if (!response.ok) throw await runtimeError(response, "state read");
    const body = (await response.json()) as { state?: T };
    return (body.state ?? {}) as T;
  },
  /** Owner role only; guests receive 403 from the control plane. */
  async put(resource: string, value: unknown): Promise<void> {
    const response = await fetch(
      runtimeUrl("/v1/state", { resource: assertResource(resource) }),
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      }
    );
    if (!response.ok) throw await runtimeError(response, "state write");
  },
};

export const actions = {
  /** Append a typed action (declared in air.json `actions`) for the owner's agent. */
  async append(action: string, payload: unknown = null): Promise<void> {
    const response = await fetch(runtimeUrl("/v1/actions"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    if (!response.ok) throw await runtimeError(response, "action");
  },
};

export interface MediaResult {
  url: string;
  bytes: number;
  contentType: string;
}

export const media = {
  /** Put a file at the owner's public media prefix (guarded, quota-charged). */
  async put(
    bytes: ArrayBuffer | Uint8Array | Blob,
    options: { filename: string; contentType: string }
  ): Promise<MediaResult> {
    const body =
      bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: options.contentType });
    const response = await fetch(runtimeUrl("/v1/media", { filename: options.filename }), {
      method: "POST",
      headers: { "content-type": options.contentType },
      body,
    });
    if (!response.ok) throw await runtimeError(response, "media");
    return (await response.json()) as MediaResult;
  },
};

export class RuntimeError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RuntimeError";
    this.status = status;
    this.code = code;
  }
}

async function runtimeError(response: Response, what: string): Promise<RuntimeError> {
  let code = "error";
  try {
    const body = (await response.json()) as { error?: unknown; reason?: unknown };
    if (typeof body.error === "string") code = body.error;
    else if (typeof body.reason === "string") code = body.reason;
  } catch {
    // body was not json
  }
  return new RuntimeError(response.status, code, `${what} failed: ${response.status} ${code}`);
}

// ── Router ────────────────────────────────────────────────────────────────────

export interface Context<E extends AirEnv = AirEnv> {
  req: Request;
  env: E;
  ctx: ExecutionContext;
  url: URL;
  params: Record<string, string>;
  user: AirUser;
  /** Throws BindingError when `functions.db` is off. */
  readonly db: D1Database;
  /** Throws BindingError when `functions.kv` is off. */
  readonly kv: KVNamespace;
  json(data: unknown, init?: number | ResponseInit): Response;
  text(body: string, init?: number | ResponseInit): Response;
  body<T = unknown>(): Promise<T>;
}

export type Handler<E extends AirEnv = AirEnv> = (
  c: Context<E>
) => Response | Promise<Response>;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL";

interface Route<E extends AirEnv> {
  method: Method;
  pattern: RegExp;
  keys: string[];
  handler: Handler<E>;
}

export function json(data: unknown, init?: number | ResponseInit): Response {
  const options: ResponseInit = typeof init === "number" ? { status: init } : { ...init };
  const headers = new Headers(options.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...options, headers });
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split("/")
    .map((segment) => {
      if (segment === "*") return ".*";
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

/**
 * A small path router with Workers-module `fetch` — `export default
 * air.router()...` is a complete Worker. Handlers that throw become a 500
 * with no stack (the Dispatcher turns a crashed Worker into a typed 502).
 */
export class Router<E extends AirEnv = AirEnv> {
  private readonly routes: Route<E>[] = [];
  private notFound: Handler<E> = (c) => c.json({ error: "not_found" }, 404);

  on(method: Method, path: string, handler: Handler<E>): this {
    const { pattern, keys } = compile(path);
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }
  get(path: string, handler: Handler<E>): this {
    return this.on("GET", path, handler);
  }
  post(path: string, handler: Handler<E>): this {
    return this.on("POST", path, handler);
  }
  put(path: string, handler: Handler<E>): this {
    return this.on("PUT", path, handler);
  }
  patch(path: string, handler: Handler<E>): this {
    return this.on("PATCH", path, handler);
  }
  delete(path: string, handler: Handler<E>): this {
    return this.on("DELETE", path, handler);
  }
  all(path: string, handler: Handler<E>): this {
    return this.on("ALL", path, handler);
  }
  fallback(handler: Handler<E>): this {
    this.notFound = handler;
    return this;
  }

  fetch = async (req: Request, env: E, ctx: ExecutionContext): Promise<Response> => {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    for (const route of this.routes) {
      if (route.method !== "ALL" && route.method !== method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1] ?? "");
      });
      try {
        return await route.handler(makeContext(req, env, ctx, url, params));
      } catch (error) {
        if (error instanceof BindingError) return json({ error: error.message }, 500);
        return json({ error: "internal" }, 500);
      }
    }
    return this.notFound(makeContext(req, env, ctx, url, {}));
  };
}

function makeContext<E extends AirEnv>(
  req: Request,
  env: E,
  ctx: ExecutionContext,
  url: URL,
  params: Record<string, string>
): Context<E> {
  return {
    req,
    env,
    ctx,
    url,
    params,
    user: user(req),
    get db() {
      return db(env);
    },
    get kv() {
      return kv(env);
    },
    json,
    text: (body, init) => {
      const options: ResponseInit = typeof init === "number" ? { status: init } : { ...init };
      const headers = new Headers(options.headers);
      if (!headers.has("content-type")) headers.set("content-type", "text/plain; charset=utf-8");
      return new Response(body, { ...options, headers });
    },
    body: <T>() => req.json() as Promise<T>,
  };
}

export function router<E extends AirEnv = AirEnv>(): Router<E> {
  return new Router<E>();
}

export const air = { router, user, db, kv, ai, state, actions, media, json };
export default air;
