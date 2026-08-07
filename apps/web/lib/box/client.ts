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
  | "provisioning"
  | "running"
  | "stopped"
  | "failed"
  | string;

export interface Box {
  id: string;
  state: BoxState;
  size?: string;
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
  return boxFetch<Box>(`/boxes/${options.templateId}/fork`, {
    method: "POST",
    body: JSON.stringify({
      noEnv: true,
      env: options.env,
      ...(options.size ? { size: options.size } : {}),
    }),
  });
}

export async function resume(boxId: string): Promise<Box> {
  return boxFetch<Box>(`/boxes/${boxId}/resume`, { method: "POST" });
}

/** Never pass force — a refused stop means the snapshot is failing (C6). */
export async function stop(boxId: string): Promise<Box> {
  return boxFetch<Box>(`/boxes/${boxId}/stop`, { method: "POST" });
}

export async function getBox(boxId: string): Promise<Box> {
  return boxFetch<Box>(`/boxes/${boxId}`);
}

export async function command(
  boxId: string,
  cmd: string
): Promise<CommandResult> {
  return boxFetch<CommandResult>(`/boxes/${boxId}/commands`, {
    method: "POST",
    body: JSON.stringify({ command: cmd }),
  });
}

export async function readFile(boxId: string, path: string): Promise<string> {
  const result = await boxFetch<{ content: string }>(
    `/boxes/${boxId}/files/read`,
    {
      method: "POST",
      body: JSON.stringify({ path }),
    }
  );
  return result.content;
}

export async function writeFile(
  boxId: string,
  path: string,
  content: string
): Promise<void> {
  await boxFetch<void>(`/boxes/${boxId}/files/write`, {
    method: "POST",
    body: JSON.stringify({ path, content }),
    expectJson: false,
  });
}
