/**
 * Agent harnesses: which agent runtime lives on the user's compute. The
 * harness is a dimension parallel to ComputeEnvironment — the environment is
 * the machine, the harness is the agent process on it. Every harness speaks
 * the same control-plane contract (POST /v1/runs, GET /v1/runs/{id}/events as
 * SSE, /stop, /approval, /health, /api/sessions), so lib/agent/client.ts is
 * shared and only provisioning differs: which template is forked, which
 * per-box files carry API_SERVER_KEY + the gateway binding, and which units
 * are bounced after the merge.
 *
 * - hermes: the original Hermes api_server box. Default; nothing changed.
 * - exo:    exo-agentd (gratitude5dee/exo `exo agentd`) baked by the zap
 *           `zap-heavy-exo` template. Same contract, same private route.
 *
 * Adding a harness (OpenClaw 2.0 next) is a new HarnessProfile here, a
 * template registered for it, and its onboarding card — no client change.
 */

import type { ComputeKind } from "@/lib/compute/environments";

export const AGENT_HARNESSES = ["hermes", "exo"] as const;

export type AgentHarness = (typeof AGENT_HARNESSES)[number];

/** Existing boxes and every code path that does not care predate the choice. */
export const DEFAULT_HARNESS: AgentHarness = "hermes";

export function isAgentHarness(value: unknown): value is AgentHarness {
  return (
    typeof value === "string" &&
    (AGENT_HARNESSES as readonly string[]).includes(value)
  );
}

/** Coerce a persisted value (possibly null on pre-migration rows). */
export function toAgentHarness(value: unknown): AgentHarness {
  return isAgentHarness(value) ? value : DEFAULT_HARNESS;
}

/**
 * How the per-box gateway binding is written:
 * - hermes-config: merge OPENAI_* into ~/.hermes/.env and rewrite
 *                  model.base_url/api_key in config.yaml (the existing path).
 * - exo-model:     `exo secret set` + `exo model register` against the
 *                  gateway; nothing in the env file but the run-surface key.
 */
export type HarnessConfigStrategy = "hermes-config" | "exo-model";

export interface HarnessProfile {
  harness: AgentHarness;
  /** Owner-facing name — the onboarding card renders these. */
  label: string;
  blurb: string;
  /** Template source directory whose bake builds this harness. */
  templateDir: string;
  /** Harness build ref the template pins (SHA for Hermes, branch/tag for exo). */
  templateRef: string;
  /** Units the per-user secret merge must bounce, per compute kind. Box
   * kinds carry the `*-host` unit that re-registers the private tunnels. */
  services: Record<ComputeKind, readonly string[]>;
  /** Harness state root, relative to the box user's home. */
  stateDir: string;
  /** Run-surface port (the api_server contract) and the dashboard, if any. */
  ports: { api: number; dashboard: number | null };
  /** Env var names the harness reads its gateway binding from. */
  gatewayEnv: { baseUrl: string; token: string };
  configStrategy: HarnessConfigStrategy;
  /** Inbound surfaces the template leaves enabled (C24: exactly one). */
  enabledPlatforms: readonly string[];
  /** File under stateDir the template writes its baked harness ref to. */
  templateRefFile: string;
}

/** Pinned Hermes revision baked into the Linux templates (infra/template/setup.sh). */
export const HERMES_REF = "fcbd1076a93841fa88855acce810e342a5b78101";

export const HARNESS_PROFILES: Record<AgentHarness, HarnessProfile> = {
  hermes: {
    harness: "hermes",
    label: "Hermes",
    blurb: "The default agent — most tested, every skill and plugin.",
    templateDir: "infra/template",
    templateRef: HERMES_REF,
    services: {
      box: ["hermes-gateway", "hermes-dashboard", "hermes-host"],
      native: ["hermes-gateway", "hermes-dashboard"],
    },
    stateDir: ".hermes",
    ports: { api: 8642, dashboard: 9119 },
    gatewayEnv: { baseUrl: "OPENAI_BASE_URL", token: "OPENAI_API_KEY" },
    configStrategy: "hermes-config",
    enabledPlatforms: ["api_server"],
    templateRefFile: ".template-hermes-ref",
  },
  exo: {
    harness: "exo",
    label: "Exo",
    blurb: "The exo harness with the Zap recipe stack. Same chat, new runtime.",
    templateDir: "zap/packages/templates/zap-heavy-exo",
    templateRef: "zap-heavy-exo",
    services: {
      box: ["exo-agentd", "exo-host"],
      native: ["exo-agentd"],
    },
    stateDir: ".exo",
    ports: { api: 8642, dashboard: null },
    gatewayEnv: { baseUrl: "EXO_MODEL_BASE_URL", token: "GATEWAY_TOKEN" },
    configStrategy: "exo-model",
    enabledPlatforms: ["api_server"],
    templateRefFile: ".template-exo-ref",
  },
};

export function harnessProfile(harness: AgentHarness): HarnessProfile {
  return HARNESS_PROFILES[harness];
}

/** Every unit any harness may ask a compute kind to restart. */
export function harnessServicesFor(kind: ComputeKind): readonly string[] {
  return AGENT_HARNESSES.flatMap((harness) => HARNESS_PROFILES[harness].services[kind]);
}
