/**
 * Typed wrapper over the Box (ascii.dev) API. All Box calls in the control
 * plane go through this module — no direct fetch from route handlers.
 *
 * Every user fork passes `noEnv: true` (C1) plus a per-box env carrying at
 * minimum TENANT_ID and GATEWAY_TOKEN (goal.md §5). Never `stop` with
 * `force: true` (C6).
 */
import { z } from "zod";
import { env } from "../env";
import { requestSignal } from "../http/timeout";

export type BoxState =
  | "provisioned"
  | "cloning"
  | "ready"
  | "idle"
  | "archiving"
  | "archived"
  | "error"
  | string;

const BoxSchema = z.object({
  id: z.string(),
  state: z.string(),
  // A stopped box has no hosted route; the provider reports url as null.
  url: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  vcpu: z.number().optional(),
  memoryGB: z.number().optional(),
  createdAt: z.string().optional(),
});
export type Box = z.infer<typeof BoxSchema>;

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

const CommandResultSchema = z.object({
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export interface ForkOptions {
  templateId: string;
  /** Per-box env. Must include TENANT_ID and GATEWAY_TOKEN. */
  env: Record<string, string>;
  size?: "small" | "default" | "large";
  /** Provider auto-stop TTL; null disables it. Forks default to 1 hour. */
  ttlSeconds?: number | null;
}

/**
 * Provider-side auto-stop backstop. Our own sweeper stops idle boxes within
 * minutes; this TTL only exists so a sweeper outage can't leave a box
 * burning for the 30-day provider maximum. It must be long enough that the
 * provider never kills an actively working box mid-turn (the default fork
 * TTL of 1 hour counts from start, not last activity, and would).
 */
export const BOX_TTL_SECONDS = 24 * 60 * 60;

export class BoxApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "BoxApiError";
    this.status = status;
  }
}

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
  const envelope = await boxFetch(`/boxes/${boxId}`, BoxEnvelopeSchema, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return envelope.box;
}

export async function resume(boxId: string): Promise<Box> {
  const envelope = await boxFetch(`/boxes/${boxId}/resume`, BoxEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify({ ttlSeconds: BOX_TTL_SECONDS }),
  });
  return envelope.box;
}

/** Never pass force — a refused stop means the snapshot is failing (C6). */
export async function stop(boxId: string): Promise<Box> {
  const envelope = await boxFetch(`/boxes/${boxId}/stop`, BoxEnvelopeSchema, {
    method: "POST",
  });
  return envelope.box;
}

/** Deleting a box deletes its snapshots with it (goal.md M8). */
export async function deleteBox(boxId: string): Promise<void> {
  await boxFetch(`/boxes/${boxId}`, z.unknown(), { method: "DELETE" });
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
  const envelope = await boxFetch(`/boxes/${boxId}`, BoxEnvelopeSchema);
  return envelope.box;
}

/** Poll until the box reaches ready/idle. */
export async function waitForBox(
  boxId: string,
  timeoutMs = 240_000
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
  // The box-side command runs up to timeoutSeconds; give the HTTP round
  // trip that budget plus margin.
  return boxFetch(`/boxes/${boxId}/commands`, CommandResultSchema, {
    method: "POST",
    body: JSON.stringify({ command: cmd, timeoutSeconds }),
    timeoutMs: (timeoutSeconds + 60) * 1000,
  });
}

/** Reads via the command endpoint; the files API is write-oriented. */
export async function readFile(boxId: string, path: string): Promise<string> {
  const result = await command(boxId, `cat ${JSON.stringify(path)}`);
  if (result.exitCode !== 0) {
    throw new BoxApiError(404, `readFile ${path}: ${result.stderr}`);
  }
  return result.stdout;
}

export async function writeFile(
  boxId: string,
  path: string,
  content: string
): Promise<void> {
  await boxFetch(`/boxes/${boxId}/files`, z.unknown(), {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });
}
