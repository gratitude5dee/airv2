/**
 * airbox: the provider-neutral description of what a user's compute must
 * provide, imported from the existing box configuration rather than
 * re-declared. Any backend — an ascii.dev box (today's default), a Namespace
 * instance, or a future self-hosted microsandbox / Firecracker / Hyperlight
 * host — provisions from the same manifest, so the box template remains the
 * single source of truth and this module only *projects* it.
 *
 * Data-only by design: nothing here talks to a provider. The runtime
 * dispatch stays in lib/compute/runtime.ts; airbox is the config contract
 * those providers consume.
 */

import {
  COMPUTE_ENVIRONMENTS,
  ENVIRONMENT_PROFILES,
  type ComputeEnvironment,
  type ComputeKind,
  type ComputeProvider,
} from "@/lib/compute/environments";
import {
  API_SERVER_PORT,
  DASHBOARD_PORT,
} from "@/lib/orchestrator/boxes";

/** Pinned Hermes revision baked into the Linux templates (infra/template/setup.sh). */
export const HERMES_REF = "fcbd1076a93841fa88855acce810e342a5b78101";

/**
 * Per-environment pins: each entry mirrors that template's setup.sh so the
 * manifest stays a projection of what the template actually builds. macOS
 * stays on the older pin until infra/template-macos is re-built; omarchy
 * overlays the ubuntu template, so it shares the Linux pin.
 */
export const HERMES_REFS: Record<ComputeEnvironment, string> = {
  ubuntu: HERMES_REF,
  omarchy: HERMES_REF,
  macos: "7339f5f160db5c96657a3bab60151227cc61f66c",
};

/**
 * The only Hermes platform ever enabled — every other adapter bypasses the
 * router (dedupe, trust tiers, spend caps, approvals) and stays disabled via
 * the C24 generate_platforms.py gate in every template.
 */
export const ENABLED_PLATFORMS = ["api_server"] as const;

/** Dev-box lanes beyond the onboarding environments (Zap runtime ladder). */
export const AIRBOX_LANES = ["agent", "zap-light"] as const;
export type AirboxLane = (typeof AIRBOX_LANES)[number];

export interface AirboxManifest {
  /** Manifest schema version — bump on breaking shape changes. */
  version: 1;
  environment: ComputeEnvironment;
  lane: AirboxLane;
  provider: ComputeProvider;
  kind: ComputeKind;
  homeDir: string;
  /** infra/ directory whose setup.sh builds this template. */
  templateDir: string;
  hermesRef: string;
  ports: { hermes: number; dashboard: number };
  /** Units the per-user secret merge must bounce (systemd or launchd). */
  services: readonly string[];
  enabledPlatforms: readonly string[];
  headedBrowser: boolean;
}

const TEMPLATE_DIRS: Record<ComputeEnvironment, string> = {
  ubuntu: "infra/template",
  omarchy: "infra/template-omarchy",
  macos: "infra/template-macos",
};

/** The agent manifest for an onboarding environment. */
export function airboxManifest(
  environment: ComputeEnvironment,
): AirboxManifest {
  const profile = ENVIRONMENT_PROFILES[environment];
  return {
    version: 1,
    environment,
    lane: "agent",
    provider: profile.provider,
    kind: profile.kind,
    homeDir: profile.homeDir,
    templateDir: TEMPLATE_DIRS[environment],
    hermesRef: HERMES_REFS[environment],
    ports: { hermes: API_SERVER_PORT, dashboard: DASHBOARD_PORT },
    services: profile.services,
    enabledPlatforms: ENABLED_PLATFORMS,
    headedBrowser: profile.headedBrowser,
  };
}

/**
 * zap-light rides the ubuntu box config plus the exec-lane overlay
 * (infra/template-zap-light) — same agent substrate, extra sandboxed
 * code/FFmpeg/media lanes. Not an onboarding environment.
 */
export function zapLightManifest(): AirboxManifest {
  return {
    ...airboxManifest("ubuntu"),
    lane: "zap-light",
    templateDir: "infra/template-zap-light",
    services: [...ENVIRONMENT_PROFILES.ubuntu.services, "zap-exec"],
  };
}

/** Every manifest a provider could be asked to build. */
export function allManifests(): AirboxManifest[] {
  return [
    ...COMPUTE_ENVIRONMENTS.map((environment) => airboxManifest(environment)),
    zapLightManifest(),
  ];
}
