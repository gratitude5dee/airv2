import { describe, expect, it } from "vitest";
import type { BundleFile } from "../miniapps/bundles";
import {
  LARGE_DATA_URI_BYTES,
  LintError,
  blankCommentsAndStrings,
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
    it("reports a same-bundle frame as soft, not hard", () => {
      const findings = lintBundle([
        html(`<iframe src="inner.html"></iframe>`),
        file("inner.html", ""),
      ]);
      expect(findings.map((f) => [f.rule, f.severity])).toEqual([
        ["bundled-frame", "soft"],
      ]);
    });
  });

  describe("bundled-frame (frame-src falls back to default-src 'none')", () => {
    it("reports relative and root-relative frame sources with a why", () => {
      const findings = lintBundle([
        html(`<iframe src="/inner.html"></iframe><frame src="./x.html">`),
        file("inner.html", ""),
        file("x.html", ""),
      ]);
      expect(findings.map((f) => f.rule)).toEqual(["bundled-frame", "bundled-frame"]);
      expect(findings[0]?.hint).toMatch(/frame-src/);
    });
    it("ignores frames without a source or with about:blank", () => {
      expect(
        rules([html(`<iframe></iframe><iframe src="about:blank"></iframe>`)])
      ).toEqual([]);
    });
  });

  describe("inline-script (script-src 'self' has no 'unsafe-inline')", () => {
    it("reports a non-empty inline script as soft with a move-to-file hint", () => {
      const findings = lintBundle([
        html(`<script>\n  document.title = 'x';\n</script>`),
      ]);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        rule: "inline-script",
        severity: "soft",
        line: 7,
      });
      expect(findings[0]?.hint).toMatch(/<script src>/);
    });
    it("reports module and importmap bodies too", () => {
      expect(
        rules([
          html(
            `<script type="module">import './a.js'</script><script type="importmap">{"imports":{}}</script>`
          ),
          file("a.js", ""),
        ])
      ).toEqual(["inline-script", "inline-script"]);
    });
    it("leaves external references, empty tags and data blocks alone", () => {
      expect(
        rules([
          html(
            `<script src="a.js"></script><script></script>` +
              `<script type="application/json">{"a":1}</script>` +
              `<script type="application/ld+json">{}</script>` +
              `<script type="text/template"><b>x</b></script>`
          ),
          file("a.js", ""),
        ])
      ).toEqual([]);
    });
    it("a page whose only script is inline still stages (soft only)", () => {
      expect(() => enforceCsp([html(`<script>go()</script>`)])).not.toThrow();
    });
  });

  describe("client-storage", () => {
    it("flags localStorage, sessionStorage and indexedDB", () => {
      expect(
        rules([
          html(`<script src="b.js"></script>`),
          file("b.js", "localStorage.setItem('a', 1)"),
          file("a.js", "sessionStorage.clear(); window.indexedDB.open('x');"),
        ])
      ).toEqual(["client-storage", "client-storage", "client-storage"]);
    });
    it("flags storage inside an inline script alongside the inline finding", () => {
      expect(rules([html(`<script>localStorage.setItem('a', 1)</script>`)])).toEqual([
        "inline-script",
        "client-storage",
      ]);
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
      expect(findings[0]?.hint).toMatch(/^onclick: .*does not run inline handlers/);
    });
    it("allows addEventListener in a bundled script", () => {
      expect(
        rules([
          html(`<button id="b">go</button><script src="b.js"></script>`),
          file("b.js", "b.addEventListener('click', go)"),
        ])
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

  describe("comments and strings", () => {
    it("does not lint storage or eval mentioned in comments", () => {
      expect(
        rules([
          html(""),
          file(
            "app.js",
            [
              "// never use localStorage here",
              "/* eval( is banned",
              "   and so is new Function( */",
              "const note = 'sessionStorage is off'; const t = `indexedDB ${1} eval(`;",
              'const q = "eval(x)";',
            ].join("\n")
          ),
        ])
      ).toEqual([]);
    });

    it("still flags real usage next to a comment and inside template expressions", () => {
      const findings = lintBundle([
        html(""),
        file(
          "app.js",
          [
            "// storage note",
            "const s = 'x'; localStorage.setItem('k', s); // trailing eval( comment",
            "const v = `value ${eval('1')}`;",
          ].join("\n")
        ),
      ]);
      expect(findings.map((f) => [f.rule, f.line])).toEqual([
        ["client-storage", 2],
        ["eval", 3],
      ]);
    });

    it("blanks strings without moving line numbers", () => {
      expect(blankCommentsAndStrings("a = 'x\\'y';\n// c\nb = `t${c}u`;")).toBe(
        "a = '    ';\n    \nb = ` ${c} `;"
      );
    });
  });

  describe("external-media", () => {
    it("reports off-origin images, media, posters and srcsets as soft", () => {
      const findings = lintBundle([
        html(
          [
            `<img src="https://cdn.example.com/a.png">`,
            `<video poster="https://cdn.example.com/p.jpg" src="movie.mp4"></video>`,
            `<audio src="//cdn.example.com/a.mp3"></audio>`,
            `<picture><source srcset="pic.webp 1x, https://cdn.example.com/pic@2x.webp 2x"></picture>`,
            `<video><source src="https://cdn.example.com/m.webm" type="video/webm"></video>`,
          ].join("\n")
        ),
        file("movie.mp4", ""),
        file("pic.webp", ""),
      ]);
      expect(findings.map((f) => f.rule)).toEqual(Array(5).fill("external-media"));
      expect(findings.every((f) => f.severity === "soft")).toBe(true);
      expect(findings[0]?.hint).toContain("https://cdn.example.com/a.png");
    });

    it("allows the platform media origin for images but not for audio/video", () => {
      expect(
        rules([
          html(
            `<img src="https://media.wzrd.tech/u/1.png"><video poster="https://media.wzrd.tech/u/p.jpg" src="v.mp4"></video><img src="data:image/png;base64,AAAA">`
          ),
          file("v.mp4", ""),
        ])
      ).toEqual([]);
      expect(
        rules([html(`<video src="https://media.wzrd.tech/u/v.mp4"></video>`)])
      ).toEqual(["external-media"]);
    });

    it("passes relative media", () => {
      expect(
        rules([
          html(`<img src="a.png" srcset="a.png 1x, a@2x.png 2x"><audio src="s.mp3"></audio>`),
          file("a.png", ""),
          file("a@2x.png", ""),
          file("s.mp3", ""),
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
