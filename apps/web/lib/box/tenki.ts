/**
 * Tenki Sandbox as a second Linux Box provider, behind lib/box/client.ts.
 *
 * A Tenki session is an isolated Linux VM with snapshots (memory and disk),
 * exec, file I/O and provider-managed HTTPS ingress
 * (docs: https://tenki.cloud/docs/sandbox/concepts). This module maps the
 * ascii.dev Box vocabulary onto it so every existing call site — sweeper,
 * wake, fleet sync, mini-apps — works unchanged:
 *
 *   fork          → create from the template snapshot (4 vCPU / 8 GB, sticky:
 *                   our sweeper is the only idle policy, never the provider's)
 *   stop          → snapshot the live VM, then close it
 *   resume        → create a new session from the box's newest snapshot
 *   command       → exec as the `user` account with cwd /home/user
 *   hosted route  → exposePort(8642 | 9119) preview URL
 *   desktop       → lazy in-box noVNC stack + a 6080 preview URL
 *
 * Ids: `tk_<box key>` in boxes.provider_box_id is a stable key we mint at
 * fork; the provider objects behind it (one live session, or a snapshot when
 * stopped) change on every stop/resume and are found by the `air-box:<key>`
 * tag. The key is 24 lowercase hex chars: Tenki tags are capped at 32
 * characters and lowercased, so a uuid would not round-trip. Template
 * pointers are `tenki:<snapshot uuid>`. Anything else stays on ascii.dev.
 *
 * Ingress posture: a preview URL is a capability URL (unguessable host,
 * public, no rotating `_token`), so the hosted-token slot is empty, like the
 * Namespace path. API_SERVER_KEY / dashboard basic auth still gate every
 * request, and the URL never leaves the server (C3).
 */
import { randomBytes } from "node:crypto";
import {
  SandboxError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionTerminatedError,
  TenkiSandbox,
  type CreateOptions,
  type ExposedPort,
  type Session,
  type SessionState,
  type Snapshot,
} from "@tenkicloud/sandbox";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { env } from "../env";
import { serviceClient } from "../supabase";
import { shellQuote } from "./shell";
import {
  BoxApiError,
  START_LIMIT_REACHED,
  type Box,
  type BoxState,
  type CommandResult,
  type ForkOptions,
} from "./types";

export const TENKI_ID_PREFIX = "tk_";
export const TENKI_TEMPLATE_PREFIX = "tenki:";
export const TENKI_BOX_TAG_PREFIX = "air-box:";
/** Provider limit on a session/snapshot tag. */
export const TENKI_TAG_MAX_LENGTH = 32;
export const TENKI_BOX_KEY_BYTES = 12;

/** How long stop() waits for the snapshot before reporting "stopping". */
export const STOP_WAIT_MS = 10_000;

/** The account Hermes and the template run as — the same layout as ascii. */
export const TENKI_BOX_USER = "user";
export const TENKI_HOME_DIR = `/home/${TENKI_BOX_USER}`;

/** Same shape as the ascii.dev default fork (4 vCPU / 8 GB). */
export const TENKI_BOX_SHAPE = {
  cpuCores: 4,
  memoryMb: 8192,
  diskSizeGb: 40,
} as const;

/**
 * Preview URLs expire; the route is re-exposed on wake once it is inside
 * this window, so a persisted hosted_url always outlives the next sweep.
 */
export const ROUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ROUTE_RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

export function isTenkiBoxId(boxId: string): boolean {
  return boxId.startsWith(TENKI_ID_PREFIX);
}

export function isTenkiTemplateRef(templateRef: string): boolean {
  return templateRef.startsWith(TENKI_TEMPLATE_PREFIX);
}

/**
 * Strict form of a template ref a snapshot can actually come from: the
 * `tenki:` prefix plus a non-empty suffix that isn't a `tk_` box/session id
 * — `providerOf` alone accepts all of those, so config validation (the
 * TENKI_TEMPLATE_ID default probe, the tenki fork path) needs this.
 */
export function isTenkiSnapshotRef(templateRef: string): boolean {
  if (!isTenkiTemplateRef(templateRef)) return false;
  const suffix = templateRef.slice(TENKI_TEMPLATE_PREFIX.length).trim();
  return suffix.length > 0 && !isTenkiBoxId(suffix);
}

export function toBoxId(boxKey: string): string {
  return `${TENKI_ID_PREFIX}${boxKey}`;
}

export function newBoxKey(): string {
  return randomBytes(TENKI_BOX_KEY_BYTES).toString("hex");
}

export function toBoxKey(boxId: string): string {
  if (!isTenkiBoxId(boxId)) {
    throw new BoxApiError(400, `${boxId} is not a Tenki box id`);
  }
  return boxId.slice(TENKI_ID_PREFIX.length);
}

export function toSnapshotId(templateRef: string): string {
  if (!isTenkiTemplateRef(templateRef)) {
    throw new BoxApiError(400, `${templateRef} is not a Tenki template ref`);
  }
  return templateRef.slice(TENKI_TEMPLATE_PREFIX.length);
}

/**
 * Tenki session state → the Box state vocabulary callers already branch on.
 * Terminated sessions are "error" so waitForBox fails fast instead of
 * polling a VM that is gone (a stopped box has no session at all — see
 * getBox()).
 */
export function mapSessionState(state: SessionState): BoxState {
  switch (state) {
    case "RUNNING":
      return "ready";
    case "CREATING":
      return "cloning";
    case "RESUMING":
      return "starting";
    case "PAUSING":
      return "stopping";
    case "PAUSED":
      return "stopped";
    case "USER_SHUTDOWN":
    case "TERMINATING":
    case "TERMINATED":
      return "error";
    case "UNSPECIFIED":
      return "provisioned";
  }
}

export function toBox(boxId: string, session: Session): Box {
  return {
    id: boxId,
    state: mapSessionState(session.state),
    url: undefined,
    vcpu: session.cpuCores,
    memoryGB: Math.round(session.memoryMb / 1024),
  };
}

/** Provider errors surface as BoxApiError so isStartLimit & co. keep working. */
export function toBoxApiError(error: unknown): BoxApiError {
  if (error instanceof BoxApiError) return error;
  if (
    error instanceof SessionNotFoundError ||
    error instanceof SessionExpiredError ||
    error instanceof SessionTerminatedError
  ) {
    return new BoxApiError(404, `tenki: ${error.message}`);
  }
  if (error instanceof SandboxError) {
    // The SDK names quota/capacity/port-limit errors by class. Those carry
    // the shared start-limit sentinel so callers defer instead of failing.
    if (/quota|capacity|limit|ratelimited/i.test(error.name)) {
      return new BoxApiError(
        429,
        `tenki ${error.name} (${START_LIMIT_REACHED}): ${error.message}`
      );
    }
    return new BoxApiError(502, `tenki ${error.name}: ${error.message}`);
  }
  return new BoxApiError(
    502,
    `tenki: ${error instanceof Error ? error.message : String(error)}`
  );
}

const decoder = new TextDecoder();

let client: TenkiSandbox | null = null;

function sandbox(): TenkiSandbox {
  if (!client) {
    const authToken = env.tenkiApiKey().trim();
    const baseUrl = process.env["TENKI_API_ENDPOINT"] ||
      process.env["TENKI_API_URL"] || "https://api.tenki.cloud";
    client = new TenkiSandbox({
      authToken,
      baseUrl,
      transport: createGrpcTransport({
        baseUrl,
        defaultTimeoutMs: 15_000,
        interceptors: [(next) => (request) => {
          request.header.set("Authorization", `Bearer ${authToken}`);
          return next(request);
        }],
      }),
    });
  }
  return client;
}

/** Test seam: inject a fake client. */
export function setTenkiClientForTests(next: TenkiSandbox | null): void {
  client = next;
}

/** Tag every session and snapshot of a box carries; the lookup key. */
export function boxTag(boxId: string): string {
  const tag = `${TENKI_BOX_TAG_PREFIX}${toBoxKey(boxId)}`;
  if (tag.length > TENKI_TAG_MAX_LENGTH || tag !== tag.toLowerCase()) {
    throw new BoxApiError(400, `${boxId} does not fit a Tenki tag`);
  }
  return tag;
}

function snapshotName(boxId: string): string {
  return `air-box-${toBoxKey(boxId)}`.slice(0, 63);
}

function isLiveSnapshot(snapshot: Snapshot): boolean {
  return snapshot.state === "CREATING" || snapshot.state === "READY";
}

function newestFirst(a: Snapshot, b: Snapshot): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * Everything the provider currently holds for a box: the live session it
 * should have (plus any duplicates a concurrent wake created), and the
 * snapshots tagged with the box (newest first). The snapshot whose
 * `sessionId` is the live session is a stop in flight; the one the session
 * was created from (`sourceSnapshotId`) is the previous stop.
 */
export interface Resolved {
  session: Session | null;
  /**
   * Extra live sessions for the same box. The winner is the lowest session
   * id, so every process that resolves the box agrees on which one to keep.
   */
  duplicates: Session[];
  snapshots: Snapshot[];
}

function byId(a: Session, b: Session): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

async function resolve(boxId: string): Promise<Resolved> {
  const tag = boxTag(boxId);
  try {
    const [sessions, snapshots] = await Promise.all([
      sandbox().list({ tags: [tag] }),
      sandbox().listSnapshots(),
    ]);
    const live = sessions
      .filter(
        (candidate) =>
          candidate.tags.includes(tag) &&
          mapSessionState(candidate.state) !== "error"
      )
      .sort(byId);
    return {
      session: live[0] ?? null,
      duplicates: live.slice(1),
      snapshots: snapshots
        .filter(
          (snapshot) => snapshot.tags.includes(tag) && isLiveSnapshot(snapshot)
        )
        .sort(newestFirst),
    };
  } catch (error) {
    throw toBoxApiError(error);
  }
}

function stopInFlight(resolved: Resolved): Snapshot | null {
  const live = resolved.session;
  if (!live) return null;
  return (
    resolved.snapshots.find((snapshot) => snapshot.sessionId === live.id) ??
    null
  );
}

/** The live session, or a 404 when the box is stopped or unknown. */
async function session(boxId: string): Promise<Session> {
  const resolved = await resolve(boxId);
  if (!resolved.session) {
    throw new BoxApiError(
      resolved.snapshots.length > 0 ? 409 : 404,
      resolved.snapshots.length > 0
        ? `tenki: box ${boxId} is stopped`
        : `tenki: box ${boxId} not found`
    );
  }
  return resolved.session;
}

/**
 * Drop every snapshot of the box except `keep`. Best effort: a leftover
 * snapshot costs storage, never correctness (resolution picks the newest).
 */
async function pruneSnapshots(
  snapshots: Snapshot[],
  keep: string | null
): Promise<void> {
  await Promise.all(
    snapshots
      .filter((snapshot) => snapshot.id !== keep)
      .map((snapshot) =>
        sandbox()
          .deleteSnapshot(snapshot.id)
          .catch(() => undefined)
      )
  );
}

/** True once the provider no longer reports the snapshot as live. */
async function snapshotGone(snapshotId: string): Promise<boolean> {
  try {
    return !isLiveSnapshot(await sandbox().getSnapshot(snapshotId));
  } catch (error) {
    return toBoxApiError(error).status === 404;
  }
}

/** True once the provider no longer reports the session as live. */
async function sessionGone(sessionId: string): Promise<boolean> {
  try {
    const current = await sandbox().get(sessionId);
    return mapSessionState(current.state) === "error";
  } catch (error) {
    return toBoxApiError(error).status === 404;
  }
}

/**
 * Close a session and confirm the provider agrees it is gone. A close the
 * provider rejected or lost must not read as a stopped box: the VM would
 * keep running (and billing) behind a row the sweeper no longer watches.
 */
async function closeConfirmed(live: Session): Promise<boolean> {
  try {
    await live.close();
    return true;
  } catch {
    return await sessionGone(live.id);
  }
}

/**
 * Close the losers of a concurrent wake; the winner is chosen in resolve().
 * Resolves true only when the provider confirms every loser is gone, so a
 * stop never reads "stopped" while a duplicate is still running.
 */
async function closeDuplicates(duplicates: Session[]): Promise<boolean> {
  const closed = await Promise.all(duplicates.map(closeConfirmed));
  return closed.every(Boolean);
}

/**
 * Delete snapshots and require the provider to agree. Unlike pruneSnapshots
 * this is not best effort: it backs account deletion, where a snapshot left
 * behind is the user's data.
 */
async function deleteSnapshots(snapshots: Snapshot[]): Promise<void> {
  await Promise.all(
    snapshots.map(async (snapshot) => {
      try {
        await sandbox().deleteSnapshot(snapshot.id);
      } catch (error) {
        const mapped = toBoxApiError(error);
        if (mapped.status !== 404 && !(await snapshotGone(snapshot.id))) {
          throw mapped;
        }
      }
    })
  );
}

function stoppedBox(boxId: string, snapshot: Snapshot): Box {
  return {
    id: boxId,
    state: snapshot.state === "READY" ? "stopped" : "stopping",
    url: undefined,
    vcpu: snapshot.cpuCores,
    memoryGB: Math.round(snapshot.memoryMb / 1024),
  };
}

/**
 * Finish a stop whose snapshot is now READY: close the session it came from
 * and prune older snapshots. Returns the stopped box; a box still
 * "stopping" while the snapshot is being written or the close could not be
 * confirmed (so getBox() retries on the next sweep); or null when the
 * snapshot failed.
 */
async function completeStop(
  boxId: string,
  resolved: Resolved,
  pending: Snapshot
): Promise<Box | null> {
  const snapshot = await sandbox().getSnapshot(pending.id);
  if (snapshot.state !== "READY") {
    return snapshot.state === "CREATING" ? stoppedBox(boxId, snapshot) : null;
  }
  const live = resolved.session ? [resolved.session] : [];
  if (!(await closeDuplicates([...live, ...resolved.duplicates]))) {
    return { ...stoppedBox(boxId, snapshot), state: "stopping" };
  }
  await pruneSnapshots(resolved.snapshots, snapshot.id);
  return stoppedBox(boxId, snapshot);
}

async function createSession(
  boxId: string,
  snapshotId: string,
  extra: Partial<Pick<CreateOptions, "name" | "env" | "metadata">> = {}
): Promise<Session> {
  return await sandbox().create({
    name: `air-${toBoxKey(boxId)}`.slice(0, 63),
    snapshotId,
    ...TENKI_BOX_SHAPE,
    allowInbound: true,
    allowOutbound: true,
    // No provider idle pause and no max duration: stop_after + the cron
    // sweeper own the idle policy (a provider pause mid-turn would look
    // exactly like the idle-stop race we coordinate against).
    sticky: true,
    tags: [boxTag(boxId)],
    waitReady: false,
    ...extra,
  });
}

export async function fork(options: ForkOptions): Promise<Box> {
  const boxId = toBoxId(newBoxKey());
  try {
    const created = await createSession(boxId, toSnapshotId(options.templateId), {
      env: options.env,
      metadata: {
        air: "box",
        ...(options.env["TENANT_ID"]
          ? { tenant_id: options.env["TENANT_ID"] }
          : {}),
      },
    });
    return toBox(boxId, created);
  } catch (error) {
    throw toBoxApiError(error);
  }
}

export async function getBox(boxId: string): Promise<Box> {
  const resolved = await resolve(boxId);
  const pending = stopInFlight(resolved);
  if (resolved.session && pending) {
    try {
      const stopped = await completeStop(boxId, resolved, pending);
      if (stopped) return stopped;
    } catch (error) {
      throw toBoxApiError(error);
    }
  }
  if (resolved.session) {
    await closeDuplicates(resolved.duplicates);
    return toBox(boxId, resolved.session);
  }
  const snapshot = resolved.snapshots[0];
  if (!snapshot) {
    throw new BoxApiError(404, `tenki: box ${boxId} not found`);
  }
  return stoppedBox(boxId, snapshot);
}

export async function renameBox(boxId: string, name: string): Promise<Box> {
  boxTag(boxId);
  try {
    const label = name.slice(0, 63);
    const { error } = await serviceClient()
      .from("boxes")
      .update({ provider_name: label })
      .eq("provider_box_id", boxId)
      .select("provider_box_id")
      .single();
    if (error) throw new Error(`box label persistence failed: ${error.message}`);
    const resolved = await resolve(boxId);
    const live = resolved.session ? [resolved.session, ...resolved.duplicates] : [];
    await Promise.all([
      ...live.map((current) => sandbox().updateSession(current.id, { name: label })),
      ...resolved.snapshots.map((snapshot) => sandbox().updateSnapshot(snapshot.id, { name: label })),
    ]);
    if (resolved.session) return toBox(boxId, resolved.session);
    if (resolved.snapshots[0]) return stoppedBox(boxId, resolved.snapshots[0]);
    throw new BoxApiError(404, `tenki: box ${boxId} not found`);
  } catch (error) {
    throw toBoxApiError(error);
  }
}

async function savedName(boxId: string): Promise<string | null> {
  const { data, error } = await serviceClient()
    .from("boxes")
    .select("provider_name")
    .eq("provider_box_id", boxId)
    .maybeSingle();
  if (error?.code === "42703") return null;
  if (error) throw new Error(`box label lookup failed: ${error.message}`);
  return typeof data?.provider_name === "string" ? data.provider_name : null;
}

/** Wakes in flight in this process, so overlapping callers share one create. */
const resumesInFlight = new Map<string, Promise<Box>>();

/**
 * Wake a stopped box: a new session from its newest snapshot (memory and
 * disk restored, so units resume where they were). A live session wins over
 * any stop in flight — the wake aborts the stop and its snapshot is pruned;
 * the wake only reads ready once the provider confirms that snapshot is
 * gone, otherwise the next getBox() would finish the stop and close the VM.
 *
 * Two wakes can still race across processes (prewarm and a turn); both
 * create a session, then re-resolve and keep the same winner, closing the
 * loser.
 */
export async function resume(boxId: string): Promise<Box> {
  const inFlight = resumesInFlight.get(boxId);
  if (inFlight) return inFlight;
  const wake = resumeOnce(boxId).finally(() => {
    resumesInFlight.delete(boxId);
  });
  resumesInFlight.set(boxId, wake);
  return wake;
}

async function resumeOnce(boxId: string): Promise<Box> {
  const resolved = await resolve(boxId);
  try {
    if (resolved.session) {
      const pending = stopInFlight(resolved);
      if (pending) {
        await pruneSnapshots([pending], null);
        if (!(await snapshotGone(pending.id))) {
          throw new BoxApiError(
            409,
            `tenki: box ${boxId} has a stop in flight that could not be cancelled`
          );
        }
      }
      await closeDuplicates(resolved.duplicates);
      return toBox(boxId, resolved.session);
    }
    const snapshot = resolved.snapshots[0];
    if (!snapshot) {
      throw new BoxApiError(404, `tenki: box ${boxId} not found`);
    }
    if (snapshot.state !== "READY") {
      throw new BoxApiError(409, `tenki: box ${boxId} is still stopping`);
    }
    const name = (await savedName(boxId)) ?? snapshot.name;
    const created = await createSession(boxId, snapshot.id, name ? { name } : {});
    const settled = await resolve(boxId);
    const winner = settled.session ?? created;
    await closeDuplicates(
      winner.id === created.id
        ? settled.duplicates
        : [created, ...settled.duplicates.filter((s) => s.id !== created.id)]
    );
    const latestName = await savedName(boxId);
    if (latestName && winner.name !== latestName) {
      await sandbox().updateSession(winner.id, { name: latestName });
    }
    return toBox(boxId, winner);
  } catch (error) {
    throw toBoxApiError(error);
  }
}

/**
 * Stop = snapshot the live VM, then close it. Not pause: on the provider a
 * pause of a session with more than a few GB written outruns the guest
 * liveness window and TERMINATES the VM (reproduced with a 6 GB dd, no Air
 * software involved), whereas an async snapshot of a running session
 * completes in seconds and restores in ~2 s. Waits a bounded time for the
 * snapshot; if it is still being written the box reads "stopping" and the
 * next getBox() finishes the close.
 */
export async function stop(boxId: string): Promise<Box> {
  const resolved = await resolve(boxId);
  const snapshot = resolved.snapshots[0];
  if (!resolved.session) {
    if (!snapshot) {
      throw new BoxApiError(404, `tenki: box ${boxId} not found`);
    }
    return stoppedBox(boxId, snapshot);
  }
  try {
    let pending = stopInFlight(resolved);
    if (!pending) {
      pending = await sandbox().createSnapshotAsync(resolved.session.id, {
        name: (await savedName(boxId)) ?? snapshotName(boxId),
      });
      pending = await sandbox().updateSnapshot(pending.id, {
        tags: [boxTag(boxId)],
      });
      resolved.snapshots.unshift(pending);
      const latestName = await savedName(boxId);
      if (latestName && pending.name !== latestName) {
        pending = await sandbox().updateSnapshot(pending.id, { name: latestName });
      }
    }
    await sandbox()
      .waitSnapshotReady(pending.id, STOP_WAIT_MS)
      .catch(() => undefined);
    const stopped = await completeStop(boxId, resolved, pending);
    if (stopped) return stopped;
    throw new BoxApiError(502, `tenki: snapshot for ${boxId} failed`);
  } catch (error) {
    throw toBoxApiError(error);
  }
}

/**
 * Remove everything the provider holds for a box. Account deletion records
 * success on return, so every close and snapshot deletion must be confirmed
 * and the box re-read as empty; anything left behind is an error.
 */
export async function deleteBox(boxId: string): Promise<void> {
  const resolved = await resolve(boxId);
  try {
    const live = resolved.session ? [resolved.session] : [];
    if (!(await closeDuplicates([...live, ...resolved.duplicates]))) {
      throw new BoxApiError(502, `tenki: box ${boxId} session could not be closed`);
    }
    await deleteSnapshots(resolved.snapshots);
  } catch (error) {
    throw toBoxApiError(error);
  }
  const remaining = await resolve(boxId);
  if (remaining.session || remaining.snapshots.length > 0) {
    throw new BoxApiError(502, `tenki: box ${boxId} still has provider resources`);
  }
}

/**
 * Tenki has no platform desktop endpoint, so the stream is the box's own
 * noVNC stack: the first request lazily installs Xvfb + openbox + x11vnc +
 * websockify inside the box and starts them on :0/5900/6080, then a preview
 * URL on the noVNC port is minted by hostRoute. The preview URL is the only
 * credential — the same capability-URL posture as every other hosted route,
 * and like the ascii stream URL it never leaves the server (lib/box/desktop.ts).
 *
 * :0 is also the display the headed agent browser targets (DISPLAY=:0 in
 * ~/.hermes/.env), so installing the stack gives it a real X server on boxes
 * whose template predates it.
 */
export const DESKTOP_WEB_PORT = 6080;
const DESKTOP_VNC_PORT = 5900;

/**
 * Desktop routes get a much shorter TTL than hosted service routes: the URL
 * is the only auth on the viewer, so a leaked link should die in hours, not
 * the 30-day hosted-route window.
 */
export const DESKTOP_ROUTE_TTL_MS = 60 * 60 * 1000;
const DESKTOP_ROUTE_RENEW_MS = 10 * 60 * 1000;

/**
 * The VNC credential is exactly 8 alphanumeric chars — RFB auth truncates at
 * 8 bytes, so anything longer is dead entropy.
 */
const DESKTOP_SECRET_GEN = `tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 8`;
const DESKTOP_PASSWD_BLOCK = `mkdir -p "$HOME/.vnc" && chmod 700 "$HOME/.vnc"
if [ ! -s "$HOME/.vnc/passwd" ] || [ ! -s "$HOME/.air-desktop-secret" ]; then
  PASS=$(${DESKTOP_SECRET_GEN})
  x11vnc -storepasswd "$PASS" "$HOME/.vnc/passwd"
  printf %s "$PASS" > "$HOME/.air-desktop-secret"; chmod 600 "$HOME/.air-desktop-secret"
fi`;
const X11VNC_START = `setsid nohup x11vnc -display :0 -localhost -forever -shared -rfbauth "$HOME/.vnc/passwd" -rfbport ${DESKTOP_VNC_PORT} 9>&- >/tmp/air-x11vnc.log 2>&1 </dev/null`;

/**
 * Idempotent ensure: install the stack if absent, start whatever is not
 * running, then wait for the web port to accept. flock serializes the
 * concurrent requests a first view can trigger (stream URL + origin probe).
 * Everything runs detached so the exec's process tree going away cannot
 * take the daemons with it — and every detached command closes fd 9,
 * otherwise the daemon would inherit the lock and pin it forever.
 * The VNC password is generated once; the caller reads it separately so
 * installer output can never contaminate it.
 */
const DESKTOP_ENSURE_SCRIPT = `set -euo pipefail
exec 9>"$HOME/.air-desktop.lock"
flock -w 280 9
if ! command -v Xvfb >/dev/null 2>&1 || ! command -v x11vnc >/dev/null 2>&1 || ! command -v websockify >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \\
    xvfb openbox x11vnc novnc websockify dbus-x11
fi
${DESKTOP_PASSWD_BLOCK}
pgrep -x Xvfb >/dev/null 2>&1 || setsid nohup Xvfb :0 -screen 0 1280x800x24 9>&- >/tmp/air-xvfb.log 2>&1 </dev/null &
for i in $(seq 1 50); do [ -S /tmp/.X11-unix/X0 ] && break; sleep 0.2; done
[ -S /tmp/.X11-unix/X0 ] || { echo "no X display" >&2; exit 1; }
pgrep -x openbox >/dev/null 2>&1 || setsid nohup env DISPLAY=:0 openbox 9>&- >/tmp/air-openbox.log 2>&1 </dev/null &
pgrep -f 'x11vnc .*${DESKTOP_VNC_PORT}' >/dev/null 2>&1 || ${X11VNC_START} &
pgrep -f 'websockify .*${DESKTOP_WEB_PORT}' >/dev/null 2>&1 || setsid nohup websockify --web /usr/share/novnc ${DESKTOP_WEB_PORT} localhost:${DESKTOP_VNC_PORT} 9>&- >/tmp/air-novnc.log 2>&1 </dev/null &
for i in $(seq 1 50); do (echo > "/dev/tcp/127.0.0.1/${DESKTOP_WEB_PORT}") 2>/dev/null && break; sleep 0.2; done
(echo > "/dev/tcp/127.0.0.1/${DESKTOP_WEB_PORT}") 2>/dev/null || { echo "noVNC did not start" >&2; exit 1; }`;

/**
 * Rotating the VNC password ties its lifetime to the route's: run when the
 * preview route re-mints, so a leaked URL+password pair dies with the route
 * instead of unlocking every later route. Restarts x11vnc under the same
 * lock so no request can read a half-updated pair.
 */
const DESKTOP_ROTATE_SCRIPT = `set -euo pipefail
exec 9>"$HOME/.air-desktop.lock"
flock -w 60 9
PASS=$(${DESKTOP_SECRET_GEN})
x11vnc -storepasswd "$PASS" "$HOME/.vnc/passwd"
printf %s "$PASS" > "$HOME/.air-desktop-secret"; chmod 600 "$HOME/.air-desktop-secret"
pkill -f 'x11vnc .*${DESKTOP_VNC_PORT}' || true
${X11VNC_START} &
sleep 1`;

const DESKTOP_SECRET_READ = 'cat "$HOME/.air-desktop-secret" 2>/dev/null || true';

/**
 * A noVNC viewer URL on the box's 6080 preview route, or undefined when the
 * stack cannot be brought up (callers render "unavailable"/"waking"). The
 * URL carries the box's VNC password — rotated whenever the route itself
 * re-mints, so a leaked link is short-lived and a leaked password dies with
 * it. The `vnc` option from the ascii contract is moot — noVNC is the only
 * streamer — so both modes return it.
 */
export async function requestDesktop(
  boxId: string
): Promise<string | undefined> {
  const ensure = await command(boxId, DESKTOP_ENSURE_SCRIPT, 300);
  if (ensure.exitCode !== 0) {
    console.log(
      JSON.stringify({
        msg: "tenki desktop ensure failed",
        box_id: boxId,
        exit_code: ensure.exitCode,
        stderr: ensure.stderr.trim().slice(0, 500),
      })
    );
    return undefined;
  }
  const route = await hostRoute(boxId, DESKTOP_WEB_PORT, {
    ttlMs: DESKTOP_ROUTE_TTL_MS,
    renewBeforeMs: DESKTOP_ROUTE_RENEW_MS,
  });
  if (route.rotated) {
    const rotated = await command(boxId, DESKTOP_ROTATE_SCRIPT, 90);
    if (rotated.exitCode !== 0) {
      console.log(
        JSON.stringify({
          msg: "tenki desktop password rotation failed",
          box_id: boxId,
          exit_code: rotated.exitCode,
          stderr: rotated.stderr.trim().slice(0, 500),
        })
      );
      return undefined;
    }
  }
  const secret = (await command(boxId, DESKTOP_SECRET_READ, 15)).stdout.trim();
  if (!secret) {
    console.log(
      JSON.stringify({ msg: "tenki desktop secret missing", box_id: boxId })
    );
    return undefined;
  }
  const base = route.url.endsWith("/") ? route.url.slice(0, -1) : route.url;
  return `${base}/vnc.html?autoconnect=true&resize=scale&password=${encodeURIComponent(secret)}`;
}

/**
 * Run as the box user with the tool PATH captured by template setup/sync.
 * Older templates fall back to their login shell.
 */
export function userCommand(cmd: string): string[] {
  return [
    "sudo",
    "-H",
    "-u",
    TENKI_BOX_USER,
    "bash",
    "--noprofile",
    "--norc",
    "-c",
    `if [ -r "$HOME/.air/command-env.sh" ]; then\n` +
      `. "$HOME/.air/command-env.sh"\n` +
      `cd ${shellQuote(TENKI_HOME_DIR)}\n${cmd}\n` +
      `else\nexec bash -lc ${shellQuote(`cd ${shellQuote(TENKI_HOME_DIR)}\n${cmd}`)}\nfi`,
  ];
}

export async function command(
  boxId: string,
  cmd: string,
  timeoutSeconds = 60
): Promise<CommandResult> {
  const current = await session(boxId);
  const [program, ...args] = userCommand(cmd);
  try {
    const result = await current.exec(program ?? "sudo", {
      args,
      timeoutMs: timeoutSeconds * 1000,
    });
    // Raw decode, not the SDK's stdoutText(): that trims, and readFile
    // round-trips file bytes through stdout.
    return {
      exitCode: result.exitCode,
      stdout: decoder.decode(result.stdout),
      stderr: decoder.decode(result.stderr),
    };
  } catch (error) {
    if (error instanceof SandboxError && error.name === "CommandTimeoutError") {
      return {
        exitCode: 124,
        stdout: "",
        stderr: `command timed out after ${timeoutSeconds}s`,
      };
    }
    throw toBoxApiError(error);
  }
}

/** Relative paths resolve against the box user's home, as on ascii. */
export function absolutePath(path: string): string {
  return path.startsWith("/") ? path : `${TENKI_HOME_DIR}/${path}`;
}

/**
 * Write via the shell as the box user: the provider's file API runs as the
 * VM's default account, which would leave root-owned files under /home/user.
 * Content travels base64-encoded so no byte of it is shell-interpreted.
 */
export function writeFileCommand(path: string, content: string): string {
  const target = shellQuote(absolutePath(path));
  const encoded = Buffer.from(content, "utf8").toString("base64");
  return `mkdir -p "$(dirname ${target})" && printf %s ${shellQuote(encoded)} | base64 -d > ${target}`;
}

export async function writeFile(
  boxId: string,
  path: string,
  content: string
): Promise<void> {
  const result = await command(boxId, writeFileCommand(path, content), 60);
  if (result.exitCode !== 0) {
    throw new BoxApiError(
      500,
      `writeFile ${path}: exit ${result.exitCode}: ${result.stderr.trim()}`
    );
  }
}

export interface TenkiRoute {
  url: string;
  expiresAt: Date | undefined;
  /** True when the URL was just minted (not a reused exposure). */
  rotated: boolean;
}

function routeFrom(port: ExposedPort, rotated = false): TenkiRoute {
  return { url: port.previewUrl, expiresAt: port.expiresAt, rotated };
}

/** A route is reusable when it will still be valid at the next renewal check. */
export function routeIsFresh(
  route: { expiresAt: Date | undefined },
  now = Date.now(),
  renewBeforeMs = ROUTE_RENEW_BEFORE_MS
): boolean {
  return (
    route.expiresAt === undefined ||
    route.expiresAt.getTime() - now > renewBeforeMs
  );
}

/**
 * The hosted route for a port: the existing preview URL when it is still
 * fresh (exposures survive pause/resume, so the persisted hosted_url stays
 * valid across wakes), otherwise a re-exposure with a new URL. ttlMs /
 * renewBeforeMs override the 30d/7d defaults for routes that should be
 * short-lived (the desktop stream).
 */
export async function hostRoute(
  boxId: string,
  port: number,
  options: { ttlMs?: number; renewBeforeMs?: number } = {}
): Promise<TenkiRoute> {
  const ttlMs = options.ttlMs ?? ROUTE_TTL_MS;
  const renewBeforeMs = options.renewBeforeMs ?? ROUTE_RENEW_BEFORE_MS;
  const current = await session(boxId);
  try {
    const existing = (await current.listExposedPorts()).find(
      (exposed) => exposed.port === port
    );
    if (existing && routeIsFresh(routeFrom(existing), Date.now(), renewBeforeMs)) {
      return routeFrom(existing);
    }
    if (existing) {
      await current.unexposePort(port);
    }
    return routeFrom(await current.exposePort(port, { ttlMs }), true);
  } catch (error) {
    throw toBoxApiError(error);
  }
}
