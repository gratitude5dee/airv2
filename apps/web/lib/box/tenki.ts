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
import { env } from "../env";
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
export const STOP_WAIT_MS = 5 * 60 * 1000;

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
    client = new TenkiSandbox({ authToken: env.tenkiApiKey() });
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
 * Everything the provider currently holds for a box: at most one live
 * session, plus the snapshots tagged with the box (newest first). The
 * snapshot whose `sessionId` is the live session is a stop in flight; the
 * one the session was created from (`sourceSnapshotId`) is the previous stop.
 */
export interface Resolved {
  session: Session | null;
  snapshots: Snapshot[];
}

async function resolve(boxId: string): Promise<Resolved> {
  const tag = boxTag(boxId);
  try {
    const [sessions, snapshots] = await Promise.all([
      sandbox().list({ tags: [tag] }),
      sandbox().listSnapshots(),
    ]);
    const live = sessions.filter(
      (candidate) =>
        candidate.tags.includes(tag) &&
        mapSessionState(candidate.state) !== "error"
    );
    return {
      session: live[0] ?? null,
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
 * and prune older snapshots. Returns the stopped box, or null when the
 * snapshot is still being written.
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
  await resolved.session?.close().catch(() => undefined);
  await pruneSnapshots(resolved.snapshots, snapshot.id);
  return stoppedBox(boxId, snapshot);
}

async function createSession(
  boxId: string,
  snapshotId: string,
  extra: Partial<Pick<CreateOptions, "env" | "metadata">> = {}
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
  if (resolved.session) return toBox(boxId, resolved.session);
  const snapshot = resolved.snapshots[0];
  if (!snapshot) {
    throw new BoxApiError(404, `tenki: box ${boxId} not found`);
  }
  return stoppedBox(boxId, snapshot);
}

export async function renameBox(boxId: string, name: string): Promise<Box> {
  const current = await session(boxId);
  try {
    const updated = await sandbox().updateSession(current.id, {
      name: name.slice(0, 63),
    });
    return toBox(boxId, updated);
  } catch (error) {
    throw toBoxApiError(error);
  }
}

/**
 * Wake a stopped box: a new session from its newest snapshot (memory and
 * disk restored, so units resume where they were). A live session wins over
 * any stop in flight — the wake aborts the stop and its snapshot is pruned.
 */
export async function resume(boxId: string): Promise<Box> {
  const resolved = await resolve(boxId);
  try {
    if (resolved.session) {
      const pending = stopInFlight(resolved);
      if (pending) await pruneSnapshots([pending], null);
      return toBox(boxId, resolved.session);
    }
    const snapshot = resolved.snapshots[0];
    if (!snapshot) {
      throw new BoxApiError(404, `tenki: box ${boxId} not found`);
    }
    if (snapshot.state !== "READY") {
      throw new BoxApiError(409, `tenki: box ${boxId} is still stopping`);
    }
    const created = await createSession(boxId, snapshot.id);
    return toBox(boxId, created);
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
        name: snapshotName(boxId),
      });
      pending = await sandbox().updateSnapshot(pending.id, {
        tags: [boxTag(boxId)],
      });
      resolved.snapshots.unshift(pending);
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

export async function deleteBox(boxId: string): Promise<void> {
  const resolved = await resolve(boxId);
  try {
    await resolved.session?.close();
    await pruneSnapshots(resolved.snapshots, null);
  } catch (error) {
    const mapped = toBoxApiError(error);
    if (mapped.status === 404) return;
    throw mapped;
  }
}

/** Tenki has no desktop stream API; callers render "unavailable". */
export async function requestDesktop(): Promise<undefined> {
  return undefined;
}

/**
 * Run a shell command as the box user, in its home, under a login shell so
 * the template's ~/.bashrc exports (uv, nvm, PATH) apply as they do on ascii.
 */
export function userCommand(cmd: string): string[] {
  return [
    "sudo",
    "-H",
    "-u",
    TENKI_BOX_USER,
    "bash",
    "-lc",
    `cd ${shellQuote(TENKI_HOME_DIR)}\n${cmd}`,
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
}

function routeFrom(port: ExposedPort): TenkiRoute {
  return { url: port.previewUrl, expiresAt: port.expiresAt };
}

/** A route is reusable when it will still be valid at the next renewal check. */
export function routeIsFresh(
  route: { expiresAt: Date | undefined },
  now = Date.now()
): boolean {
  return (
    route.expiresAt === undefined ||
    route.expiresAt.getTime() - now > ROUTE_RENEW_BEFORE_MS
  );
}

/**
 * The hosted route for a port: the existing preview URL when it is still
 * fresh (exposures survive pause/resume, so the persisted hosted_url stays
 * valid across wakes), otherwise a re-exposure with a new URL.
 */
export async function hostRoute(
  boxId: string,
  port: number
): Promise<TenkiRoute> {
  const current = await session(boxId);
  try {
    const existing = (await current.listExposedPorts()).find(
      (exposed) => exposed.port === port
    );
    if (existing && routeIsFresh(routeFrom(existing))) {
      return routeFrom(existing);
    }
    if (existing) {
      await current.unexposePort(port);
    }
    return routeFrom(await current.exposePort(port, { ttlMs: ROUTE_TTL_MS }));
  } catch (error) {
    throw toBoxApiError(error);
  }
}
