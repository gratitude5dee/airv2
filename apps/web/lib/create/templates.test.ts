import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AIR_APP_SCHEMA, compileWorkspace, hard, parseAirJson } from "./build";
import { kitBudgets, kitRoot, listKitComponents } from "./kit";
import { TestsSchema, lockedIds } from "./tests";
import {
  TEMPLATE_GOAL_FILE,
  TEMPLATE_IDS,
  TEMPLATE_README_FILE,
  TemplateError,
  isTemplateId,
  loadTemplate,
  loadTemplateBrief,
  templateDir,
  templateWorkspace,
  templatesDir,
  toWorkspaceFiles,
} from "./templates";

const COMPILE_TIMEOUT_MS = 120_000;

/** `[data-test=foo]` and `[data-test="foo"]` → `foo`. */
function dataTestHooks(selector: string): string[] {
  return [...selector.matchAll(/\[data-test=["']?([A-Za-z0-9_-]+)["']?\]/g)].map((m) => m[1]!);
}

describe("template ids and directories", () => {
  it("names the six V12 templates and resolves them under the Kit", () => {
    expect([...TEMPLATE_IDS]).toEqual(["landing", "store", "game-2d", "game-3d", "tool", "page"]);
    expect(templatesDir()).toBe(path.join(kitRoot(), "templates"));
    for (const id of TEMPLATE_IDS) {
      expect(isTemplateId(id)).toBe(true);
      expect(templateDir(id)).toBe(path.join(kitRoot(), "templates", id));
      expect(fs.existsSync(templateDir(id))).toBe(true);
    }
    expect(isTemplateId("blog")).toBe(false);
    expect(() => templateDir("blog")).toThrowError(TemplateError);
    expect(() => templateDir("../kit")).toThrowError(TemplateError);
  });

  it("honours KIT_DIR the way kitRoot() does", () => {
    const previous = process.env["KIT_DIR"];
    process.env["KIT_DIR"] = "/tmp/some-kit";
    try {
      expect(templatesDir()).toBe(path.resolve("/tmp/some-kit", "templates"));
      expect(templateDir("landing")).toBe(path.resolve("/tmp/some-kit", "templates", "landing"));
    } finally {
      if (previous === undefined) delete process.env["KIT_DIR"];
      else process.env["KIT_DIR"] = previous;
    }
  });

  it("ships the five files per template and keeps the briefs out of the workspace", () => {
    for (const id of TEMPLATE_IDS) {
      const dir = templateDir(id);
      for (const name of ["air.json", "src/main.tsx", "src/app.css", TEMPLATE_GOAL_FILE, TEMPLATE_README_FILE]) {
        expect(fs.existsSync(path.join(dir, name)), `${id}/${name}`).toBe(true);
      }
      const files = loadTemplate(id);
      expect(Object.keys(files)).toContain("air.json");
      expect(Object.keys(files)).toContain("src/main.tsx");
      expect(Object.keys(files)).not.toContain(TEMPLATE_GOAL_FILE);
      expect(Object.keys(files)).not.toContain(TEMPLATE_README_FILE);
      for (const filePath of Object.keys(files)) {
        expect(filePath === "air.json" || /^(src|public|functions)\//.test(filePath), filePath).toBe(true);
      }
      const brief = loadTemplateBrief(id);
      expect(brief.goal).toMatch(/^---\nschema: air\.goal\.v1\n/);
      expect(brief.goal).toContain(`template: ${id}`);
      for (const heading of ["# Outcome", "# Screens", "# Actions", "# Functions", "# Tests", "# Acceptance", "# Out of scope", "# Build log"]) {
        expect(brief.goal, `${id} goal ${heading}`).toContain(heading);
      }
      expect(brief.readme.trim().split("\n")).toHaveLength(2);
    }
  });

  it("orders workspace files deterministically", () => {
    const files = toWorkspaceFiles({ "src/main.tsx": "b", "air.json": "a", "src/app.css": "c" });
    expect(files.map((f) => f.path)).toEqual(["air.json", "src/app.css", "src/main.tsx"]);
    expect(files[0]!.bytes.toString("utf8")).toBe("a");
  });
});

describe.each([...TEMPLATE_IDS])("template %s", (id) => {
  const files = loadTemplate(id);
  const raw = JSON.parse(files["air.json"]!) as {
    appname: string;
    surface?: { lite?: boolean };
    kit?: { components?: string[] };
    tests?: unknown;
  };

  it("has a valid air.json with the template's id, lane and surface", () => {
    const { air, findings } = parseAirJson(files["air.json"]!);
    expect(hard(findings)).toEqual([]);
    expect(air).not.toBeNull();
    expect(air!.schema).toBe(AIR_APP_SCHEMA);
    expect(air!.appname).toBe(id);
    expect(air!.lane).toBe("vibe");
    expect(air!.theme).toBe("atmosphere");
    expect(air!.entry).toBe("src/main.tsx");
    expect(air!.functions).toBeNull();
    expect(air!.surface.expanded).toBe(true);
    // §11.2: game-3d is not lite (three, once vendored, is a hard-budget weight).
    expect(air!.surface.lite).toBe(id !== "game-3d");
    for (const guest of air!.guestActions) expect(air!.actions).toContain(guest);
  });

  it("lists only Kit components that exist, including air", () => {
    const components = listKitComponents();
    const listed = raw.kit?.components ?? [];
    expect(listed).toContain("air");
    for (const component of listed) expect(components.has(component), component).toBe(true);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("declares ≥ 2 locked tests that validate against §8.4", () => {
    const parsed = TestsSchema.safeParse(raw.tests);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    const tests = parsed.success ? parsed.data : [];
    expect(tests.length).toBeGreaterThanOrEqual(2);
    expect(lockedIds(tests).length).toBeGreaterThanOrEqual(2);
    // Every data-test hook a test references is rendered by the template.
    const source = files["src/main.tsx"]!;
    for (const test of tests) {
      const selectors = [test.tap, test.missing, test.changed, test.type?.[0]].filter((s): s is string => typeof s === "string");
      for (const selector of selectors) {
        const hooks = dataTestHooks(selector);
        expect(hooks.length, `${test.id}: ${selector} must address a data-test hook`).toBeGreaterThan(0);
        for (const hook of hooks) {
          expect(source, `${test.id}: data-test="${hook}" is not in src/main.tsx`).toMatch(
            new RegExp(`data-test=(?:"${hook}"|\\{\`${hook.replace(/-[a-z0-9]+$/, "")}-\\$\\{)`)
          );
        }
      }
      // Text the test itself types is echoed by the app, so only static copy must be in the source.
      if (test.see && test.see !== test.type?.[1]) {
        expect(source, `${test.id}: "${test.see}" is not in src/main.tsx`).toContain(test.see.split(" — ")[0]!);
      }
    }
  });

  it("imports only @kit/air, @kit/<id>, react and its own files", () => {
    const source = files["src/main.tsx"]!;
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["'];|^import\s+["']([^"']+)["'];/gm)].map(
      (m) => (m[1] ?? m[2])!
    );
    expect(imports.length).toBeGreaterThan(0);
    const listed = new Set(raw.kit?.components ?? []);
    for (const specifier of imports) {
      if (specifier.startsWith("./")) continue;
      if (specifier === "react" || specifier.startsWith("react-dom")) continue;
      expect(specifier, `${specifier} is not a @kit import`).toMatch(/^@kit\//);
      const kitId = specifier.slice("@kit/".length);
      expect(listed.has(kitId), `${kitId} is imported but not in air.json kit.components`).toBe(true);
    }
    // `three` is not vendored (MC5): no template may import it yet.
    expect(imports).not.toContain("three");
    // Tokens, not literals: no hex colours in the template's own CSS or TSX.
    expect(files["src/app.css"] ?? "").not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/["'`]#[0-9a-f]{3,8}\b/i);
  });

  it(
    "compiles with zero hard findings and fits its budget",
    async () => {
      const out = await compileWorkspace(templateWorkspace(id), { version: "v1700000000000", restricted: false });
      expect(hard(out.findings), JSON.stringify(out.findings)).toEqual([]);
      expect(out.air).not.toBeNull();
      expect(out.manifest).not.toBeNull();
      expect(out.files.map((f) => f.path)).toEqual(expect.arrayContaining(["index.html", "app.js", "app.css", "manifest.json"]));
      const budgets = kitBudgets();
      const jsKb = out.sizes.js_gzip / 1024;
      if (id === "game-3d") {
        expect(jsKb).toBeLessThan(budgets.hardJsKb);
      } else {
        expect(jsKb, `${id} is ${jsKb.toFixed(1)} KiB gzip`).toBeLessThan(budgets.liteJsKb);
        expect(out.findings.filter((f) => f.rule === "budget")).toEqual([]);
      }
      expect(out.sizes.css_gzip / 1024).toBeLessThan(budgets.cssKb);
      // Everything the bundle pulled from the Kit is declared in air.json.
      const declared = new Set(out.air!.kit.components);
      for (const used of out.manifest!.kit.components) {
        expect(declared.has(used), `${used} is bundled but not declared in kit.components`).toBe(true);
      }
      expect(out.manifest!.surface.lite).toBe(id !== "game-3d");
    },
    COMPILE_TIMEOUT_MS
  );
});
