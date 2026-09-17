import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudflare = vi.hoisted(() => ({
  getKvValue: vi.fn(async (): Promise<string | null> => null),
  putKvValue: vi.fn(async () => undefined),
  deleteKvValue: vi.fn(async () => undefined),
}));
vi.mock("./cloudflare", () => cloudflare);

import { readManifest, signManifest, type AppManifest } from "./manifest";

const manifest: AppManifest = {
  slug: "alice-notes",
  status: "published",
  live: "v1700000000001",
  draft: "v1700000000002",
  dev: null,
  dev_expires_at: null,
  owner_ref: "alice",
  functions: false,
  updated_at: "2026-03-01T12:00:00.000Z",
};

beforeEach(() => {
  process.env["APP_ORIGIN_SIGNING_KEY"] = "app-origin-signing-key";
  cloudflare.getKvValue.mockReset();
  cloudflare.getKvValue.mockResolvedValue(null);
});

describe("readManifest", () => {
  it("returns the manifest this control plane signed", async () => {
    cloudflare.getKvValue.mockResolvedValue(JSON.stringify(signManifest(manifest)));
    await expect(readManifest("alice-notes")).resolves.toEqual(manifest);
    expect(cloudflare.getKvValue).toHaveBeenCalledWith("app:alice-notes");
  });

  it("round-trips the dev pointer and its expiry (V12 CR17), defaulting both to null", async () => {
    const dev: AppManifest = {
      ...manifest,
      dev: "v1700000000003",
      dev_expires_at: "2026-03-15T12:00:00.000Z",
    };
    cloudflare.getKvValue.mockResolvedValue(JSON.stringify(signManifest(dev)));
    await expect(readManifest("alice-notes")).resolves.toEqual(dev);
    // A manifest written before 0117 has no dev fields: they read as null.
    const { dev: _d, dev_expires_at: _e, ...legacy } = manifest;
    cloudflare.getKvValue.mockResolvedValue(
      JSON.stringify(signManifest(legacy as AppManifest))
    );
    await expect(readManifest("alice-notes")).resolves.toEqual(manifest);
  });

  it("is null when nothing is stored", async () => {
    await expect(readManifest("alice-notes")).resolves.toBeNull();
  });

  it("ignores values that are not manifests or not signed under our key", async () => {
    cloudflare.getKvValue.mockResolvedValue("not json");
    await expect(readManifest("alice-notes")).resolves.toBeNull();

    const signed = signManifest(manifest);
    cloudflare.getKvValue.mockResolvedValue(
      JSON.stringify({ ...signed, sig: signed.sig.replace(/^./, (c) => (c === "A" ? "B" : "A")) })
    );
    await expect(readManifest("alice-notes")).resolves.toBeNull();

    process.env["APP_ORIGIN_SIGNING_KEY"] = "another-key";
    cloudflare.getKvValue.mockResolvedValue(JSON.stringify(signed));
    await expect(readManifest("alice-notes")).resolves.toBeNull();
  });
});
