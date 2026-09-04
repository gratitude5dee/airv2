import { describe, expect, it } from "vitest";
import {
  AIR_APP_SCHEMA,
  checkWorkspace,
  compileWorkspace,
  hard,
  parseAirJson,
  safeWorkspacePath,
  type WorkspaceFile,
} from "./build";

function file(path: string, text: string): WorkspaceFile {
  return { path, bytes: Buffer.from(text, "utf8") };
}

const AIR = {
  schema: AIR_APP_SCHEMA,
  appname: "countdown",
  name: "Tour countdown",
  description: "Days until the show.",
  lane: "vibe",
  entry: "src/main.tsx",
  theme: "atmosphere",
  surface: { lite: true, expanded: true },
  kit: { components: ["fancy/typewriter", "air"] },
  actions: ["rsvp"],
  guestActions: ["rsvp"],
  functions: null,
  visibility: "unlisted",
};

const MAIN = `
import { createRoot } from "react-dom/client";
import Typewriter from "@kit/fancy/typewriter";
import { cn, useLite } from "@kit/air";

function App() {
  const lite = useLite();
  return (
    <div className={cn("frame", lite && "lite")}>
      <header className="bar"><span className="app-pill">Countdown</span></header>
      <main className="app">
        <p className="kicker">October 3</p>
        <h1><Typewriter text="Tour countdown" /></h1>
        <section className="panel"><button className="bg-accent text-on-accent">RSVP</button></section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`;

function workspace(overrides: Partial<Record<string, string | null>> = {}): WorkspaceFile[] {
  const files: Record<string, string | null> = {
    "air.json": JSON.stringify(AIR),
    "src/main.tsx": MAIN,
    ...overrides,
  };
  return Object.entries(files)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([path, text]) => file(path, text));
}

describe("air.json (air.app.v1)", () => {
  it("accepts the spec example and fills defaults", () => {
    const { air, findings } = parseAirJson(JSON.stringify(AIR));
    expect(hard(findings)).toEqual([]);
    expect(air?.entry).toBe("src/main.tsx");
    expect(air?.surface).toEqual({ lite: true, expanded: true });
    expect(air?.functions).toBeNull();
  });

  it("rejects the wrong schema id, unknown keys, and bad names", () => {
    for (const bad of [
      { ...AIR, schema: "air.app.v0" },
      { ...AIR, appname: "Not Valid" },
      { ...AIR, entry: "../../etc/passwd" },
      { ...AIR, sneaky: true },
      { ...AIR, kit: { components: ["../escape"] } },
    ]) {
      const { air, findings } = parseAirJson(JSON.stringify(bad));
      expect(air).toBeNull();
      expect(hard(findings).length).toBeGreaterThan(0);
      expect(findings[0]?.rule).toBe("schema");
    }
    expect(parseAirJson("{not json").air).toBeNull();
  });

  it("requires guestActions to be actions", () => {
    const { air, findings } = parseAirJson(
      JSON.stringify({ ...AIR, actions: [], guestActions: ["rsvp"] })
    );
    expect(air).toBeNull();
    expect(findings.map((f) => f.hint)).toContain("guestActions.rsvp is not one of actions");
  });
});

describe("workspace safety", () => {
  it("only admits air.json, the plan, src/ and public/", () => {
    expect(safeWorkspacePath("air.json")).toBe("air.json");
    expect(safeWorkspacePath("./src/main.tsx")).toBe("src/main.tsx");
    expect(safeWorkspacePath("public/hero.png")).toBe("public/hero.png");
    expect(safeWorkspacePath("../air.json")).toBeNull();
    expect(safeWorkspacePath("src/../../.ssh/id_rsa")).toBeNull();
    expect(safeWorkspacePath("/etc/passwd")).toBeNull();
    expect(safeWorkspacePath(".build/findings.json")).toBeNull();
    expect(safeWorkspacePath("functions/index.ts")).toBeNull();
    expect(safeWorkspacePath("node_modules/react/index.js")).toBeNull();
  });

  it("caps source size and refuses svg assets", () => {
    const findings = checkWorkspace([
      file("src/big.ts", "x".repeat(512 * 1024 + 1)),
      file("public/logo.svg", "<svg/>"),
      file("public/hero.png", "png"),
    ]);
    expect(findings.map((f) => f.rule)).toEqual(["size", "workspace"]);
  });
});

describe("compileWorkspace", () => {
  it("builds the golden path into a draft-shaped bundle", async () => {
    const out = await compileWorkspace(workspace(), { version: "v1700000000000", restricted: false });
    expect(hard(out.findings)).toEqual([]);
    const paths = out.files.map((f) => f.path).sort();
    expect(paths).toEqual(
      expect.arrayContaining(["index.html", "app.js", "app.css", "manifest.json", "fonts/newsreader-latin.woff2"])
    );
    const manifest = JSON.parse(out.files.find((f) => f.path === "manifest.json")!.bytes.toString());
    expect(manifest).toMatchObject({
      actions: ["rsvp"],
      guestActions: ["rsvp"],
      functions: null,
      surface: { lite: true, expanded: true },
      version: "v1700000000000",
    });
    expect(manifest.kit.components).toEqual(["air", "fancy/typewriter"]);
    expect(manifest).not.toHaveProperty("visibility");
    const html = out.files.find((f) => f.path === "index.html")!.bytes.toString();
    expect(html).toContain('data-theme="atmosphere"');
    expect(html).not.toContain("data-lite");
    expect(html).toContain("viewport-fit=cover");
    const js = out.files.find((f) => f.path === "app.js")!.bytes.toString();
    expect(js.startsWith("if(/[?&]lite=1")).toBe(true);
    const css = out.files.find((f) => f.path === "app.css")!.bytes.toString();
    expect(css).toContain("--canvas");
    expect(css).toContain(".panel{");
    expect(css).not.toContain(".tablewrap");
    expect(css).toContain(".bg-accent");
    expect(css).not.toContain("@theme");
    expect(css).not.toContain("@import");
    expect(out.sizes.js_gzip).toBeGreaterThan(0);
    expect(out.log.some((line) => line.startsWith("bundle:"))).toBe(true);
    expect(out.log.join("\n")).not.toContain("Tour countdown");
  }, 60_000);

  it("refuses a foreign specifier as a hard finding and produces no files", async () => {
    const out = await compileWorkspace(
      workspace({ "src/main.tsx": `import left from "left-pad"; console.log(left("a", 2));` }),
      { restricted: false }
    );
    expect(out.files).toEqual([]);
    const foreign = out.findings.find((f) => f.rule === "foreign-import");
    expect(foreign?.severity).toBe("hard");
    expect(foreign?.file).toBe("src/main.tsx");
    expect(foreign?.hint).toContain("left-pad");
  }, 60_000);

  it("refuses an https import and a path that escapes the workspace", async () => {
    const escape = await compileWorkspace(
      workspace({ "src/main.tsx": `import x from "../../../../etc/hostname"; console.log(x);` }),
      { restricted: false }
    );
    expect(escape.files).toEqual([]);
    expect(escape.findings.some((f) => f.rule === "path-escape" && f.severity === "hard")).toBe(true);
    const remote = await compileWorkspace(
      workspace({ "src/main.tsx": `import x from "https://esm.sh/lodash"; console.log(x);` }),
      { restricted: false }
    );
    expect(remote.files).toEqual([]);
    expect(remote.findings.some((f) => f.rule === "foreign-import")).toBe(true);
  }, 60_000);

  it("refuses Tier B when the restricted Kit is not configured", async () => {
    const out = await compileWorkspace(
      workspace({
        "air.json": JSON.stringify({ ...AIR, surface: { lite: false, expanded: true } }),
        "src/main.tsx": `import Aurora from "@kit/restricted/aurora"; console.log(Aurora);`,
      }),
      { restricted: false }
    );
    expect(out.files).toEqual([]);
    expect(out.findings.some((f) => f.rule === "restricted-unavailable" && f.severity === "hard")).toBe(true);
  }, 60_000);

  it("stops on a missing air.json and on a missing entry", async () => {
    const missing = await compileWorkspace(workspace({ "air.json": null }), { restricted: false });
    expect(missing.files).toEqual([]);
    expect(missing.findings[0]?.hint).toBe("air.json is missing");
    const entry = await compileWorkspace(workspace({ "src/main.tsx": null }), { restricted: false });
    expect(entry.findings.some((f) => f.hint.includes("entry src/main.tsx"))).toBe(true);
  });

  it("lints the built bundle: an external script in src/index.html is hard", async () => {
    const out = await compileWorkspace(
      workspace({
        "src/index.html": `<!doctype html><html><head><script src="https://cdn.example.com/x.js"></script></head><body><div id="root"></div></body></html>`,
      }),
      { restricted: false }
    );
    expect(out.files).toEqual([]);
    expect(out.findings.some((f) => f.rule === "external-script" && f.severity === "hard")).toBe(true);
  }, 60_000);

  it("carries public/ assets and reports a collision with build output", async () => {
    const ok = await compileWorkspace(
      workspace({ "public/hero.png": "not-really-png" }),
      { restricted: false }
    );
    expect(ok.files.map((f) => f.path)).toContain("hero.png");
    const clash = await compileWorkspace(
      workspace({ "public/manifest.json": "{}" }),
      { restricted: false }
    );
    expect(clash.files).toEqual([]);
    expect(clash.findings.some((f) => f.hint.includes("collides"))).toBe(true);
  }, 60_000);
});
