import { describe, expect, it } from "vitest";
import type { BundleFile } from "../miniapps/bundles";
import {
  LARGE_DATA_URI_BYTES,
  LintError,
  enforceCsp,
  hardFindings,
  lintBundle,
  softFindings,
  type LintRule,
} from "./lint";

function file(path: string, text: string): BundleFile {
  return { path, bytes: Buffer.from(text, "utf8") };
}

function html(body: string, head = ""): BundleFile {
  return file(
    "index.html",
    `<!doctype html>\n<html>\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`
  );
}

function rules(files: BundleFile[]): LintRule[] {
  return lintBundle(files).map((finding) => finding.rule);
}

describe("lintBundle", () => {
  it("passes a clean self-contained page", () => {
    const findings = lintBundle([
      html(
        `<h1>hi</h1><script src="app.js"></script><img src="logo.png">`,
        `<link rel="stylesheet" href="style.css">`
      ),
      file("app.js", "document.querySelector('h1').textContent = 'hello';"),
      file("style.css", "h1 { color: red; } @font-face { src: url(fonts/a.woff2); }"),
      file("logo.png", "png"),
    ]);
    expect(findings).toEqual([]);
  });

  describe("external-script", () => {
    it("flags an http(s) script tag", () => {
      const findings = lintBundle([
        html(`<script src="https://cdn.example.com/lib.js"></script>`),
      ]);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        file: "index.html",
        rule: "external-script",
        severity: "hard",
        line: 7,
      });
      expect(findings[0]?.hint).toMatch(/relative path/);
    });
    it("flags protocol-relative and module imports from a URL", () => {
      expect(rules([html(`<script src="//cdn.example.com/x.js"></script>`)])).toEqual([
        "external-script",
      ]);
      expect(
        rules([html(""), file("app.js", `import x from "https://esm.sh/x";`)])
      ).toEqual(["external-script"]);
      expect(
        rules([html(""), file("app.js", `const m = await import("https://esm.sh/x");`)])
      ).toEqual(["external-script"]);
    });
    it("allows relative scripts", () => {
      expect(
        rules([html(`<script src="./js/app.js"></script>`), file("js/app.js", "1")])
      ).toEqual([]);
    });
  });

  describe("external-style", () => {
    it("flags an http(s) stylesheet link and @import", () => {
      expect(
        rules([html("", `<link rel="stylesheet" href="https://x.com/a.css">`)])
      ).toEqual(["external-style"]);
      expect(
        rules([html("", `<style>@import url("https://x.com/a.css");</style>`)])
      ).toEqual(["external-style"]);
      expect(
        rules([html(""), file("a.css", `@import "http://x.com/b.css";`)])
      ).toEqual(["external-style"]);
      expect(
        rules([html(""), file("a.css", `body { background: url(https://x.com/bg.png) }`)])
      ).toEqual(["external-style"]);
    });
    it("allows same-bundle stylesheets", () => {
      expect(
        rules([
          html("", `<link rel="stylesheet" href="a.css">`),
          file("a.css", `@import "b.css"; body { background: url(bg.png) }`),
          file("b.css", ""),
          file("bg.png", ""),
        ])
      ).toEqual([]);
    });
  });

  describe("external-font", () => {
    it("flags a remote @font-face source and a preloaded remote font", () => {
      expect(
        rules([
          html(""),
          file(
            "a.css",
            `@font-face { font-family: X; src: url(https://fonts.gstatic.com/x.woff2); }`
          ),
        ])
      ).toEqual(["external-font"]);
      expect(
        rules([
          html("", `<link rel="preload" as="font" href="https://fonts.gstatic.com/x.woff2">`),
        ])
      ).toEqual(["external-font"]);
    });
    it("allows bundled fonts", () => {
      expect(
        rules([
          html(""),
          file("a.css", `@font-face { font-family: X; src: url(x.woff2); }`),
          file("x.woff2", ""),
        ])
      ).toEqual([]);
    });
  });

  describe("external-frame", () => {
    it("flags a third-party iframe", () => {
      expect(
        rules([html(`<iframe src="https://www.youtube.com/embed/x"></iframe>`)])
      ).toEqual(["external-frame"]);
    });
    it("allows a same-bundle frame", () => {
      expect(
        rules([html(`<iframe src="inner.html"></iframe>`), file("inner.html", "")])
      ).toEqual([]);
    });
  });

  describe("client-storage", () => {
    it("flags localStorage, sessionStorage and indexedDB", () => {
      expect(
        rules([
          html(`<script>localStorage.setItem('a', 1)</script>`),
          file("a.js", "sessionStorage.clear(); window.indexedDB.open('x');"),
        ])
      ).toEqual(["client-storage", "client-storage", "client-storage"]);
    });
    it("does not flag prose outside scripts", () => {
      expect(rules([html(`<p>we never use localStorage</p>`)])).toEqual([]);
    });
  });

  describe("eval", () => {
    it("flags eval( and new Function(", () => {
      expect(
        rules([html(""), file("a.js", `eval("1"); const f = new Function("return 1");`)])
      ).toEqual(["eval", "eval"]);
    });
    it("does not flag identifiers that merely contain eval", () => {
      expect(rules([html(""), file("a.js", `const evaluate = () => 1; evaluate();`)])).toEqual(
        []
      );
    });
  });

  describe("meta-http-equiv", () => {
    it("reports any http-equiv meta as soft", () => {
      const findings = lintBundle([
        html("", `<meta http-equiv="X-UA-Compatible" content="IE=edge">`),
      ]);
      expect(findings.map((f) => [f.rule, f.severity])).toEqual([
        ["meta-http-equiv", "soft"],
      ]);
    });
    it("allows ordinary meta tags", () => {
      expect(rules([html("", `<meta charset="utf-8"><meta name="viewport" content="x">`)])).toEqual(
        []
      );
    });
  });

  describe("inline-handler", () => {
    it("reports inline handlers as soft with the attribute name", () => {
      const findings = lintBundle([html(`<button onclick="go()">go</button>`)]);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ rule: "inline-handler", severity: "soft" });
      expect(findings[0]?.hint).toMatch(/^onclick: /);
    });
    it("allows addEventListener", () => {
      expect(
        rules([html(`<button id="b">go</button><script>b.addEventListener('click', go)</script>`)])
      ).toEqual([]);
    });
  });

  describe("large-data-uri", () => {
    it("reports a base64 blob over 2 MiB as soft", () => {
      const payload = "A".repeat(Math.ceil((LARGE_DATA_URI_BYTES + 3) / 3) * 4);
      const findings = lintBundle([html(`<img src="data:image/png;base64,${payload}">`)]);
      expect(findings.map((f) => [f.rule, f.severity])).toEqual([["large-data-uri", "soft"]]);
    });
    it("allows small data URIs", () => {
      expect(rules([html(`<img src="data:image/png;base64,iVBORw0KGgo=">`)])).toEqual([]);
    });
  });

  describe("dangling-ref", () => {
    it("reports relative references that match nothing", () => {
      const findings = lintBundle([
        html(`<script src="app.js"></script><img src="./img/logo.png">`),
      ]);
      expect(findings.map((f) => [f.rule, f.severity])).toEqual([
        ["dangling-ref", "soft"],
        ["dangling-ref", "soft"],
      ]);
      expect(findings[0]?.hint).toMatch(/^app\.js: /);
    });
    it("resolves nested paths and ignores anchors, roots and schemes", () => {
      expect(
        rules([
          html(
            `<a href="#top">t</a><a href="mailto:x@y.z">m</a><a href="/store">s</a><img src="a/../logo.png"><a href="page.html">p</a>`
          ),
          file("logo.png", ""),
          file("page.html", ""),
        ])
      ).toEqual([]);
    });
  });

  it("skips binary files", () => {
    expect(rules([html(""), file("x.png", "https://cdn.example.com eval(")])).toEqual([]);
  });
});

describe("enforceCsp", () => {
  it("returns the soft findings when nothing is hard", () => {
    const findings = enforceCsp([html(`<button onclick="go()">go</button>`)]);
    expect(findings.map((f) => f.rule)).toEqual(["inline-handler"]);
  });

  it("rejects hard findings with a one-line reason", () => {
    let caught: unknown;
    try {
      enforceCsp([
        html(
          `<script src="https://cdn.example.com/a.js"></script><button onclick="x()">x</button>`,
          `<link rel="stylesheet" href="https://x.com/a.css">`
        ),
      ]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LintError);
    const error = caught as LintError;
    expect(error.status).toBe(400);
    expect(error.message).not.toContain("\n");
    expect(error.message).toMatch(/^index\.html:\d+ external-style: .* \(\+1 more\)$/);
    expect(hardFindings(error.findings)).toHaveLength(2);
    expect(softFindings(error.findings)).toHaveLength(1);
  });
});
