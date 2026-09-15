/**
 * Kernel control-plane client (docs/plans/kernel-shop-commerce-swe2.md).
 * The KERNEL_API_KEY never leaves this process (C26): boxes see a localhost
 * CDP relay, browsers see sealed/fragment-delivered URLs, and every Kernel
 * call is made here in the control plane. Each user gets a lazily created
 * Kernel project (`air-user-<id8>`) so a session or vault can only ever hold
 * one user's material — no shared vaults, no shared browsers.
 */
import Kernel from "@onkernel/sdk";
import { createHash } from "node:crypto";
import { openSecret, sealSecret } from "../crypto/secretbox";
import { env } from "../env";

export class KernelError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** True when the Kernel lane is flag-enabled AND a key is provisioned. */
export function kernelAvailable(): boolean {
  return env.kernelEnabled() && env.kernelApiKey() !== null;
}

/** Fail-closed gate every Kernel surface calls before touching the SDK. */
export function requireKernel(): string {
  if (!env.kernelEnabled()) {
    throw new KernelError("kernel_disabled", "Kernel browser lane is not enabled", 403);
  }
  const key = env.kernelApiKey();
  if (!key) {
    throw new KernelError(
      "kernel_unconfigured",
      "Kernel browser lane is not configured",
      503
    );
  }
  return key;
}

/**
 * Org-scoped client: project creation and other organization-level calls.
 * `projectId` scopes every resource call to one user's project — never pass
 * another user's id through this client.
 */
export function kernelClient(projectId?: string | null): Kernel {
  const apiKey = requireKernel();
  return new Kernel({
    apiKey,
    baseURL: env.kernelApiBase(),
    projectID: projectId ?? null,
  });
}

/** Map an SDK/API failure to a value-free error — never leak response bodies
 * or headers (they can echo request URLs, which are credentials here). */
export function kernelFailure(error: unknown): KernelError {
  if (error instanceof KernelError) return error;
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  const http = Number.isFinite(status) && status >= 400 && status < 600 ? status : 502;
  return new KernelError(
    "kernel_api_error",
    `Kernel request failed (${http})`,
    http === 502 ? 502 : http
  );
}

/** Purpose-separated sealing key for browser bearer URLs (C27). */
export function kernelSealKey(purpose: "browser" | "action"): string {
  return createHash("sha256")
    .update(`air:kernel-${purpose}-url:v1\0`, "utf8")
    .update(env.sessionSecret(), "utf8")
    .digest("hex");
}

export function sealKernelUrl(url: string, purpose: "browser" | "action"): string {
  return sealSecret(url, kernelSealKey(purpose));
}

export function openKernelUrl(
  sealed: string | null | undefined,
  purpose: "browser" | "action"
): string | null {
  if (!sealed) return null;
  try {
    return openSecret(sealed, kernelSealKey(purpose));
  } catch {
    return null;
  }
}

/** Deterministic per-user Kernel names. `id8` keeps project names opaque. */
export function kernelProjectName(userId: string): string {
  return `air-user-${userId.slice(0, 8)}`;
}

export function kernelVaultName(userId: string): string {
  return `air-vault-${userId.slice(0, 8)}`;
}

export function kernelProfileName(userId: string): string {
  return `air-profile-${userId.slice(0, 8)}`;
}
