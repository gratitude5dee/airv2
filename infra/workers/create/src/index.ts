/**
 * `air-create` (V13 §4.1, §5.3, §11) — the create.wzrd.tech surface:
 *
 *   GET  /v1/health                     readiness probe (§11.3)
 *   POST /v1/jobs                       start a job (CF1): create the
 *                                       Workflow instance (id = job row id)
 *   GET  /v1/jobs/:id?t=<live token>    the mini-app's polling fallback
 *   GET  /v1/jobs/:id/live              WebSocket into the job's OwnerRoom
 *   POST /v1/jobs/:id/events            turn_done callback (CF1)
 *   POST /v1/jobs/:id/cancel            terminate + stop the turn (CF1)
 *   POST /v1/jobs/:id/retry             restart a stuck/failed job (CF1)
 *   cron 17 4 * * *                     dev-link expiry sweep via adapter
 *
 * Inbound mutating routes are CF1-signed. The live and poll routes take the
 * mini-app's live token (HMAC {job,user,exp} under LIVE_TOKEN_SECRET).
 */
import { verifyBridgeRequest } from "./sign";
import { verifyLive } from "./tokens";
import { adapterDevExpire, adapterStopTurn, adapterPost } from "./adapter";
import { CreateJob } from "./workflow";
import { OwnerRoom } from "./room";

export { CreateJob, OwnerRoom };

interface RouteParams {
  request: Request;
  env: Env;
  jobId: string;
}

class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-robots-tag": "noindex" },
  });
}

/** Read the body once and verify the CF1 signature; throws 503/401. */
async function bridgeBody<T extends Record<string, unknown>>(
  request: Request,
  env: Env,
  path: string
): Promise<T> {
  const text = await request.text();
  const verdict = await verifyBridgeRequest(
    request.headers,
    request.method,
    path,
    text,
    env.CREATE_BRIDGE_SECRET
  );
  if (verdict === null) throw new HttpError("bridge not configured", 503);
  if (verdict === false) throw new HttpError("unauthorized", 401);
  return (JSON.parse(text || "{}") ?? {}) as T;
}

async function handleCreateJob({ request, env }: RouteParams): Promise<Response> {
  const body = await bridgeBody<{
    job_id?: string;
    user_id?: string;
    app_id?: string;
    slug?: string;
    appname?: string;
    kind?: string;
    change_file?: string;
  }>(request, env, "/v1/jobs");
  if (
    typeof body.job_id !== "string" ||
    typeof body.user_id !== "string" ||
    typeof body.app_id !== "string" ||
    typeof body.slug !== "string" ||
    typeof body.appname !== "string" ||
    (body.kind !== "initial" && body.kind !== "change")
  ) {
    throw new HttpError("bad job params", 400);
  }
  const instance = await env.CREATE_JOB.create({
    id: body.job_id,
    params: {
      job_id: body.job_id,
      user_id: body.user_id,
      app_id: body.app_id,
      slug: body.slug,
      appname: body.appname,
      kind: body.kind,
      change_file: typeof body.change_file === "string" ? body.change_file : undefined,
    },
  });
  return json({ ok: true, id: instance.id });
}

async function handleEvent({ request, env, jobId }: RouteParams): Promise<Response> {
  const body = await bridgeBody<{ type?: string } & Record<string, unknown>>(
    request,
    env,
    `/v1/jobs/${jobId}/events`
  );
  if (body.type !== "turn_done") throw new HttpError("unknown event", 400);
  const instance = await env.CREATE_JOB.get(jobId);
  await instance.sendEvent({ type: "turn_done", payload: body });
  return json({ ok: true });
}

async function handleCancel({ request, env, jobId }: RouteParams): Promise<Response> {
  const body = await bridgeBody<{ job_id?: string }>(request, env, `/v1/jobs/${jobId}/cancel`);
  if (body.job_id !== undefined && body.job_id !== jobId) throw new HttpError("job mismatch", 400);
  // Stop the in-flight Hermes turn first (§4.4) — the job room knows it.
  const room = env.OWNER_ROOM.get(env.OWNER_ROOM.idFromName(jobId));
  const cancel = (await (
    await room.fetch("https://room/cancel", {
      method: "POST",
      body: JSON.stringify({ job: jobId }),
    })
  ).json()) as { run_id?: string };
  if (typeof cancel.run_id === "string" && cancel.run_id !== "") {
    await adapterStopTurn(env, jobId, cancel.run_id).catch(() => undefined);
  }
  try {
    const instance = await env.CREATE_JOB.get(jobId);
    await instance.terminate();
  } catch {
    /* already gone — the mirror is the row's truth */
  }
  // Mirror the terminal state so the mini-app settles even if the
  // terminate raced the workflow's own writer (CF2 stays job-side; this
  // only ever writes the single fact the cancel endpoint is for).
  await adapterPost(env, "/api/internal/create/facts", {
    job_id: jobId,
    job: { state: "cancelled" },
  }).catch(() => undefined);
  return json({ ok: true });
}

async function handleRetry({ request, env, jobId }: RouteParams): Promise<Response> {
  await bridgeBody(request, env, `/v1/jobs/${jobId}/retry`);
  const instance = await env.CREATE_JOB.get(jobId);
  await instance.restart();
  return json({ ok: true });
}

async function handleLive({ request, env, jobId }: RouteParams): Promise<Response> {
  if (request.headers.get("upgrade") !== "websocket") {
    throw new HttpError("websocket upgrade required", 400);
  }
  // The token arrives as the socket's first message; the room verifies it
  // itself (hibernation needs the DO to own the accept).
  const room = env.OWNER_ROOM.get(env.OWNER_ROOM.idFromName(jobId));
  const url = new URL(request.url);
  url.pathname = "/live";
  url.searchParams.set("job", jobId);
  return room.fetch(new Request(url.toString(), request));
}

async function handlePoll({ request, env, jobId }: RouteParams): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const claims = await verifyLive(env.LIVE_TOKEN_SECRET, token, jobId);
  if (claims === null) return new Response("unauthorized", { status: 401 });
  const room = env.OWNER_ROOM.get(env.OWNER_ROOM.idFromName(jobId));
  const snapshot = (await (
    await room.fetch("https://room/snapshot", {
      method: "POST",
      body: JSON.stringify({ job: jobId }),
    })
  ).json()) as { snapshot: unknown };
  return json(snapshot.snapshot ?? { state: "queued", percent: 0 });
}

async function handleHealth(env: Env): Promise<Response> {
  const checks: Record<string, "ok" | "fail" | "skip"> = {};
  try {
    const room = env.OWNER_ROOM.get(env.OWNER_ROOM.idFromName("health"));
    const ping = await room.fetch("https://room/health", { method: "POST" });
    checks["owner_room"] = ping.ok ? "ok" : "fail";
  } catch {
    checks["owner_room"] = "fail";
  }
  checks["workflow"] = env.CREATE_JOB ? "ok" : "fail";
  checks["browser"] = env.BROWSER ? "ok" : "fail";
  checks["dispatch"] = env.APPS ? "ok" : "fail";
  try {
    const head = await env.MEDIA.head("healthcheck.txt");
    checks["r2"] = head !== null ? "ok" : "skip";
  } catch {
    checks["r2"] = "fail";
  }
  // A signed ping back to Vercel proves the bridge in both directions.
  try {
    const probe = await adapterPost(env, "/api/internal/create/dev-expire", {});
    checks["bridge"] = probe && typeof probe === "object" ? "ok" : "fail";
  } catch {
    checks["bridge"] = "fail";
  }
  const ok = Object.values(checks).every((state) => state !== "fail");
  return json({ ok, checks }, ok ? 200 : 503);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/v1/health") return await handleHealth(env);
      if (url.pathname === "/v1/jobs" && request.method === "POST") {
        return await handleCreateJob({ request, env, jobId: "" });
      }
      const match = /^\/v1\/jobs\/([0-9a-f-]{36})(\/events|\/cancel|\/retry|\/live)?$/.exec(
        url.pathname
      );
      if (match) {
        const jobId = match[1]!;
        const sub = match[2] ?? "";
        const ctx: RouteParams = { request, env, jobId };
        if (sub === "/events" && request.method === "POST") return await handleEvent(ctx);
        if (sub === "/cancel" && request.method === "POST") return await handleCancel(ctx);
        if (sub === "/retry" && request.method === "POST") return await handleRetry(ctx);
        if (sub === "/live") return await handleLive(ctx);
        if (sub === "" && request.method === "GET") return await handlePoll(ctx);
      }
      return new Response("not found", { status: 404 });
    } catch (error) {
      if (error instanceof HttpError) {
        return new Response(error.message, { status: error.status });
      }
      // CF5: content-free log — route + error name, never a body echo.
      console.error(
        JSON.stringify({ msg: "create route error", path: url.pathname, error: error instanceof Error ? error.name : "unknown" })
      );
      return new Response("internal error", { status: 500 });
    }
  },

  /** The daily dev-link expiry sweep (§7.3): adapter revokes by dev_expires_at. */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      adapterDevExpire(env).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            msg: "dev-expire sweep failed",
            error: error instanceof Error ? error.name : "unknown",
          })
        );
      })
    );
  },
};
