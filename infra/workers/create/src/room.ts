/**
 * OwnerRoom (V13 §4.4, §5.3) — one Durable Object instance per owner for
 * the queue, and one per job for live sockets. Same class, two addresses:
 *
 *   idFromName(user_id) → the queue: {running, queued[{job,app,at}]}
 *   idFromName(job_id)  → the broadcast room: hibernated WebSockets tagged
 *     with the job id plus the last progress snapshot.
 *
 * Queueing: a new job for the app already running is queued; a newer
 * queued job for the same app supersedes the older one (the older one's
 * `admit` poll answers "superseded" and its row goes down that way). Jobs
 * for the owner's other apps wait their turn (D8) — the queue is FIFO
 * across apps, released when the running job finishes.
 *
 * Sockets: `GET /v1/jobs/:id/live` lands on the job-keyed instance still
 * carrying its Upgrade; the first message is the live token, verified
 * against LIVE_TOKEN_SECRET with `job` as a claim; a bad token closes
 * 4401. Origin must be the mini origin (any other origin is rejected
 * before accept).
 */
import { DurableObject } from "cloudflare:workers";
import { verifyLive } from "./tokens";

export interface ProgressBroadcast {
  percent: number;
  step: string;
  detail: string;
  round: number;
  state: string;
  dev_url?: string;
  shot_url?: string;
}

interface QueueEntry {
  job: string;
  app: string;
  at: number;
}

interface QueueState {
  running: QueueEntry | null;
  queued: QueueEntry[];
}

const QUEUE_KEY = "queue";
const SNAPSHOT_KEY = "snapshot";
const RUN_KEY = "run";

export class OwnerRoom extends DurableObject<Env> {
  /** Load or default the owner queue (job-keyed instances never read it). */
  private async queue(): Promise<QueueState> {
    const stored = await this.ctx.storage.get<QueueState>(QUEUE_KEY);
    return stored ?? { running: null, queued: [] };
  }

  /**
   * `POST /admit` {job, app} — the workflow's slot claim. Returns:
   *   start      → the job owns the slot now
   *   wait       → another app is running; poll again
   *   superseded → a newer same-app job replaced this one while queued
   */
  private async admit(jobId: string, appId: string): Promise<{ mode: string }> {
    const state = await this.queue();
    if (state.running?.job === jobId) return { mode: "start" };
    if (await this.ctx.storage.get<boolean>(`superseded:${jobId}`)) {
      return { mode: "superseded" };
    }
    const queued = state.queued.find((entry) => entry.job === jobId);
    if (!queued) {
      // Not running, not queued → first sight: enqueue, honoring supersede.
      // A replaced same-app job is tombstoned so its own admit poll (or a
      // late one) answers "superseded" rather than waiting forever (§4.4).
      const replaced = state.queued.findIndex((entry) => entry.app === appId);
      if (replaced >= 0) {
        const tomb = state.queued.splice(replaced, 1)[0]!;
        await this.ctx.storage.put(`superseded:${tomb.job}`, true);
      }
      if (state.running === null) {
        state.running = { job: jobId, app: appId, at: Date.now() };
        await this.ctx.storage.put(QUEUE_KEY, state);
        return { mode: "start" };
      }
      state.queued.push({ job: jobId, app: appId, at: Date.now() });
      await this.ctx.storage.put(QUEUE_KEY, state);
      return { mode: "wait" };
    }
    if (state.running === null) {
      // Free slot: FIFO across the queue (regardless of app).
      const next = state.queued.shift()!;
      state.running = next;
      await this.ctx.storage.put(QUEUE_KEY, state);
      return { mode: next.job === jobId ? "start" : "wait" };
    }
    return { mode: "wait" };
  }

  /**
   * `POST /release` {job} — running job finished. Pops the oldest queued
   * entry into the running slot so its next `admit` poll sees "start".
   * Returns the new running job id (or null when the queue is empty).
   */
  private async release(jobId: string): Promise<{ running: string | null }> {
    const state = await this.queue();
    if (state.running?.job !== jobId) return { running: null };
    state.queued = state.queued.filter((entry) => entry.job !== jobId);
    const next = state.queued.shift() ?? null;
    state.running = next;
    await this.ctx.storage.put(QUEUE_KEY, state);
    return { running: next?.job ?? null };
  }

  /** `POST /run` {job, run_id} — the Hermes run a cancel must stop. */
  private async setRun(jobId: string, runId: string): Promise<void> {
    await this.ctx.storage.put(`${RUN_KEY}:${jobId}`, runId);
  }
  private async getRun(jobId: string): Promise<string | null> {
    return (await this.ctx.storage.get<string>(`${RUN_KEY}:${jobId}`)) ?? null;
  }

  /**
   * `POST /broadcast` {job, payload} — the workflow's progress write:
   * persists the snapshot on the job-keyed instance and fans it out.
   * Called on the job-keyed instance (this.id.name() === jobId there).
   */
  private async broadcast(payload: ProgressBroadcast): Promise<void> {
    // Percent is monotonic within a job — a late or replayed write can never
    // send the owner's pill backwards.
    const last = await this.ctx.storage.get<{ percent?: number }>(SNAPSHOT_KEY);
    if (typeof payload.percent === "number" && typeof last?.percent === "number") {
      payload = { ...payload, percent: Math.max(payload.percent, last.percent) };
    }
    await this.ctx.storage.put(SNAPSHOT_KEY, { ...payload, at: Date.now() });
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        try {
          socket.close(1011, "send failed");
        } catch {
          /* already closed */
        }
      }
    }
  }

  /** §4.4 cancel: terminate the run row's turn through the adapter. */
  private async cancel(jobId: string): Promise<{ run_id: string | null }> {
    const runId = await this.getRun(jobId);
    const state = await this.queue();
    const wasRunning = state.running?.job === jobId;
    state.queued = state.queued.filter((entry) => entry.job !== jobId);
    if (wasRunning) {
      const next = state.queued.shift() ?? null;
      state.running = next;
    }
    await this.ctx.storage.put(QUEUE_KEY, state);
    return { run_id: runId };
  }

  /** HTTP surface (the fetch handler dispatches by path). */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/live" && request.headers.get("upgrade") === "websocket") {
      const origin = request.headers.get("origin");
      if (origin !== (this.env.MINI_ORIGIN ?? "https://mini.wzrd.tech")) {
        return new Response("bad origin", { status: 403 });
      }
      const pair = new WebSocketPair();
      const jobId = this.ctx.id.name ?? url.searchParams.get("job") ?? "";
      this.ctx.acceptWebSocket(pair[1], [jobId]);
      const snapshot = await this.ctx.storage.get<Record<string, unknown>>(SNAPSHOT_KEY);
      if (snapshot) pair[1].send(JSON.stringify(snapshot));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const jobId = String(body["job"] ?? "");
    switch (url.pathname) {
      case "/admit":
        return Response.json(await this.admit(jobId, String(body["app"] ?? "")));
      case "/release":
        return Response.json(await this.release(jobId));
      case "/run":
        await this.setRun(jobId, String(body["run_id"] ?? ""));
        return Response.json({ ok: true });
      case "/cancel":
        return Response.json(await this.cancel(jobId));
      case "/broadcast":
        await this.broadcast(body["payload"] as ProgressBroadcast);
        return Response.json({ ok: true });
      case "/snapshot": {
        const snapshot = await this.ctx.storage.get<Record<string, unknown>>(SNAPSHOT_KEY);
        return Response.json({ snapshot: snapshot ?? null });
      }
      case "/health":
        return Response.json({ ok: true });
      default:
        return new Response("not found", { status: 404 });
    }
  }

  /**
   * §5.3: the first message on a live socket is the live token. Verify it
   * (job claim = this room's name); a bad token closes 4401 content-free.
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const authed = ws.deserializeAttachment() as { ok?: boolean } | null;
    if (authed?.ok === true) return; // sockets are listen-only after auth
    const token = typeof message === "string" ? message : "";
    const jobId = this.ctx.id.name ?? "";
    const claims = await verifyLive(this.env.LIVE_TOKEN_SECRET, token, jobId);
    if (claims === null) {
      ws.close(4401, "bad token");
      return;
    }
    ws.serializeAttachment({ ok: true });
    const snapshot = await this.ctx.storage.get<Record<string, unknown>>(SNAPSHOT_KEY);
    ws.send(JSON.stringify(snapshot ?? { state: "queued", percent: 0 }));
  }

  async webSocketClose(): Promise<void> {
    // Hibernation API drops the socket bookkeeping on its own.
  }

  async webSocketError(): Promise<void> {
    // Nothing to clean up: the snapshot outlives the socket.
  }
}

export default OwnerRoom;
