/**
 * Compute environments: which machine a user's agent lives on. The agent
 * itself (Hermes, ~/.hermes, the plugin/skill stack) is identical in all
 * three — only the substrate differs, so everything above this module works
 * against the environment profile instead of hardcoding Ubuntu paths.
 *
 * - ubuntu:  the original ascii.dev Box. Default; nothing about it changed.
 * - omarchy: the same ascii.dev Box, forked from the infra/template-omarchy
 *            template: a real Arch userland (pacman, yay/AUR, Omarchy's own
 *            package manifest) running the Omarchy Hyprland desktop, which is
 *            where the agent's browser lives. `POST /boxes` has no base-image
 *            selector, so Arch is the userland, not the image.
 * - macos:   a Namespace Apple-silicon macOS instance (infra/template-macos).
 *            A different provider, and native rather than containerised, so it
 *            is driven over the template's control bridge, not an exec API.
 */

import { harnessServicesFor } from "@/lib/agent/harness";

export const COMPUTE_ENVIRONMENTS = ["ubuntu", "omarchy", "macos"] as const;

export type ComputeEnvironment = (typeof COMPUTE_ENVIRONMENTS)[number];

/** Existing users and every code path that does not care predate the choice. */
export const DEFAULT_ENVIRONMENT: ComputeEnvironment = "ubuntu";

export type ComputeProvider = "ascii" | "namespace";

/**
 * How the control plane talks to the environment:
 * - box:    ascii.dev Box API (command/readFile/writeFile).
 * - native: a Namespace instance with no container, reached over the
 *           template's own HTTP control bridge — Namespace's CommandService
 *           only runs commands in containers, so macOS has no exec RPC.
 */
export type ComputeKind = "box" | "native";

export function isComputeEnvironment(
  value: unknown,
): value is ComputeEnvironment {
  return (
    typeof value === "string" &&
    (COMPUTE_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

/** Coerce a persisted value (possibly null on pre-migration rows). */
export function toComputeEnvironment(value: unknown): ComputeEnvironment {
  return isComputeEnvironment(value) ? value : DEFAULT_ENVIRONMENT;
}

export interface EnvironmentProfile {
  environment: ComputeEnvironment;
  provider: ComputeProvider;
  kind: ComputeKind;
  /** Owner-facing name — the onboarding card renders these, so no vendor
   * runtime names (SOUL.md identity rules). */
  label: string;
  blurb: string;
  /** Home of the box user; every ~/.hermes path is relative to it. */
  homeDir: string;
  /** Services the per-box secret merge has to bounce to take effect. */
  services: readonly string[];
  /** Whether the environment has a desktop the agent's browser runs headed on. */
  headedBrowser: boolean;
  /** Shown in onboarding but not yet selectable — no template registered. */
  comingSoon: boolean;
}

/** hermes-host re-registers the ascii tunnels after a resume; box-only. */
const BOX_SERVICES = [
  "hermes-gateway",
  "hermes-dashboard",
  "hermes-host",
] as const;

/** Omarchy adds the desktop the agent's browser lives on. */
const OMARCHY_SERVICES = [...BOX_SERVICES, "omarchy-desktop"] as const;

/** Namespace publishes ports declaratively, so it needs no host unit. */
const HERMES_SERVICES = ["hermes-gateway", "hermes-dashboard"] as const;

export const ENVIRONMENT_PROFILES: Record<
  ComputeEnvironment,
  EnvironmentProfile
> = {
  ubuntu: {
    environment: "ubuntu",
    provider: "ascii",
    kind: "box",
    label: "Ubuntu",
    blurb: "Linux desktop. The default — fastest to start, most tested.",
    homeDir: "/home/user",
    services: BOX_SERVICES,
    headedBrowser: true,
    comingSoon: false,
  },
  omarchy: {
    environment: "omarchy",
    provider: "ascii",
    kind: "box",
    label: "Omarchy",
    blurb: "Arch Linux with the Hyprland desktop. Same tools, tiling desktop.",
    homeDir: "/home/user",
    services: OMARCHY_SERVICES,
    headedBrowser: true,
    comingSoon: true,
  },
  macos: {
    environment: "macos",
    provider: "namespace",
    kind: "native",
    label: "macOS",
    blurb: "A real Apple-silicon Mac. Mac-only apps, screen sharing built in.",
    homeDir: "/Users/air",
    services: HERMES_SERVICES,
    headedBrowser: true,
    comingSoon: true,
  },
};

export function profileFor(environment: ComputeEnvironment): EnvironmentProfile {
  return ENVIRONMENT_PROFILES[environment];
}

export function providerFor(environment: ComputeEnvironment): ComputeProvider {
  return ENVIRONMENT_PROFILES[environment].provider;
}

/** ascii.dev-hosted environments, i.e. the ones that fork a template box. */
export function isBoxEnvironment(environment: ComputeEnvironment): boolean {
  return providerFor(environment) === "ascii";
}

export function kindFor(environment: ComputeEnvironment): ComputeKind {
  return ENVIRONMENT_PROFILES[environment].kind;
}

export function hermesVenvBin(
  environment: ComputeEnvironment,
  binary: string,
): string {
  return `${profileFor(environment).homeDir}/.hermes-venv/bin/${binary}`;
}

export function hermesPath(
  environment: ComputeEnvironment,
  relative: string,
): string {
  return `${profileFor(environment).homeDir}/.hermes/${relative}`;
}

/**
 * Restart command for a set of services: systemd on a box (both Linux
 * environments), launchd on macOS, where the units are per-user LaunchAgents
 * labelled tech.wzrd.air.<service>. Units are filtered to those the
 * environment's default profile or any harness declares for its compute
 * kind, so a caller can never restart an arbitrary unit name.
 */
export function restartCommand(
  environment: ComputeEnvironment,
  services: readonly string[] = profileFor(environment).services,
): string {
  const known = new Set([
    ...profileFor(environment).services,
    ...harnessServicesFor(kindFor(environment)),
  ]);
  const wanted = services.filter((service) => known.has(service));
  if (wanted.length === 0) return "true";
  switch (kindFor(environment)) {
    case "box":
      return `sudo systemctl restart ${wanted.join(" ")}`;
    case "native":
      return wanted
        .map(
          (service) =>
            `launchctl kickstart -k "gui/$(id -u)/tech.wzrd.air.${service}"`,
        )
        .join(" && ");
  }
}
