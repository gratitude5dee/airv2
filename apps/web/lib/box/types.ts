/**
 * Provider-neutral Box vocabulary shared by lib/box/client.ts (the ascii.dev
 * implementation and dispatch facade), lib/box/tenki.ts, and the namespace
 * adapter in lib/namespace/client.ts (R-ARCH-08).
 */
import { z } from "zod";

export type BoxState =
  | "provisioned"
  | "cloning"
  | "ready"
  | "idle"
  | "archiving"
  | "archived"
  | "error"
  | string;

export const BoxSchema = z.object({
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

export const CommandResultSchema = z.object({
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
 * Sentinel every provider puts in its 429 message when a start/fork is
 * refused for platform capacity; isStartLimit() keys off it.
 */
export const START_LIMIT_REACHED = "start_limit_reached";

/** Provider error fields retained for routing and support diagnostics. */
export interface BoxErrorInfo {
  code?: string;
  requestId?: string;
  providerStatus?: number;
}

export class BoxApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly providerStatus: number | undefined;
  constructor(status: number, message: string, info: BoxErrorInfo = {}) {
    super(message);
    this.name = "BoxApiError";
    this.status = status;
    this.code = info.code;
    this.requestId = info.requestId;
    this.providerStatus = info.providerStatus;
  }
}

/** A hosted route to a port on the box; token is "" where ingress has none. */
export interface HostedRoute {
  url: string;
  token: string;
}

/**
 * The provider seam lib/box dispatches over — the box vocabulary every
 * compute provider answers. `Id` is the provider's handle: a box id for
 * ascii/tenki, a BridgeControl for lib/namespace's bridge-backed instance.
 * Provisioning (fork/create) stays provider-specific and is not on the seam,
 * and neither are provider extras like renameBox or Tenki's richer
 * hostRoute/ttl options.
 */
export interface BoxProvider<Id> {
  getBox(id: Id, options?: { timeoutMs?: number }): Promise<Box>;
  resume(id: Id, options?: { timeoutMs?: number }): Promise<Box>;
  stop(id: Id): Promise<Box>;
  deleteBox(id: Id): Promise<void>;
  requestDesktop(
    id: Id,
    options?: { vnc?: boolean; timeoutMs?: number }
  ): Promise<string | undefined>;
  command(
    id: Id,
    cmd: string,
    timeoutSeconds?: number
  ): Promise<CommandResult>;
  readFile(id: Id, path: string): Promise<string>;
  writeFile(id: Id, path: string, content: string): Promise<void>;
  hostRoute(id: Id, port: number): Promise<HostedRoute>;
}
