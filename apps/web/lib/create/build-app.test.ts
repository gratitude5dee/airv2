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
const drop = vi.hoisted(() => ({ resolveOrCreateDropApp: vi.fn() }));
vi.mock("./drop", () => drop);
const awake = vi.hoisted(() => ({
  ensureComputeAwake: vi.fn(async (): Promise<{ instanceId: string; environment: string }> => {
    throw new Error("the Box must not be woken when files are supplied");
  }),
}));
vi.mock("../compute/awake", () => awake);
const runtime = vi.hoisted(() => ({
  runCommand: vi.fn(async (): Promise<{ exitCode: number; stdout: string }> => {
    throw new Error("box unreachable");
  }),
}));
vi.mock("../compute/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../compute/runtime")>()),
  runCommand: runtime.runCommand,
}));
const backend = vi.hoisted(() => ({
  calls: [] as string[],
  row: { app_id: "app-1", declared: null as unknown, declared_at: null as string | null, status: "disabled" },
}));
vi.mock("../functions/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../functions/backend")>()),
  ensureFunctionsRow: async () => ({ ...backend.row }),
  loadFunctions: async () => ({ ...backend.row }),
  stageDeclaration: async (_s: unknown, _a: unknown, declared: unknown) => {
    backend.calls.push("stage");
    backend.row = { ...backend.row, declared, declared_at: `t${backend.calls.length}`, status: "draft" };
    return { ...backend.row };
  },
  unstageDeclaration: async (_s: unknown, _id: string, previous: typeof backend.row, stagedAt: string) => {
    backend.calls.push("unstage");
    if (backend.row.declared_at === stagedAt) backend.row = { ...previous };
  },
  fileBackendDecision: async () => {
    backend.calls.push("decision");
    return "dec-1";
  },
}));
vi.mock("../functions/deploy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../functions/deploy")>()),
  appOriginLaneReady: () => false,
}));
const boxes = vi.hoisted(() => ({ armStopAfter: vi.fn(async () => undefined) }));
vi.mock("../orchestrator/boxes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../orchestrator/boxes")>()),
  armStopAfter: boxes.armStopAfter,
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

const FN_AIR = { ...AIR, functions: { entry: "functions/index.ts", db: true } };
function fnTree(): WorkspaceFile[] {
  return [
    { path: "air.json", bytes: Buffer.from(JSON.stringify(FN_AIR)) },
    { path: "src/main.tsx", bytes: Buffer.from(GOOD) },
    {
      path: "functions/index.ts",
      bytes: Buffer.from(
        `import { air } from "@air/functions";\nconst app = air();\napp.get("/api/ping", (c) => c.json({ ok: true }));\nexport default app;\n`
      ),
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  drop.resolveOrCreateDropApp.mockResolvedValue({ app, created: false });
  backend.calls = [];
  backend.row = { app_id: "app-1", declared: null, declared_at: null, status: "disabled" };
  versions.uploadVersion.mockResolvedValue("v1700000000009");
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
    expect(drop.resolveOrCreateDropApp).toHaveBeenCalledWith(
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

  it("re-arms the Box idle deadline after pulling the workspace, even when the pull fails", async () => {
    awake.ensureComputeAwake.mockResolvedValueOnce({ instanceId: "box-1", environment: "ubuntu" });
    await expect(buildApp(supabase, "user-alice", { appname: "countdown" })).rejects.toThrow(
      /box unreachable/
    );
    expect(boxes.armStopAfter).toHaveBeenCalledTimes(1);
    expect(boxes.armStopAfter).toHaveBeenCalledWith(supabase, "user-alice");

    awake.ensureComputeAwake.mockResolvedValueOnce({ instanceId: "box-1", environment: "ubuntu" });
    runtime.runCommand.mockResolvedValueOnce({ exitCode: 3, stdout: "" });
    await expect(buildApp(supabase, "user-alice", { appname: "countdown" })).rejects.toThrow(
      /no workspace/
    );
    expect(boxes.armStopAfter).toHaveBeenCalledTimes(2);
  });

  it("leaves the idle deadline alone for native compute environments", async () => {
    awake.ensureComputeAwake.mockResolvedValueOnce({ instanceId: "ns-1", environment: "macos" });
    await expect(buildApp(supabase, "user-alice", { appname: "countdown" })).rejects.toThrow(
      /box unreachable/
    );
    expect(boxes.armStopAfter).not.toHaveBeenCalled();
  });

  it("files the backend decision only once the version carrying the module is stored", async () => {
    versions.uploadVersion.mockImplementation(async () => {
      backend.calls.push("upload");
      return "v1700000000009";
    });
    const result = await buildApp(supabase, "user-alice", { appname: "countdown", files: fnTree() });
    expect(result.version).toBe("v1700000000009");
    expect(backend.calls).toEqual(["stage", "upload", "decision"]);
    expect(result.log.some((l) => l.includes("need the owner's approval"))).toBe(true);
  }, 60_000);

  it("puts the previous declaration back when the version never gets stored", async () => {
    versions.uploadVersion.mockRejectedValue(new Error("r2 down"));
    await expect(
      buildApp(supabase, "user-alice", { appname: "countdown", files: fnTree() })
    ).rejects.toThrow(/r2 down/);
    expect(backend.calls).toEqual(["stage", "unstage"]);
    expect(backend.row.declared).toBeNull();
    expect(backend.row.status).toBe("disabled");
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
