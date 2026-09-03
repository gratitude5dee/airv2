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
  DEFAULT_HARNESS,
  HERMES_REF,
  harnessProfile,
  type AgentHarness,
} from "@/lib/agent/harness";

export { HERMES_REF };

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
  /** Agent runtime on the machine; hermes unless the user chose otherwise. */
  harness: AgentHarness;
  lane: AirboxLane;
  provider: ComputeProvider;
  kind: ComputeKind;
  homeDir: string;
  /** Template directory whose bake builds this box. */
  templateDir: string;
  /** Harness build ref the template pins. `hermesRef` on Hermes boxes. */
  harnessRef: string;
  hermesRef: string;
  /** Harness state root (~/.hermes, ~/.exo) relative to homeDir. */
  stateDir: string;
  /** `hermes` is the api_server-contract port whichever harness serves it. */
  ports: { hermes: number; dashboard: number | null };
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

/**
 * The agent manifest for an onboarding environment. Hermes projects the
 * environment profile unchanged; any other harness derives template,
 * services, ports, and enabled surfaces from its HarnessProfile instead of
 * the Hermes constants (the environment still decides provider/home/desktop).
 */
export function airboxManifest(
  environment: ComputeEnvironment,
  harness: AgentHarness = DEFAULT_HARNESS,
): AirboxManifest {
  const profile = ENVIRONMENT_PROFILES[environment];
  const hermesRef = HERMES_REFS[environment];
  if (harness === "hermes") {
    return {
      version: 1,
      environment,
      harness,
      lane: "agent",
      provider: profile.provider,
      kind: profile.kind,
      homeDir: profile.homeDir,
      templateDir: TEMPLATE_DIRS[environment],
      harnessRef: hermesRef,
      hermesRef,
      stateDir: harnessProfile("hermes").stateDir,
      ports: {
        hermes: harnessProfile("hermes").ports.api,
        dashboard: harnessProfile("hermes").ports.dashboard,
      },
      services: profile.services,
      enabledPlatforms: ENABLED_PLATFORMS,
      headedBrowser: profile.headedBrowser,
    };
  }
  const agent = harnessProfile(harness);
  return {
    version: 1,
    environment,
    harness,
    lane: "agent",
    provider: profile.provider,
    kind: profile.kind,
    homeDir: profile.homeDir,
    templateDir: agent.templateDir,
    harnessRef: agent.templateRef,
    hermesRef,
    stateDir: agent.stateDir,
    ports: { hermes: agent.ports.api, dashboard: agent.ports.dashboard },
    services: agent.services[profile.kind],
    enabledPlatforms: agent.enabledPlatforms,
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
