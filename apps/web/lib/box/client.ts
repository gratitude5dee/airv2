/**
 * Typed wrapper over the Box (ascii.dev) API. All Box calls in the control
 * plane go through this module — no direct fetch from route handlers.
 *
 * Every user fork passes `noEnv: true` (C1) plus a per-box env carrying at
 * minimum TENANT_ID and GATEWAY_TOKEN (goal.md §5). Never `stop` with
 * `force: true` (C6).
 */
import { env } from "../env";

export type BoxState =
  | "provisioned"
  | "cloning"
  | "ready"
  | "idle"
  | "archiving"
  | "archived"
  | "error"
  | string;

export interface Box {
  id: string;
  state: BoxState;
  url?: string;
  vcpu?: number;
  memoryGB?: number;
  createdAt?: string;
}

/** Every /boxes/* mutation returns this envelope. */
interface BoxEnvelope {
  ok: boolean;
  id?: string;
  box: Box;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ForkOptions {
  templateId: string;
  /** Per-box env. Must include TENANT_ID and GATEWAY_TOKEN. */
  env: Record<string, string>;
  size?: "small" | "default" | "large";
}

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

async function boxFetch<T>(
  path: string,
  init?: RequestInit & { expectJson?: boolean }
): Promise<T> {
  const response = await fetch(`${env.boxApiBase()}${path}`, {
    ...init,
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
  if (init?.expectJson === false) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const requiredForkEnv = ["TENANT_ID", "GATEWAY_TOKEN"] as const;

export async function fork(options: ForkOptions): Promise<Box> {
  for (const key of requiredForkEnv) {
    if (!options.env[key]) {
      throw new Error(`fork: per-box env is missing ${key}`);
    }
  }
  const envelope = await boxFetch<BoxEnvelope>(
    `/boxes/${options.templateId}/fork`,
    {
      method: "POST",
      body: JSON.stringify({
        noEnv: true,
        env: options.env,
        ...(options.size ? { size: options.size } : {}),
      }),
    }
  );
  return envelope.box;
}

export async function resume(boxId: string): Promise<Box> {
  const envelope = await boxFetch<BoxEnvelope>(`/boxes/${boxId}/resume`, {
    method: "POST",
  });
  return envelope.box;
}

/** Never pass force — a refused stop means the snapshot is failing (C6). */
export async function stop(boxId: string): Promise<Box> {
  const envelope = await boxFetch<BoxEnvelope>(`/boxes/${boxId}/stop`, {
    method: "POST",
  });
  return envelope.box;
}

/** Deleting a box deletes its snapshots with it (goal.md M8). */
export async function deleteBox(boxId: string): Promise<void> {
  await boxFetch<unknown>(`/boxes/${boxId}`, { method: "DELETE" });
}

export async function getBox(boxId: string): Promise<Box> {
  const envelope = await boxFetch<BoxEnvelope>(`/boxes/${boxId}`);
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
  return boxFetch<CommandResult>(`/boxes/${boxId}/commands`, {
    method: "POST",
    body: JSON.stringify({ command: cmd, timeoutSeconds }),
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
  await boxFetch<{ ok: boolean }>(`/boxes/${boxId}/files`, {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });
}
