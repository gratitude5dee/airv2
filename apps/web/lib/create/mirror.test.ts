import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";
import type { VersionRow } from "./versions";

import { expectLog } from "../testing/expectLog";
const github = vi.hoisted(() => ({ installationToken: vi.fn(async () => "ghs_token") }));
vi.mock("../github/app", () => ({ installationToken: github.installationToken }));

const limits = vi.hoisted(() => ({ recordOpsEvent: vi.fn(async () => undefined) }));
vi.mock("../security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/limits")>()),
  recordOpsEvent: limits.recordOpsEvent,
}));

// The Box pull is never exercised here: every mirrorVersion call passes files.
vi.mock("../compute/awake", () => ({ ensureComputeAwake: vi.fn(async () => { throw new Error("no box in tests"); }) }));

import {
  assembleMirrorFolder,
  builtFileListFor,
  commitMessage,
  filterMirrorTree,
  HOSTING_STATEMENT,
  MANIFEST_PATH,
  MirrorError,
  mirrorFolder,
  mirrorVersion,
  NOTICE_MD,
  NOTICE_PATH,
  removeMirror,
  renderReadme,
  TIER_B_STUB,
  writeManifest,
} from "./mirror";

/* ------------------------------------------------------------ fixtures */

const app = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  publisher_username: "alice",
  name: "Promo",
  description: "A tour page",
  status: "published",
  bundle_version: "v1700000000001",
  dev_version: "v1700000000001",
  dev_expires_at: "2099-01-01T00:00:00.000Z",
});

const version: VersionRow = {
  id: "row-1",
  app_id: app.id,
  user_id: "user-alice",
  version: "v1700000000001",
  lane: "vibe",
  bundle_sha256: "abcdef0123456789".repeat(4),
  bundle_bytes: 2048,
  file_count: 4,
  worker_sha256: null,
  kit_version: "1.4.0",
  functions: null,
  findings: [],
  qa_score: 88,
  tests_total: 3,
  tests_passed: 3,
  created_at: "2026-01-01T00:00:00.000Z",
  published_at: "2026-01-03T00:00:00.000Z",
  retired_at: null,
  purged_at: null,
};

const built = ["air.json", "create.plan.md", "src/main.tsx", "src/hero.tsx", "src/config.ts", "public/logo.png", "public/big.bin"];

const tree = [
  { path: "air.json", text: '{"schema":"air.app.v1","appname":"promo","name":"Promo"}' },
  { path: "create.plan.md", text: "# Promo\n\nWhat you'll get\n" },
  { path: "src/main.tsx", text: 'import { Hero } from "./hero";\nexport default Hero;\n' },
  { path: "src/hero.tsx", text: 'import { Shutter } from "@kit/restricted/shutter-type";\nexport const Hero = Shutter;\n' },
  { path: "src/config.ts", text: 'export const key = "AKIAABCDEFGHIJKLMNOP";\n' },
  { path: "src/scratch.ts", text: "export const unused = 1;\n" },
  { path: ".build/index.html", text: "<html></html>" },
  { path: "src/.build/cache.json", text: "{}" },
  { path: "node_modules/left-pad/index.js", text: "module.exports = 1;" },
  { path: "public/logo.png", bytes: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]), Buffer.alloc(64, 7)]) },
  { path: "public/big.bin", bytes: Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.alloc(2 * 1024 * 1024 + 1, 9)]) },
];

/* ------------------------------------------------------------ fake db */

const db = vi.hoisted(() => ({
  writes: [] as { table: string; values: Record<string, unknown>; filters: Record<string, unknown> }[],
  failVersions: false,
}));

function fakeSupabase(): SupabaseClient {
  const from = (table: string) => {
    const call = { table, values: {} as Record<string, unknown>, filters: {} as Record<string, unknown> };
    const builder: Record<string, unknown> = {
      update: (values: Record<string, unknown>) => ((call.values = values), builder),
      eq: (column: string, value: unknown) => ((call.filters[column] = value), builder),
      then: (resolve: (value: unknown) => unknown) => {
        db.writes.push(call);
        const error = table === "miniapp_versions" && db.failVersions ? { message: "down" } : null;
        return Promise.resolve({ data: null, error }).then(resolve);
      },
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

/* ------------------------------------------------------ fake git data */

interface Recorded {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

function fakeGitHub(options: { existing?: string[]; failAt?: string } = {}) {
  const calls: Recorded[] = [];
  const blobs = new Map<string, Buffer>();
  let n = 0;
  const fetchMock = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input);
    const path = url.pathname.replace(/^\/repos\/gratitude5dee\/wzrd-create/, "") + (url.search || "");
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method: init?.method ?? "GET", path, body });
    if (options.failAt && path.startsWith(options.failAt)) {
      return new Response(JSON.stringify({ message: "boom" }), { status: 502 });
    }
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    if (path === "/git/ref/heads/main") return json({ object: { sha: "head000" } });
    if (path === "/git/commits/head000") return json({ tree: { sha: "tree000" } });
    if (path.startsWith("/git/trees/tree000")) {
      return json({
        tree: [
          { path: "README.md", type: "blob", mode: "100644" },
          ...(options.existing ?? []).map((p) => ({ path: p, type: "blob", mode: "100644" })),
        ],
      });
    }
    if (path === "/git/blobs") {
      n += 1;
      const sha = `blob${String(n).padStart(3, "0")}`;
      blobs.set(sha, Buffer.from(String(body?.["content"]), "base64"));
      return json({ sha });
    }
    if (path === "/git/trees") return json({ sha: "tree111" });
    if (path === "/git/commits") return json({ sha: "c0ffee".repeat(7).slice(0, 40) });
    if (path === "/git/refs/heads/main") return json({ ref: "refs/heads/main" });
    return new Response("not found", { status: 404 });
  };
  return { calls, blobs, fetch: fetchMock };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.writes = [];
  db.failVersions = false;
  process.env["CREATE_MIRROR_ENABLED"] = "true";
  process.env["WZRD_CREATE_INSTALLATION_ID"] = "4242";
});

/* ------------------------------------------------------------- filter */

describe("filterMirrorTree", () => {
  it("omits each reason once and keeps the rest byte for byte", () => {
    const { kept, omitted } = filterMirrorTree(tree, built);
    expect(omitted).toEqual(
      expect.arrayContaining([
        { path: ".build/index.html", reason: "build-dir" },
        { path: "src/.build/cache.json", reason: "build-dir" },
        { path: "node_modules/left-pad/index.js", reason: "node_modules" },
        { path: "src/scratch.ts", reason: "not-built" },
        { path: "src/hero.tsx", reason: "tier-b" },
        { path: "src/config.ts", reason: "secret" },
        { path: "public/big.bin", reason: "too-large" },
      ])
    );
    expect(omitted).toHaveLength(7);
    const paths = kept.map((file) => file.path).sort();
    expect(paths).toEqual(["NOTICE.md", "air.json", "create.plan.md", "public/logo.png", "src/hero.tsx", "src/main.tsx"]);
    expect(kept.find((file) => file.path === "src/main.tsx")?.bytes.toString("utf8")).toContain("./hero");
    expect(kept.find((file) => file.path === "public/logo.png")?.bytes.length).toBe(72);
  });

  it("replaces a Tier B module body with the stub and adds NOTICE.md exactly once", () => {
    const { kept } = filterMirrorTree(
      [
        { path: "src/a.tsx", text: "import x from '@kit/restricted/rush-type';" },
        { path: "src/b.tsx", text: 'const m = await import("@kit/restricted/swing-type");' },
      ],
      ["src/a.tsx", "src/b.tsx"]
    );
    expect(kept.filter((file) => file.path === NOTICE_PATH)).toHaveLength(1);
    expect(kept.find((file) => file.path === NOTICE_PATH)?.bytes.toString("utf8")).toBe(NOTICE_MD);
    for (const path of ["src/a.tsx", "src/b.tsx"]) {
      expect(kept.find((file) => file.path === path)?.bytes.toString("utf8")).toBe(TIER_B_STUB);
    }
    // Only the NOTICE names the pack; no module body still imports it.
    const modules = kept.filter((file) => file.path !== NOTICE_PATH).map((file) => file.bytes.toString("utf8"));
    expect(JSON.stringify(modules)).not.toContain("@kit/restricted/");
  });

  it("a public kit import is not Tier B; no stub means no NOTICE", () => {
    const { kept, omitted } = filterMirrorTree(
      [{ path: "src/a.tsx", text: 'import { Card } from "@kit/card";' }],
      ["src/a.tsx"]
    );
    expect(omitted).toEqual([]);
    expect(kept.map((file) => file.path)).toEqual(["src/a.tsx"]);
  });

  it("every secret shape textContainsSecrets knows is a `secret` omission", () => {
    const files = [
      { path: "functions/a.ts", text: "-----BEGIN PRIVATE KEY-----" },
      { path: "functions/b.ts", text: "const t = 'ghp_abcdefghijklmnopqrstuvwxyz';" },
      { path: "functions/c.ts", text: "otpauth://totp/x" },
      { path: "functions/d.ts", text: "card 4111 1111 1111 1111" },
    ];
    const { kept, omitted } = filterMirrorTree(files, files.map((file) => file.path));
    expect(kept).toEqual([]);
    expect(omitted.every((entry) => entry.reason === "secret")).toBe(true);
    expect(omitted).toHaveLength(4);
  });

  it("normalizes paths and keeps a ≤ 2 MiB binary", () => {
    const bytes = Buffer.concat([Buffer.from([0, 1]), Buffer.alloc(2 * 1024 * 1024 - 2, 1)]);
    const { kept, omitted } = filterMirrorTree([{ path: "./public/ok.bin", bytes }], ["public/ok.bin"]);
    expect(omitted).toEqual([]);
    expect(kept[0]?.path).toBe("public/ok.bin");
  });
});

/* ------------------------------------------------ manifest and readme */

describe("writeManifest / renderReadme", () => {
  it("manifest carries version, digests, kit, timestamp and the sorted omitted list", () => {
    const file = writeManifest({
      version: "v1700000000001",
      bundle_sha256: version.bundle_sha256,
      worker_sha256: null,
      kit_version: "1.4.0",
      mirrored_at: "2026-02-01T00:00:00.000Z",
      omitted: [
        { path: "src/z.ts", reason: "secret" },
        { path: "src/a.ts", reason: "tier-b" },
      ],
    });
    expect(file.path).toBe(MANIFEST_PATH);
    const parsed = JSON.parse(file.bytes.toString("utf8")) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      schema: "wzrd.mirror.v1",
      version: "v1700000000001",
      bundle_sha256: version.bundle_sha256,
      worker_sha256: null,
      kit_version: "1.4.0",
      mirrored_at: "2026-02-01T00:00:00.000Z",
    });
    expect(parsed["omitted"]).toEqual([
      { path: "src/a.ts", reason: "tier-b" },
      { path: "src/z.ts", reason: "secret" },
    ]);
  });

  it("README names the app, both URLs, the kit, the tests summary and the hosting statement", () => {
    const readme = renderReadme({
      name: "Promo",
      description: "A tour page",
      username: "alice",
      appname: "promo",
      devUrl: "https://link.wzrd.tech/alice/promo",
      productionUrl: "https://mini.wzrd.tech/alice/promo",
      kitVersion: "1.4.0",
      version: "v1700000000001",
      tests: { passed: 3, total: 3 },
    });
    expect(readme).toContain("# Promo");
    expect(readme).toContain("A tour page");
    expect(readme).toContain("https://link.wzrd.tech/alice/promo");
    expect(readme).toContain("https://mini.wzrd.tech/alice/promo");
    expect(readme).toContain("`1.4.0`");
    expect(readme).toContain("3/3 acceptance tests passing");
    expect(readme).toContain(HOSTING_STATEMENT);
    expect(renderReadme({ name: "X", description: "", username: "a", appname: "b", devUrl: null, productionUrl: "u", kitVersion: null, version: "v1", tests: null })).toContain(
      "no acceptance tests declared"
    );
  });

  it("commitMessage and mirrorFolder follow §10.2", () => {
    expect(mirrorFolder(app)).toBe("apps/alice/promo");
    expect(commitMessage(app, version)).toBe("apps/alice/promo: v1700000000001 (abcdef012345)");
  });
});

/* ------------------------------------------------------------ mirror */

describe("mirrorVersion", () => {
  it("one commit per version through the git-data API with the scrubbed tree", async () => {
    const gh = fakeGitHub({ existing: ["apps/alice/promo/src/old.tsx", "apps/bob/other/src/main.tsx"] });
    const supabase = fakeSupabase();
    const now = new Date("2026-02-01T00:00:00.000Z");
    const receipt = await mirrorVersion(supabase, app, version, {
      fetch: gh.fetch,
      files: tree,
      builtFileList: built,
      docs: { goal: "# goal\n\n## Tests\n", plan: null },
      now,
    });
    expect(github.installationToken).toHaveBeenCalledWith(4242, { permissions: { contents: "write" } });
    expect(receipt.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(receipt.folder).toBe("apps/alice/promo");

    // Order: ref → head commit → base tree → blobs → tree → commit → ref update.
    const sequence = gh.calls.map((call) => `${call.method} ${call.path.split("?")[0]}`);
    expect(sequence.slice(0, 3)).toEqual(["GET /git/ref/heads/main", "GET /git/commits/head000", "GET /git/trees/tree000"]);
    expect(sequence.slice(-3)).toEqual(["POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/main"]);
    expect(sequence.slice(3, -3).every((line) => line === "POST /git/blobs")).toBe(true);

    const commit = gh.calls.find((call) => call.method === "POST" && call.path === "/git/commits")?.body;
    expect(commit).toMatchObject({ message: "apps/alice/promo: v1700000000001 (abcdef012345)", parents: ["head000"], tree: "tree111" });
    const ref = gh.calls.find((call) => call.method === "PATCH")?.body;
    expect(ref).toEqual({ sha: receipt.commit, force: false });

    const treeBody = gh.calls.find((call) => call.method === "POST" && call.path === "/git/trees")?.body as {
      base_tree: string;
      tree: { path: string; sha: string | null }[];
    };
    expect(treeBody.base_tree).toBe("tree000");
    const written = treeBody.tree.filter((entry) => entry.sha !== null).map((entry) => entry.path).sort();
    expect(written).toEqual([
      "apps/alice/promo/.wzrd/manifest.json",
      "apps/alice/promo/NOTICE.md",
      "apps/alice/promo/README.md",
      "apps/alice/promo/air.json",
      "apps/alice/promo/goal.md",
      "apps/alice/promo/plan.md",
      "apps/alice/promo/public/logo.png",
      "apps/alice/promo/src/hero.tsx",
      "apps/alice/promo/src/main.tsx",
    ]);
    // The stale file under this app's folder is deleted; another app's folder is untouched.
    expect(treeBody.tree.filter((entry) => entry.sha === null).map((entry) => entry.path)).toEqual(["apps/alice/promo/src/old.tsx"]);
    expect(written.some((path) => path.includes(".build/"))).toBe(false);

    // No Tier B source, no secret, in any blob; the manifest lists what was stripped.
    const blobText = [...gh.blobs.values()].map((blob) => blob.toString("utf8")).join("\n");
    expect(blobText.split("\n").filter((line) => /@kit\/restricted\//.test(line) && !line.includes("`@kit/restricted/*`"))).toEqual([]);
    expect(blobText).not.toContain("AKIA");
    expect(blobText).toContain(TIER_B_STUB.trim());
    const manifestBlob = [...gh.blobs.values()].find((blob) => blob.toString("utf8").includes('"schema": "wzrd.mirror.v1"'));
    const manifest = JSON.parse(manifestBlob!.toString("utf8")) as { omitted: { path: string; reason: string }[]; mirrored_at: string };
    expect(manifest.mirrored_at).toBe(now.toISOString());
    expect(manifest.omitted.map((entry) => `${entry.path}:${entry.reason}`).sort()).toEqual(
      [
        ".build/index.html:build-dir",
        "node_modules/left-pad/index.js:node_modules",
        "public/big.bin:too-large",
        "src/.build/cache.json:build-dir",
        "src/config.ts:secret",
        "src/hero.tsx:tier-b",
        "src/scratch.ts:not-built",
      ]
    );

    // Receipt: mirrored_at + mirror_commit on the version row, one ops event.
    expect(db.writes).toEqual([
      {
        table: "miniapp_versions",
        values: { mirrored_at: now.toISOString(), mirror_commit: receipt.commit },
        filters: { id: "row-1" },
      },
    ]);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "mirror", "user-alice", "alice-promo", 9);
  });

  it("a GitHub failure sets create_intakes.mirror_error to a short class and rethrows MirrorError", async () => {
    const gh = fakeGitHub({ failAt: "/git/trees" });
    await expect(
      mirrorVersion(fakeSupabase(), app, version, { fetch: gh.fetch, files: tree, builtFileList: built })
    ).rejects.toBeInstanceOf(MirrorError);
    expect(db.writes).toEqual([
      {
        table: "create_intakes",
        values: { mirror_error: "github_502", updated_at: expect.any(String) },
        filters: { app_id: app.id, user_id: "user-alice" },
      },
    ]);
    expect(limits.recordOpsEvent).not.toHaveBeenCalled();
    expectLog(/mirror\ failed/, { level: "error" });
  });

  it("an unconfigured installation is a 503 MirrorError before any GitHub call", async () => {
    delete process.env["WZRD_CREATE_INSTALLATION_ID"];
    const gh = fakeGitHub();
    await expect(
      mirrorVersion(fakeSupabase(), app, version, { fetch: gh.fetch, files: tree, builtFileList: built })
    ).rejects.toMatchObject({ status: 503, message: "mirror_unconfigured" });
    expect(gh.calls).toEqual([]);
    expect(github.installationToken).not.toHaveBeenCalled();
    expectLog(/mirror\ failed/, { level: "error" });
  });

  it("refuses a version row that belongs to another app", async () => {
    await expect(
      mirrorVersion(fakeSupabase(), app, { ...version, app_id: "app-other" }, { fetch: fakeGitHub().fetch, files: tree, builtFileList: built })
    ).rejects.toMatchObject({ message: "version_mismatch" });
  });

  it("removeMirror replaces the folder with one README stating the removal", async () => {
    const gh = fakeGitHub({ existing: ["apps/alice/promo/src/main.tsx", "apps/alice/promo/README.md"] });
    const result = await removeMirror(fakeSupabase(), app, { fetch: gh.fetch, now: new Date("2026-03-01T00:00:00.000Z") });
    const treeBody = gh.calls.find((call) => call.method === "POST" && call.path === "/git/trees")?.body as {
      tree: { path: string; sha: string | null }[];
    };
    expect(treeBody.tree).toEqual([
      { path: "apps/alice/promo/src/main.tsx", mode: "100644", type: "blob", sha: null },
      { path: "apps/alice/promo/README.md", mode: "100644", type: "blob", sha: "blob001" },
    ]);
    expect(gh.blobs.get("blob001")?.toString("utf8")).toContain("removed from the mirror on 2026-03-01");
    expect(gh.calls.find((call) => call.path === "/git/commits" && call.method === "POST")?.body).toMatchObject({
      message: "apps/alice/promo: removed",
    });
    expect(result.folder).toBe("apps/alice/promo");
  });
});

describe("assembleMirrorFolder / builtFileListFor", () => {
  it("renames create.plan.md to plan.md when no plan.md was read and keeps goal.md", () => {
    const { files } = assembleMirrorFolder({
      app,
      version,
      files: tree,
      builtFileList: built,
      goal: "# goal",
      plan: null,
      now: new Date("2026-02-01T00:00:00.000Z"),
    });
    const paths = files.map((file) => file.path);
    expect(paths).toContain("plan.md");
    expect(paths).not.toContain("create.plan.md");
    expect(files.find((file) => file.path === "plan.md")?.bytes.toString("utf8")).toBe("# Promo\n\nWhat you'll get\n");
    expect(files.find((file) => file.path === "goal.md")?.bytes.toString("utf8")).toBe("# goal");
  });

  it("without R2 every source-shaped and public path counts as built", async () => {
    delete process.env["R2_ACCOUNT_ID"];
    const list = await builtFileListFor(app, version, tree);
    expect(list).toEqual(expect.arrayContaining(["air.json", "create.plan.md", "src/main.tsx", "public/logo.png"]));
    expect(list).not.toContain(".build/index.html");
    expect(list).not.toContain("node_modules/left-pad/index.js");
  });
});
