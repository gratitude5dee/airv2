/**
 * Typed wrapper over the Box (ascii.dev) API. All Box calls in the control
 * plane go through this module — no direct fetch from route handlers.
 *
 * Every user fork passes `noEnv: true` (C1) plus a per-box env carrying at
 * minimum TENANT_ID and GATEWAY_TOKEN (goal.md §5). Never `stop` with
 * `force: true` (C6).
 *
 * Provider dispatch: ids prefixed `tk_` (and template refs `tenki:`) route to
 * the Tenki Sandbox adapter in ./tenki.ts; everything else is ascii.dev. The
 * exported surface is provider-neutral so callers never branch on provider.
 */
import { z } from "zod";
import { env } from "../env";
import { requestSignal } from "../http/timeout";
import { shellQuote } from "./shell";
import * as tenki from "./tenki";
import {
  BoxApiError,
  BoxSchema,
  type Box,
  type CommandResult,
  type ForkOptions,
} from "./types";

export { BoxApiError } from "./types";
export type { Box, BoxState, CommandResult, ForkOptions } from "./types";

/** Which provider owns a box id or template ref. */
export type BoxProvider = "ascii" | "tenki";

export function providerOf(idOrTemplateRef: string): BoxProvider {
  return tenki.isTenkiBoxId(idOrTemplateRef) ||
    tenki.isTenkiTemplateRef(idOrTemplateRef)
    ? "tenki"
    : "ascii";
}

/** Response of POST /boxes/{id}/desktop (docs.ascii.dev/box/desktop-streaming).
 * `desktopUrl` is a secret-bearing desktop stream URL. Server-side only —
 * never persist, never return to a client in JSON (lib/box/desktop.ts). */
const DesktopEnvelopeSchema = z.object({
  ok: z.boolean().optional(),
  success: z.boolean().optional(),
  desktopUrl: z.string().optional(),
});

/** Every /boxes/* mutation returns this envelope. */
const BoxEnvelopeSchema = z.object({
  ok: z.boolean().optional(),
  id: z.string().optional(),
  box: BoxSchema,
});

/**
 * Provider-side auto-stop backstop. Our own sweeper stops idle boxes within
 * minutes; this TTL only exists so a sweeper outage can't leave a box
 * burning for the 30-day provider maximum. It must be long enough that the
 * provider never kills an actively working box mid-turn (the default fork
 * TTL of 1 hour counts from start, not last activity, and would).
 */
export const BOX_TTL_SECONDS = 24 * 60 * 60;

/** Box returns 429 with this code when platform start ceilings are hit. */
export const START_LIMIT_REACHED = "start_limit_reached";

export function isStartLimit(error: unknown): boolean {
  return (
    error instanceof BoxApiError &&
    error.status === 429 &&
    error.message.includes(START_LIMIT_REACHED)
  );
}

/** Box control-plane calls answer fast; forks/resumes are async server-side. */
const BOX_REQUEST_TIMEOUT_MS = 60_000;

async function boxFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit & { timeoutMs?: number }
): Promise<z.output<S>> {
  const response = await fetch(`${env.boxApiBase()}${path}`, {
    ...init,
    signal: requestSignal(
      init?.timeoutMs ?? BOX_REQUEST_TIMEOUT_MS,
      init?.signal
    ),
    headers: {
      Authorization: `Bearer ${env.boxApiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new BoxApiError(response.status, body.slice(0, 500));
  }
  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new BoxApiError(
      502,
      `unexpected response shape from ${path}: ${parsed.error.message.slice(0, 300)}`
    );
  }
  return parsed.data;
}

const requiredForkEnv = ["TENANT_ID", "GATEWAY_TOKEN"] as const;

export async function fork(options: ForkOptions): Promise<Box> {
  for (const key of requiredForkEnv) {
    if (!options.env[key]) {
      throw new Error(`fork: per-box env is missing ${key}`);
    }
  }
  if (providerOf(options.templateId) === "tenki") {
    return tenki.fork(options);
  }
  const envelope = await boxFetch(
    `/boxes/${options.templateId}/fork`,
    BoxEnvelopeSchema,
    {
      method: "POST",
      body: JSON.stringify({
        noEnv: true,
        env: options.env,
        ttlSeconds:
          options.ttlSeconds !== undefined
            ? options.ttlSeconds
            : BOX_TTL_SECONDS,
        ...(options.size ? { size: options.size } : {}),
      }),
    }
  );
  return envelope.box;
}

/** Set the box's display name in the ascii dashboard (max 120 chars). */
export async function renameBox(boxId: string, name: string): Promise<Box> {
  if (providerOf(boxId) === "tenki") return tenki.renameBox(boxId, name);
  const envelope = await boxFetch(`/boxes/${boxId}`, BoxEnvelopeSchema, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return envelope.box;
}

export async function resume(boxId: string): Promise<Box> {
  if (providerOf(boxId) === "tenki") return tenki.resume(boxId);
  const envelope = await boxFetch(`/boxes/${boxId}/resume`, BoxEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify({ ttlSeconds: BOX_TTL_SECONDS }),
  });
  return envelope.box;
}

/** Never pass force — a refused stop means the snapshot is failing (C6). */
export async function stop(boxId: string): Promise<Box> {
  if (providerOf(boxId) === "tenki") return tenki.stop(boxId);
  const envelope = await boxFetch(`/boxes/${boxId}/stop`, BoxEnvelopeSchema, {
    method: "POST",
  });
  return envelope.box;
}

/**
 * Deleting a box deletes its snapshots with it (goal.md M8). The API refuses
 * (409 delete_confirmation_required) unless the target id is echoed in
 * X-Ascii-Confirm-Delete.
 */
export async function deleteBox(boxId: string): Promise<void> {
  if (providerOf(boxId) === "tenki") return tenki.deleteBox(boxId);
  await boxFetch(`/boxes/${boxId}`, z.unknown(), {
    method: "DELETE",
    headers: { "X-Ascii-Confirm-Delete": boxId },
  });
}

/**
 * Ask Box for a fresh authenticated desktop stream URL. Default is the
 * Moonlight (WebRTC) viewer; pass vnc for the HTTPS-tunneled noVNC viewer
 * (more tolerant of restrictive networks, must open as a top-level page).
 */
export async function requestDesktop(
  boxId: string,
  options?: { vnc?: boolean }
): Promise<string | undefined> {
  if (providerOf(boxId) === "tenki") return tenki.requestDesktop();
  const query = options?.vnc ? "?vnc=1" : "?theme=light";
  const envelope = await boxFetch(
    `/boxes/${boxId}/desktop${query}`,
    DesktopEnvelopeSchema,
    { method: "POST" }
  );
  if (!envelope.ok || envelope.success === false) return undefined;
  return envelope.desktopUrl;
}

export async function getBox(boxId: string): Promise<Box> {
  if (providerOf(boxId) === "tenki") return tenki.getBox(boxId);
  const envelope = await boxFetch(`/boxes/${boxId}`, BoxEnvelopeSchema);
  return envelope.box;
}

/** Poll until the box reaches ready/idle. */
export async function waitForBox(
  boxId: string,
  timeoutMs = env.boxReadyTimeoutMs()
): Promise<Box> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const box = await getBox(boxId);
    if (box.state === "ready" || box.state === "idle") return box;
    if (box.state === "error") {
      throw new BoxApiError(500, `box ${boxId} entered error state`);
    }
    if (Date.now() > deadline) {
      throw new BoxApiError(504, `box ${boxId} not ready after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

export async function command(
  boxId: string,
  cmd: string,
  timeoutSeconds = 60
): Promise<CommandResult> {
  if (providerOf(boxId) === "tenki") {
    return tenki.command(boxId, cmd, timeoutSeconds);
  }
  // The box-side command runs up to timeoutSeconds; give the HTTP round
  // trip that budget plus margin.
  const result = await boxFetch(
    `/boxes/${boxId}/commands`,
    AsciiCommandResultSchema,
    {
      method: "POST",
      body: JSON.stringify({ command: cmd, timeoutSeconds }),
      timeoutMs: (timeoutSeconds + 60) * 1000,
    }
  );
  // A command ascii.dev killed at timeoutSeconds reports exitCode null
  // (timedOut true); surface it like a shell `timeout` (124) so callers see
  // one shape across providers instead of a response-parse failure.
  if (result.exitCode === null) {
    return {
      exitCode: 124,
      stdout: result.stdout,
      stderr:
        result.stderr || `command timed out after ${timeoutSeconds}s`,
    };
  }
  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

const AsciiCommandResultSchema = z.object({
  exitCode: z.number().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  timedOut: z.boolean().optional(),
});

/** A hosted route to a port on the box; token is "" where ingress has none. */
export interface HostedRoute {
  url: string;
  token: string;
}

/** `https://<sub>-<port>.on.ascii.dev?_token=<token>` lines from `.ascii/host`. */
const ASCII_HOSTED_URL_PATTERN =
  /^(https:\/\/[a-z0-9-]+-(\d+)\.on\.ascii\.dev)\?_token=([A-Za-z0-9._-]+)$/;

export function parseAsciiHostedUrl(
  stdout: string,
  port: number
): HostedRoute {
  for (const line of stdout.split("\n")) {
    const match = ASCII_HOSTED_URL_PATTERN.exec(line.trim());
    if (match?.[1] && match[3] && Number(match[2]) === port) {
      return { url: match[1], token: match[3] };
    }
  }
  throw new BoxApiError(
    502,
    `hosted URL for port ${port} not found in host output`
  );
}

/**
 * Publish (or re-read) the hosted route for a port. On ascii this runs the
 * box-side `.ascii/host` client, whose token rotates across stop/resume; on
 * Tenki it is a provider API call and the URL is stable across wakes.
 */
export async function hostRoute(
  boxId: string,
  port: number,
  options?: { timeoutSeconds?: number }
): Promise<HostedRoute> {
  if (providerOf(boxId) === "tenki") {
    const route = await tenki.hostRoute(boxId, port);
    return { url: route.url, token: "" };
  }
  const timeoutSeconds = options?.timeoutSeconds ?? 180;
  const result = await command(
    boxId,
    `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url ${port} --timeout 120 --private`,
    timeoutSeconds
  );
  if (result.exitCode !== 0) {
    throw new BoxApiError(
      502,
      `host registration for port ${port} failed: ${result.stderr.slice(0, 300)}`
    );
  }
  return parseAsciiHostedUrl(result.stdout, port);
}

/**
 * Probe for the provider's post-resume restore: while the snapshot is being
 * hydrated, /home/user is a FUSE mount that the platform swaps out for the
 * real disk once done, killing every process with a cwd or open file under
 * it. Prints HYDRATING while the mount is up, STEADY once it is gone.
 */
export const HOME_STEADY_PROBE =
  "mountpoint -q /home/user && echo HYDRATING || echo STEADY";

/**
 * Block until the home tree has settled onto the real disk. The box reports
 * ready as soon as the mount is browsable, so anything long-running started
 * before this returns can die part-way through.
 */
export async function waitForHomeSteady(
  boxId: string,
  timeoutMs = 240_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probe = await command(boxId, HOME_STEADY_PROBE, 20);
    if (probe.exitCode === 0 && probe.stdout.trim() === "STEADY") return;
    if (Date.now() > deadline) {
      throw new BoxApiError(
        504,
        `box ${boxId} home still hydrating after ${timeoutMs}ms`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

/** `cat` in the C locale so ENOENT has one spelling regardless of the Box's LANG. */
export function readFileCommand(path: string): string {
  return `LC_ALL=C cat ${shellQuote(path)}`;
}

/**
 * `cat: <path>: No such file or directory` — strerror(ENOENT) in the C locale
 * (coreutils and busybox alike), anchored to the end so the path itself
 * can't spell it.
 */
const ENOENT_MESSAGE = /: No such file or directory\s*$/;

/**
 * Only ENOENT is a 404; any other failure (permission denied on the file or
 * a parent, I/O error, killed, timed out) is a 500 so read-modify-write
 * callers don't mistake an unreadable file for an empty one.
 */
export function classifyReadFile(path: string, result: CommandResult): string {
  if (result.exitCode === 0) return result.stdout;
  if (result.exitCode === 1 && ENOENT_MESSAGE.test(result.stderr)) {
    throw new BoxApiError(404, `readFile ${path}: ${result.stderr.trim()}`);
  }
  throw new BoxApiError(
    500,
    `readFile ${path}: exit ${result.exitCode}: ${result.stderr.trim()}`
  );
}

/** Reads via the command endpoint; the files API is write-oriented. */
export async function readFile(boxId: string, path: string): Promise<string> {
  return classifyReadFile(path, await command(boxId, readFileCommand(path)));
}

export async function writeFile(
  boxId: string,
  path: string,
  content: string
): Promise<void> {
  if (providerOf(boxId) === "tenki") {
    return tenki.writeFile(boxId, path, content);
  }
  await boxFetch(`/boxes/${boxId}/files`, z.unknown(), {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });
}
