import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";

const versions = vi.hoisted(() => ({
  uploadVersion: vi.fn(async (): Promise<string> => "v1700000000009"),
}));
vi.mock("./versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./versions")>()),
  uploadVersion: versions.uploadVersion,
  newVersionId: () => "v1700000000009",
}));
vi.mock("./preview", () => ({
  draftPreviewUrl: (app: { slug: string; draft_version: string | null }) =>
    `https://${app.slug}.apps.wzrd.tech/__air/enter?v=${app.draft_version}`,
}));
const drop = vi.hoisted(() => ({ resolveDropApp: vi.fn() }));
vi.mock("./drop", () => drop);
vi.mock("../compute/awake", () => ({
  ensureComputeAwake: vi.fn(async () => {
    throw new Error("the Box must not be woken when files are supplied");
  }),
}));

import { AIR_APP_SCHEMA, buildApp, type WorkspaceFile } from "./build";

const supabase = {} as unknown as SupabaseClient;
const app = makeApp({
  slug: "alice-countdown",
  appname: "countdown",
  owner_user_id: "user-alice",
  status: "published",
  bundle_version: "v1700000000000",
  draft_version: null,
  lane: "vibe",
});

const AIR = {
  schema: AIR_APP_SCHEMA,
  appname: "countdown",
  name: "Tour countdown",
  description: "",
  lane: "vibe",
  entry: "src/main.tsx",
  theme: "atmosphere",
  surface: { lite: true, expanded: true },
  kit: { components: ["air"] },
  actions: [],
  guestActions: [],
  functions: null,
  visibility: "public",
  price: 500,
};

function tree(main: string): WorkspaceFile[] {
  return [
    { path: "air.json", bytes: Buffer.from(JSON.stringify(AIR)) },
    { path: "src/main.tsx", bytes: Buffer.from(main) },
  ];
}

const GOOD = `
import { createRoot } from "react-dom/client";
import { cn } from "@kit/air";
createRoot(document.getElementById("root")!).render(<main className={cn("app")}>hi</main>);
`;

beforeEach(() => {
  vi.clearAllMocks();
  drop.resolveDropApp.mockResolvedValue(app);
});

describe("buildApp", () => {
  it("stages a draft only: promote is never set and the live pointer is untouched", async () => {
    const result = await buildApp(supabase, "user-alice", { appname: "countdown", files: tree(GOOD) });
    expect(result.version).toBe("v1700000000009");
    expect(result.preview_url).toContain("v1700000000009");
    expect(versions.uploadVersion).toHaveBeenCalledTimes(1);
    const [, passedApp, files, lane, options] = versions.uploadVersion.mock.calls[0] as unknown as [
      unknown,
      typeof app,
      WorkspaceFile[],
      string,
      { promote: boolean; version: string },
    ];
    expect(passedApp.bundle_version).toBe("v1700000000000");
    expect(lane).toBe("vibe");
    expect(options.promote).toBe(false);
    expect(options.version).toBe("v1700000000009");
    // air.json proposals never reach the bundle's manifest.
    const manifest = JSON.parse(files.find((f) => f.path === "manifest.json")!.bytes.toString());
    expect(manifest).not.toHaveProperty("visibility");
    expect(manifest).not.toHaveProperty("price");
    expect(drop.resolveDropApp).toHaveBeenCalledWith(
      supabase,
      "user-alice",
      { appname: "countdown", name: "Tour countdown", description: "" },
      "vibe"
    );
  }, 60_000);

  it("produces no version when a finding is hard", async () => {
    const result = await buildApp(supabase, "user-alice", {
      appname: "countdown",
      files: tree(`import x from "left-pad"; console.log(x);`),
    });
    expect(result.version).toBeNull();
    expect(result.preview_url).toBeNull();
    expect(result.findings.some((f) => f.severity === "hard")).toBe(true);
    expect(versions.uploadVersion).not.toHaveBeenCalled();
  }, 60_000);

  it("refuses an air.json that names another app", async () => {
    const files = tree(GOOD);
    files[0] = { path: "air.json", bytes: Buffer.from(JSON.stringify({ ...AIR, appname: "other" })) };
    await expect(buildApp(supabase, "user-alice", { appname: "countdown", files })).rejects.toThrow(
      /names other/
    );
    expect(versions.uploadVersion).not.toHaveBeenCalled();
  });
});
