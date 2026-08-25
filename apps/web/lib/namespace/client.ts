/**
 * Typed wrapper over the Namespace Compute API — the provider behind the
 * macos environment (both Linux environments are ascii.dev boxes). Mirrors
 * lib/box/client.ts so the control plane can treat a Namespace instance like
 * a box: create, waitFor, command, readFile, writeFile, suspend/destroy, plus
 * VNC for the live-screen surface.
 *
 * Connect/JSON unary RPCs over plain fetch (`POST /<service>/<Method>`), the
 * wire format the `nsc` CLI and the Namespace SDK speak. No SDK dependency:
 * this runs on Vercel functions, where a gRPC transport is a liability.
 *
 * A macOS instance is native — an Apple-silicon Mac with no container — and
 * Namespace's CommandService only runs commands in containers, so
 * infra/template-macos runs a loopback "bridge" LaunchAgent — exec plus file
 * read/write over HTTP — published through an authenticated Namespace
 * ingress. Bridge requests carry BOTH the workspace bearer token (enforced by
 * the ingress) and the per-instance bridge token (enforced by the bridge), so
 * neither alone reaches the agent's filesystem.
 */
import { env } from "../env";
import { requestSignal } from "../http/timeout";

const COMPUTE_SERVICE = "namespace.cloud.compute.v1beta.ComputeService";

/** Namespace instance lifecycle states (metadata.status). */
export type InstanceState =
  | "PENDING"
  | "CREATING"
  | "RUNNING"
  | "SUSPENDED"
  | "DESTROYED"
  | "FAILED"
  | string;

export interface NamespaceInstance {
  id: string;
  state: InstanceState;
  /** Namespace dashboard URL for the instance — operator-facing. */
  url?: string | undefined;
  vcpu?: number | undefined;
  memoryGB?: number | undefined;
  createdAt?: string | undefined;
  /** Public ingress URLs of the container's exported ports, by port. */
  ports: Record<number, string>;
}

/** Everything needed to talk to one Mac's bridge. Persisted on the boxes row. */
export interface BridgeControl {
  instanceId: string;
  controlUrl: string;
  controlToken: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Ports published through ingress, mirroring the box host routes. */
export const HERMES_PORT = 8642;
export const DASHBOARD_PORT = 9119;
export const BRIDGE_PORT = 8722;

/** Deadline for an instance, matching the box TTL backstop. */
export const INSTANCE_TTL_SECONDS = 24 * 60 * 60;

const SHAPES = {
  small: { virtualCpu: 4, memoryMegabytes: 8 * 1024 },
  default: { virtualCpu: 6, memoryMegabytes: 14 * 1024 },
  large: { virtualCpu: 8, memoryMegabytes: 24 * 1024 },
} as const;

export type InstanceSize = keyof typeof SHAPES;

export class NamespaceApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "NamespaceApiError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 60_000;

async function call<T>(
  service: string,
  method: string,
  body: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const token = env.namespaceToken();
  if (!token) {
    throw new NamespaceApiError(
      501,
      "NAMESPACE_TOKEN is not configured — the macos environment is disabled",
    );
  }
  const response = await fetch(
    `${env.namespaceComputeApi()}/${service}/${method}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: requestSignal(timeoutMs),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new NamespaceApiError(
      response.status,
      `${method}: ${text.slice(0, 500)}`,
    );
  }
  return (await response.json()) as T;
}

interface InstanceMetadata {
  instanceId: string;
  status?: InstanceState;
  createdAt?: string | undefined;
  shape?: { virtualCpu?: number; memoryMegabytes?: number };
}

interface AllocatedContainer {
  name?: string;
  exportedPort?: Array<{ containerPort?: number; fqdn?: string }>;
}

interface DescribeInstanceResponse {
  instanceUrl?: string;
  metadata: InstanceMetadata;
  containers?: AllocatedContainer[];
}

function toInstance(response: DescribeInstanceResponse): NamespaceInstance {
  const metadata = response.metadata;
  const memory = metadata.shape?.memoryMegabytes;
  const ports: Record<number, string> = {};
  for (const container of response.containers ?? []) {
    for (const port of container.exportedPort ?? []) {
      if (port.containerPort && port.fqdn) {
        ports[port.containerPort] = `https://${port.fqdn}`;
      }
    }
  }
  return {
    id: metadata.instanceId,
    state: metadata.status ?? "PENDING",
    url: response.instanceUrl,
    vcpu: metadata.shape?.virtualCpu,
    memoryGB: memory ? Math.round(memory / 1024) : undefined,
    createdAt: metadata.createdAt,
    ports,
  };
}

const REQUIRED_ENV = ["TENANT_ID", "GATEWAY_TOKEN"] as const;

function assertPerInstanceEnv(
  caller: string,
  vars: Record<string, string>,
): void {
  for (const key of REQUIRED_ENV) {
    if (!vars[key]) {
      throw new Error(`${caller}: per-instance env is missing ${key}`);
    }
  }
}

function deadline(ttlSeconds: number | null | undefined): object {
  const ttl = ttlSeconds === undefined ? INSTANCE_TTL_SECONDS : ttlSeconds;
  return ttl
    ? { deadline: new Date(Date.now() + ttl * 1000).toISOString() }
    : {};
}

export interface CreateMacOptions {
  /**
   * The template pointer for the macos environment: the URL of the
   * infra/template-macos bootstrap script the fresh Mac curls on first boot.
   * macOS instances boot Namespace's base image (there is no fork), so "the
   * template" is a build script rather than a snapshot id.
   */
  bootstrapUrl: string;
  /** Per-instance env. Must include TENANT_ID and GATEWAY_TOKEN (C1). */
  env: Record<string, string>;
  /** Token the bridge requires on every request. */
  bridgeToken: string;
  size?: InstanceSize;
  ttlSeconds?: number | null;
}

/**
 * Create an Apple-silicon macOS instance and start the template bootstrap on
 * it. Returns as soon as Namespace accepts the instance; waitForBridge() waits
 * for the build to finish.
 */
export async function createMacInstance(
  options: CreateMacOptions,
): Promise<NamespaceInstance> {
  assertPerInstanceEnv("createMacInstance", options.env);
  const response = await call<DescribeInstanceResponse>(
    COMPUTE_SERVICE,
    "CreateInstance",
    {
      shape: {
        ...SHAPES[options.size ?? "default"],
        os: "macos",
        machineArch: "arm64",
      },
      documentedPurpose: "air agent home",
      ...deadline(options.ttlSeconds),
      applications: [
        {
          name: "air-bootstrap",
          // macOS applications require an image ("support disk") even when
          // the command is an absolute path into the base image. The image
          // contents are unused; it only satisfies the support-disk mount.
          imageRef: env.macBootstrapImage(),
          // The base image ships bash and curl; the template is fetched at
          // boot so a template change needs no image rebuild.
          command: "/bin/bash",
          args: ["-lc", `curl -fsSL ${options.bootstrapUrl} | bash -s`],
          workloadType: "SERVICE",
          environment: {
            ...options.env,
            AIR_BRIDGE_TOKEN: options.bridgeToken,
            AIR_BRIDGE_PORT: String(BRIDGE_PORT),
          },
        },
      ],
    },
    120_000,
  );
  return toInstance(response);
}

export async function getInstance(
  instanceId: string,
): Promise<NamespaceInstance> {
  return toInstance(
    await call<DescribeInstanceResponse>(COMPUTE_SERVICE, "DescribeInstance", {
      instanceId,
    }),
  );
}

/** Poll Namespace's own WaitInstanceSync until the instance is RUNNING. */
export async function waitForInstance(
  instanceId: string,
  timeoutMs = 600_000,
): Promise<NamespaceInstance> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    let response: DescribeInstanceResponse;
    try {
      response = await call<DescribeInstanceResponse>(
        COMPUTE_SERVICE,
        "WaitInstanceSync",
        { instanceId },
        Math.min(120_000, Math.max(10_000, until - Date.now())),
      );
    } catch (error) {
      // WaitInstanceSync long-polls; a slow boot (macOS takes minutes) can
      // outlive one request. Re-poll until the overall deadline.
      if (
        Date.now() > until ||
        (error instanceof NamespaceApiError && error.status < 500)
      ) {
        throw error;
      }
      continue;
    }
    const instance = toInstance(response);
    if (instance.state === "RUNNING") return instance;
    if (instance.state === "DESTROYED" || instance.state === "FAILED") {
      throw new NamespaceApiError(
        500,
        `instance ${instanceId} is ${instance.state}`,
      );
    }
    if (Date.now() > until) {
      throw new NamespaceApiError(
        504,
        `instance ${instanceId} not ready after ${timeoutMs}ms`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

/** Suspend (the stop() equivalent — the instance keeps its disk). */
export async function suspendInstance(instanceId: string): Promise<void> {
  await call<unknown>(COMPUTE_SERVICE, "SuspendInstance", { instanceId });
}

export async function wakeInstance(instanceId: string): Promise<void> {
  await call<unknown>(COMPUTE_SERVICE, "WakeInstance", { instanceId });
}

export async function destroyInstance(instanceId: string): Promise<void> {
  await call<unknown>(COMPUTE_SERVICE, "DestroyInstance", { instanceId });
}

export interface Ingress {
  name: string;
  url: string;
}

/**
 * Publish loopback ports of a native instance. Only macOS needs this: a
 * container's ports are exported at creation time. `open` ports skip the
 * Namespace bearer check because the service behind them has its own auth;
 * the bridge keeps it.
 */
export async function publishIngress(
  instanceId: string,
  wanted: ReadonlyArray<{ name: string; port: number; open: boolean }>,
): Promise<Record<number, Ingress>> {
  const response = await call<{
    allocatedIngresses?: Array<{ name: string; fqdn: string }>;
  }>(COMPUTE_SERVICE, "CreateIngress", {
    instanceId,
    ingresses: wanted.map((entry) => ({
      name: entry.name,
      exportedPortBackend: { port: entry.port },
      httpMatchRule: [{ match: {}, doesNotRequireAuth: entry.open }],
    })),
  });
  const allocated = response.allocatedIngresses ?? [];
  const byPort: Record<number, Ingress> = {};
  for (const entry of wanted) {
    const match = allocated.find((ingress) => ingress.name === entry.name);
    if (!match?.fqdn) {
      throw new NamespaceApiError(
        502,
        `ingress ${entry.name} was not allocated for ${instanceId}`,
      );
    }
    byPort[entry.port] = { name: entry.name, url: `https://${match.fqdn}` };
  }
  return byPort;
}

/** The three routes a Mac publishes, mirroring the box host routes. */
export async function publishMacIngress(
  instanceId: string,
): Promise<Record<number, Ingress>> {
  return publishIngress(instanceId, [
    { name: "hermes", port: HERMES_PORT, open: true },
    { name: "dashboard", port: DASHBOARD_PORT, open: true },
    { name: "bridge", port: BRIDGE_PORT, open: false },
  ]);
}

export interface VncConfig {
  endpoint: string;
  username?: string;
  password?: string;
}

/** Screen sharing for the live-computer surface (`nsc vnc` equivalent). */
export async function vncConfig(instanceId: string): Promise<VncConfig> {
  return call<VncConfig>(COMPUTE_SERVICE, "GetVNCConfig", { instanceId });
}

// ── bridge (control plane → a native instance) ──────────────────────────────

// The ingress edge rejects workspace API tokens; requests must carry a
// short-lived ingress access token (x-nsc-ingress-auth), issued per instance.
const ingressTokens = new Map<string, { token: string; expires: number }>();
const INGRESS_TOKEN_TTL_MS = 5 * 60 * 1000;

async function ingressAccessToken(instanceId: string): Promise<string> {
  const cached = ingressTokens.get(instanceId);
  if (cached && cached.expires > Date.now()) {
    return cached.token;
  }
  const token = env.namespaceToken();
  if (!token) {
    throw new NamespaceApiError(501, "NAMESPACE_TOKEN is not configured");
  }
  const response = await fetch(
    `${env.namespaceIamApi()}/nsl.tenants.TenantsService/IssueIngressAccessToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ instanceId }),
      signal: requestSignal(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new NamespaceApiError(
      response.status,
      `IssueIngressAccessToken: ${text.slice(0, 500)}`,
    );
  }
  const body = (await response.json()) as { ingress_access_token?: string };
  if (!body.ingress_access_token) {
    throw new NamespaceApiError(502, "no ingress_access_token in response");
  }
  ingressTokens.set(instanceId, {
    token: body.ingress_access_token,
    expires: Date.now() + INGRESS_TOKEN_TTL_MS,
  });
  return body.ingress_access_token;
}

async function bridgeFetch<T>(
  control: BridgeControl,
  path: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const accessToken = await ingressAccessToken(control.instanceId);
  const response = await fetch(`${control.controlUrl}${path}`, {
    ...init,
    signal: requestSignal(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
    headers: {
      "x-nsc-ingress-auth": `Bearer ${accessToken}`,
      "X-Air-Bridge-Token": control.controlToken,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new NamespaceApiError(
      response.status,
      `bridge: ${text.slice(0, 500)}`,
    );
  }
  return (await response.json()) as T;
}

export async function bridgeCommand(
  control: BridgeControl,
  cmd: string,
  timeoutSeconds = 60,
): Promise<CommandResult> {
  return bridgeFetch<CommandResult>(control, "/v1/command", {
    method: "POST",
    body: JSON.stringify({ command: cmd, timeoutSeconds }),
    timeoutMs: (timeoutSeconds + 60) * 1000,
  });
}

/** Wait for the bootstrap to finish and the bridge to answer. */
export async function waitForBridge(
  control: BridgeControl,
  timeoutMs = 1_800_000,
): Promise<void> {
  const until = Date.now() + timeoutMs;
  let lastError = "bridge never answered";
  for (;;) {
    try {
      const health = await bridgeFetch<{ ready?: boolean }>(
        control,
        "/v1/health",
        { method: "GET", timeoutMs: 15_000 },
      );
      if (health.ready) return;
      lastError = "bridge reported not ready";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (Date.now() > until) {
      throw new NamespaceApiError(
        504,
        `instance ${control.instanceId} bootstrap incomplete: ${lastError}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

export async function bridgeReadFile(
  control: BridgeControl,
  path: string,
): Promise<string> {
  const result = await bridgeFetch<{ content: string }>(
    control,
    `/v1/files?path=${encodeURIComponent(path)}`,
    { method: "GET" },
  );
  return result.content;
}

export async function bridgeWriteFile(
  control: BridgeControl,
  path: string,
  content: string,
): Promise<void> {
  await bridgeFetch<{ ok: boolean }>(control, "/v1/files", {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });
}
