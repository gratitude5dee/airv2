// Air Outbound Worker (V11 §11.3): every `fetch()` a user Worker makes lands
// here first. It is the only path from user code to the network.
//
//   https://air.internal/v1/*   → the runtime API, an allowlist of four routes
//                                 forwarded to the control plane with the
//                                 app's runtime token as Bearer.
//   anything else               → exact host match against the list the owner
//                                 approved, else 403 egress_denied (CR7).
//
// `env.params` is set by the Dispatcher from the signed manifest: app,
// owner_ref, principal, role, version, egress (approved hosts), budget_usd
// and token_ref. The runtime token itself is read from RUNTIME_TOKENS, this
// Worker's own KV, under `rt:<token_ref>` — the user Worker never sees it,
// the Dispatcher never holds it, and it is only ever attached toward the
// control plane (CR6). Every `X-Air-*` the user code set is dropped before
// anything leaves; the identity the control plane sees is the one the
// Dispatcher established.
//
// No Supabase, R2, Box, provider or signing credential exists here (CR16).

const AIR_INTERNAL_HOST = "air.internal";
const MODELS = new Set(["fast", "balanced", "deep"]);
const KIB = 1024;
const MIB = 1024 * KIB;
const LIMITS = {
  chat: 256 * KIB,
  state: 256 * KIB,
  actions: 16 * KIB,
  media: 50 * MIB,
};
const RUNTIME_KV_PREFIX = "rt:";

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

function stripAirHeaders(headers) {
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("x-air-")) headers.delete(name);
  }
}

function hostOf(url) {
  return url.hostname.toLowerCase();
}

/**
 * Read the body up to `max` bytes; `undefined` when it is larger. The
 * Content-Length header is trusted when present (it is the user Worker's
 * own request), otherwise the stream is counted while it is buffered.
 */
async function readBounded(request, max) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return undefined;
  if (!request.body) return null;
  const chunks = [];
  let total = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function runtimeToken(env) {
  const ref = env.params?.token_ref;
  if (typeof ref !== "string" || ref.length === 0 || !env.RUNTIME_TOKENS) return null;
  const token = await env.RUNTIME_TOKENS.get(`${RUNTIME_KV_PREFIX}${ref}`);
  return typeof token === "string" && token.startsWith("art_") ? token : null;
}

function controlPlaneHeaders(params, token, request) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  headers.set("authorization", `Bearer ${token}`);
  headers.set("X-Air-App", params.app);
  headers.set("X-Air-Principal", params.principal ?? "");
  headers.set("X-Air-Role", params.role ?? "anon");
  headers.set("X-Air-Version", params.version ?? "");
  return headers;
}

/** The §11.3 allowlist. Anything not named here is 404 on air.internal. */
function runtimeRoute(url, method) {
  const path = url.pathname;
  if (path === "/v1/chat/completions" && method === "POST") {
    return { kind: "chat", target: "/api/gateway/v1/chat/completions", limit: LIMITS.chat };
  }
  if (path === "/v1/state" && (method === "GET" || method === "PUT")) {
    return { kind: "state", target: "/api/functions/state", limit: LIMITS.state };
  }
  if (path === "/v1/actions" && method === "POST") {
    return { kind: "actions", target: "/api/functions/actions", limit: LIMITS.actions };
  }
  if (path === "/v1/media" && method === "POST") {
    return { kind: "media", target: "/api/functions/media", limit: LIMITS.media };
  }
  return null;
}

async function handleRuntime(request, env, url) {
  const params = env.params ?? {};
  const route = runtimeRoute(url, request.method);
  if (!route) {
    const known = ["/v1/chat/completions", "/v1/state", "/v1/actions", "/v1/media"];
    return json(
      { error: known.includes(url.pathname) ? "method_not_allowed" : "not_found" },
      known.includes(url.pathname) ? 405 : 404
    );
  }
  const token = await runtimeToken(env);
  if (!token) return json({ error: "backend_not_enabled" }, 403);

  const body = await readBounded(request, route.limit);
  if (body === undefined) {
    return json({ error: "payload_too_large", limit: route.limit }, 413);
  }

  let outBody = body;
  if (route.kind === "chat") {
    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body ?? new Uint8Array()));
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!parsed || typeof parsed !== "object" || !MODELS.has(parsed.model)) {
      return json({ error: "unknown_model", allowed: [...MODELS] }, 400);
    }
    outBody = new TextEncoder().encode(JSON.stringify(parsed));
  }

  const target = new URL(route.target, env.CONTROL_PLANE_ORIGIN);
  if (route.kind === "state") {
    const resource = url.searchParams.get("resource");
    if (resource) target.searchParams.set("resource", resource);
  }
  const headers = controlPlaneHeaders(params, token, request);
  if (route.kind === "chat") headers.set("content-type", "application/json");

  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: outBody ?? undefined,
    redirect: "manual",
  });
  // Streaming (chat) passes through untouched; the control plane's own
  // headers are what the user Worker sees, minus anything platform-shaped.
  const out = new Headers(response.headers);
  stripAirHeaders(out);
  out.delete("set-cookie");
  out.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers: out });
}

export function egressAllowed(params, host) {
  const approved = Array.isArray(params?.egress) ? params.egress : [];
  return approved.some((h) => typeof h === "string" && h.toLowerCase() === host);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = hostOf(url);

    if (host === AIR_INTERNAL_HOST) return handleRuntime(request, env, url);

    if (url.protocol !== "https:" || !egressAllowed(env.params, host)) {
      return json({ error: "egress_denied", host }, 403);
    }
    const headers = new Headers(request.headers);
    stripAirHeaders(headers);
    return fetch(
      new Request(request, {
        headers,
        redirect: "manual",
      })
    );
  },
};
