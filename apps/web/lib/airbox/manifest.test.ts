/**
 * airbox manifests project the existing box config — they must stay in
 * lockstep with the environment profiles, never fork their own values.
 */
import { describe, expect, it } from "vitest";
import {
  airboxManifest,
  allManifests,
  ENABLED_PLATFORMS,
  zapLightManifest,
} from "./manifest";
import { ENVIRONMENT_PROFILES } from "@/lib/compute/environments";

describe("airbox manifests", () => {
  it("ubuntu manifest mirrors the existing box config unchanged", () => {
    const manifest = airboxManifest("ubuntu");
    expect(manifest.provider).toBe("ascii");
    expect(manifest.kind).toBe("box");
    expect(manifest.templateDir).toBe("infra/template");
    expect(manifest.homeDir).toBe("/home/user");
    expect(manifest.ports).toEqual({ hermes: 8642, dashboard: 9119 });
    expect(manifest.services).toEqual(ENVIRONMENT_PROFILES.ubuntu.services);
  });

  it("every manifest keeps the C24 gate: api_server is the only platform", () => {
    for (const manifest of allManifests()) {
      expect(manifest.enabledPlatforms).toEqual(ENABLED_PLATFORMS);
      expect(manifest.enabledPlatforms).toEqual(["api_server"]);
    }
  });

  it("zap-light is the ubuntu substrate plus the exec lane", () => {
    const zap = zapLightManifest();
    const ubuntu = airboxManifest("ubuntu");
    expect(zap.lane).toBe("zap-light");
    expect(zap.templateDir).toBe("infra/template-zap-light");
    expect(zap.provider).toBe(ubuntu.provider);
    expect(zap.homeDir).toBe(ubuntu.homeDir);
    expect(zap.services).toEqual([...ubuntu.services, "zap-exec"]);
  });

  it("manifests are JSON-serializable (a self-hosted provider can consume them)", () => {
    for (const manifest of allManifests()) {
      expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    }
  });

  it("the exo manifest projects the exo harness profile", () => {
    const exo = airboxManifest("ubuntu", "exo");
    const ubuntu = airboxManifest("ubuntu");
    expect(ubuntu.harness).toBe("hermes");
    expect(exo.harness).toBe("exo");
    expect(exo.provider).toBe(ubuntu.provider);
    expect(exo.homeDir).toBe(ubuntu.homeDir);
    expect(exo.templateDir).toBe("zap/packages/templates/zap-heavy-exo");
    expect(exo.stateDir).toBe(".exo");
    expect(exo.services).toEqual(["exo-agentd", "exo-host"]);
    expect(exo.ports).toEqual({ hermes: 8642, dashboard: null });
    expect(exo.enabledPlatforms).toEqual(["api_server"]);
    expect(JSON.parse(JSON.stringify(exo))).toEqual(exo);
  });

  it("environments map to their template directories", () => {
    expect(airboxManifest("omarchy").templateDir).toBe(
      "infra/template-omarchy"
    );
    expect(airboxManifest("macos").templateDir).toBe("infra/template-macos");
    expect(airboxManifest("macos").kind).toBe("native");
  });
});
