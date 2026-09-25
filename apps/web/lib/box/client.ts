/**
 * Typed wrapper over the Box (ascii.dev) API. All Box calls in the control
 * plane go through this module — no direct fetch from route handlers.
 *
 * Every user fork passes `noEnv: true` (C1) plus a per-box env carrying at
 * minimum TENANT_ID and GATEWAY_TOKEN (goal.md §5). Never `stop` with
 * `force: true` (C6).
 *
 * Provider dispatch: ids prefixed `tk_` (and template refs `tenki:`) route to
 * the Tenki Sandbox adapter in ./tenki.ts; everything else is ascii.dev. Both
 * implement the shared BoxProvider interface from ./types.ts — the same one
 * lib/namespace's adapter implements — so callers never branch on provider.
 * Provisioning (fork) and provider extras (renameBox, hostRoute options) stay
 * provider-specific, off the seam.
 */
import { z } from "zod";
import { env } from "../env";
import { requestSignal } from "../http/timeout";
import { shellQuote } from "./shell";
import * as tenki from "./tenki";
import {
  BoxApiError,
  BoxSchema,
  type BoxErrorInfo,
  type BoxProvider,
  START_LIMIT_REACHED,
  type Box,
  type CommandResult,
  type ForkOptions,
  type HostedRoute,
} from "./types";

export { BoxApiError, START_LIMIT_REACHED } from "./types";
export type {
  Box,
  BoxProvider,
  BoxState,
  CommandResult,
  ForkOptions,
  HostedRoute,
} from "./types";

/** Which provider owns a box id or template ref. */
export type BoxProviderKind = "ascii" | "tenki";

export function providerOf(idOrTemplateRef: string): BoxProviderKind {
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

export function isStartLimit(error: unknown): boolean {
  return (
    error instanceof BoxApiError &&
    error.status === 429 &&
    (error.code === START_LIMIT_REACHED ||
      error.message.includes(START_LIMIT_REACHED))
  );
}

/** Box control-plane calls answer fast; forks/resumes are async server-side. */
const BOX_REQUEST_TIMEOUT_MS = 60_000;

const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Extract only stable, non-secret provider fields from an error envelope. */
export function parseBoxErrorBody(body: string, fallbackStatus?: number): {
  message: string;
  info: BoxErrorInfo;
} {
  const safe = (value: string): string =>
    value.replace(CONTROL_RE, " ").slice(0, 300);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { message: safe(body), info: {} };
  }
  let code: string | undefined;
  let requestId: string | undefined;
  let providerStatus: number | undefined;
  let message: string | undefined;
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 5 || value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    for (const [key, raw] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[-_]/g, "");
      if (!code && normalized === "code" && typeof raw === "string") code = safe(raw);
      if (!requestId && ["requestid", "traceid"].includes(normalized) && typeof raw === "string") requestId = safe(raw);
      if (providerStatus === undefined && normalized === "status" && typeof raw === "number") providerStatus = raw;
      if (!message && ["message", "detail"].includes(normalized) && typeof raw === "string") message = safe(raw);
      visit(raw, depth + 1);
    }
  };
  visit(parsed, 0);
  return {
    message: message ?? safe(body),
    info: { ...(code ? { code } : {}), ...(requestId ? { requestId } : {}), ...(providerStatus !== undefined ? { providerStatus } : fallbackStatus !== undefined ? { providerStatus: fallbackStatus } : {}) },
  };
}

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
    const parsed = parseBoxErrorBody(body, response.status);
    throw new BoxApiError(response.status, parsed.message, parsed.info);
  }
  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new BoxApiError(502, `unexpected response shape from ${path}: ${parsed.error.message.slice(0, 300)}`);
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

const AsciiCommandResultSchema = z.object({
  exitCode: z.number().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  timedOut: z.boolean().optional(),
});

const asciiImpl = {
  async renameBox(boxId: string, name: string): Promise<Box> {
    const envelope = await boxFetch(`/boxes/${boxId}`, BoxEnvelopeSchema, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    return envelope.box;
  },

  async getBox(
    boxId: string,
    options?: { timeoutMs?: number }
  ): Promise<Box> {
    const envelope = await boxFetch(
      `/boxes/${boxId}`,
      BoxEnvelopeSchema,
      options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : undefined
    );
    return envelope.box;
  },

  async resume(
    boxId: string,
    options?: { timeoutMs?: number }
  ): Promise<Box> {
    const envelope = await boxFetch(`/boxes/${boxId}/resume`, BoxEnvelopeSchema, {
      method: "POST",
      body: JSON.stringify({ ttlSeconds: BOX_TTL_SECONDS }),
      ...(options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : {}),
    });
    return envelope.box;
  },

  async stop(boxId: string): Promise<Box> {
    const envelope = await boxFetch(`/boxes/${boxId}/stop`, BoxEnvelopeSchema, {
      method: "POST",
    });
    return envelope.box;
  },

  /**
   * Deleting a box deletes its snapshots with it (goal.md M8). The API
   * refuses (409 delete_confirmation_required) unless the target id is
   * echoed in X-Ascii-Confirm-Delete.
   */
  async deleteBox(boxId: string): Promise<void> {
    await boxFetch(`/boxes/${boxId}`, z.unknown(), {
      method: "DELETE",
      headers: { "X-Ascii-Confirm-Delete": boxId },
    });
  },

  async requestDesktop(
    boxId: string,
    options?: { vnc?: boolean; timeoutMs?: number }
  ): Promise<string | undefined> {
    const query = options?.vnc ? "?vnc=1" : "?theme=light";
    const envelope = await boxFetch(
      `/boxes/${boxId}/desktop${query}`,
      DesktopEnvelopeSchema,
      {
        method: "POST",
        ...(options?.timeoutMs !== undefined
          ? { timeoutMs: options.timeoutMs }
          : {}),
      }
    );
    if (!envelope.ok || envelope.success === false) return undefined;
    return envelope.desktopUrl;
  },

  async command(
    boxId: string,
    cmd: string,
    timeoutSeconds = 60
  ): Promise<CommandResult> {
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
    // (timedOut true); surface it like a shell `timeout` (124) so callers
    // see one shape across providers instead of a response-parse failure.
    if (result.exitCode === null) {
      return {
        exitCode: 124,
        stdout: result.stdout,
        stderr:
          result.stderr || `command timed out after ${timeoutSeconds}s`,
      };
    }
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  },

  async readFile(boxId: string, path: string): Promise<string> {
    return classifyReadFile(
      path,
      await asciiImpl.command(boxId, readFileCommand(path))
    );
  },

  async writeFile(
    boxId: string,
    path: string,
    content: string
  ): Promise<void> {
    await boxFetch(`/boxes/${boxId}/files`, z.unknown(), {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    });
  },

  async hostRoute(
    boxId: string,
    port: number,
    options?: { timeoutSeconds?: number }
  ): Promise<HostedRoute> {
    const timeoutSeconds = options?.timeoutSeconds ?? 180;
    const result = await asciiImpl.command(
      boxId,
      asciiHostCommand(port),
      timeoutSeconds
    );
    if (result.exitCode !== 0) {
      throw new BoxApiError(
        502,
        `host registration for port ${port} failed: ${result.stderr.slice(0, 300)}`
      );
    }
    return parseAsciiHostedUrl(result.stdout, port);
  },
};

/** Compile-time conformance: the ascii adapter is a BoxProvider. */
const ascii: BoxProvider<string> = asciiImpl;

/** The tenki adapter, normalized to the seam (its hostRoute carries no
 * rotating `_token`, and readFile rides on command like everywhere else). */
const tenkiProvider: BoxProvider<string> = {
  getBox: tenki.getBox,
  resume: tenki.resume,
  stop: tenki.stop,
  deleteBox: tenki.deleteBox,
  requestDesktop: tenki.requestDesktop,
  command: tenki.command,
  readFile: async (boxId, path) =>
    classifyReadFile(
      path,
      await tenki.command(boxId, readFileCommand(path))
    ),
  writeFile: tenki.writeFile,
  hostRoute: async (boxId, port) => ({
    url: (await tenki.hostRoute(boxId, port)).url,
    token: "",
  }),
};

const providers: Record<BoxProviderKind, BoxProvider<string>> = {
  ascii,
  tenki: tenkiProvider,
};

function providerFor(idOrTemplateRef: string): BoxProvider<string> {
  return providers[providerOf(idOrTemplateRef)];
}

/** Set the box's display name in the ascii dashboard (max 120 chars). */
export async function renameBox(boxId: string, name: string): Promise<Box> {
  if (providerOf(boxId) === "tenki") return tenki.renameBox(boxId, name);
  return asciiImpl.renameBox(boxId, name);
}

export async function resume(
  boxId: string,
  options?: { timeoutMs?: number }
): Promise<Box> {
  return providerFor(boxId).resume(boxId, options);
}

/** Never pass force — a refused stop means the snapshot is failing (C6). */
export async function stop(boxId: string): Promise<Box> {
  return providerFor(boxId).stop(boxId);
}

/**
 * Deleting a box deletes its snapshots with it (goal.md M8). The API refuses
 * (409 delete_confirmation_required) unless the target id is echoed in
 * X-Ascii-Confirm-Delete.
 */
export async function deleteBox(boxId: string): Promise<void> {
  return providerFor(boxId).deleteBox(boxId);
}

/**
 * Ask Box for a fresh authenticated desktop stream URL. Default is the
 * Moonlight (WebRTC) viewer; pass vnc for the HTTPS-tunneled noVNC viewer
 * (more tolerant of restrictive networks, must open as a top-level page).
 */
export async function requestDesktop(
  boxId: string,
  options?: { vnc?: boolean; timeoutMs?: number }
): Promise<string | undefined> {
  return providerFor(boxId).requestDesktop(boxId, options);
}

export async function getBox(
  boxId: string,
  options?: { timeoutMs?: number }
): Promise<Box> {
  return providerFor(boxId).getBox(boxId, options);
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
  return providerFor(boxId).command(boxId, cmd, timeoutSeconds);
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
 * The ascii `host` CLI opens ufw to the preview gateway once and then trusts
 * this marker to skip the rule forever. The marker lives in /home/user and
 * survives snapshot/fork; the ufw rule lives in /etc and has been observed
 * missing on a fresh fork, which leaves the hosted route accepting the token
 * and then hanging. Dropping the marker makes `host` re-apply the (idempotent)
 * rule on every registration.
 */
export const ASCII_GATEWAY_FIREWALL_MARKER =
  "/home/user/.ascii/.gateway-firewall-open";

export function asciiHostCommand(port: number): string {
  return `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; rm -f ${ASCII_GATEWAY_FIREWALL_MARKER}; /home/user/.ascii/host url ${port} --timeout 120 --private`;
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
    return tenkiProvider.hostRoute(boxId, port);
  }
  return asciiImpl.hostRoute(boxId, port, options);
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
  return providerFor(boxId).readFile(boxId, path);
}

export async function writeFile(
  boxId: string,
  path: string,
  content: string
): Promise<void> {
  return providerFor(boxId).writeFile(boxId, path, content);
}
