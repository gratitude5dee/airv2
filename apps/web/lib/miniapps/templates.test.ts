/**
 * Creator templates go through the exact validator the bundle upload uses —
 * a template that stops validating is a broken "start from a template" flow.
 */
import { describe, expect, it } from "vitest";
import { readZip, validateBundle } from "./bundles";
import { TEMPLATE_NAMES, isTemplateName, templateZip } from "./templates";

describe("creator templates", () => {
  it("ships exactly the two spec'd templates", () => {
    expect(TEMPLATE_NAMES).toEqual(["static", "todo"]);
    expect(isTemplateName("static")).toBe(true);
    expect(isTemplateName("evil")).toBe(false);
  });

  for (const name of TEMPLATE_NAMES) {
    it(`${name} template parses with readZip and passes validateBundle`, () => {
      const files = readZip(templateZip(name));
      expect(() => validateBundle(files)).not.toThrow();
      expect(files.map((f) => f.path)).toContain("index.html");
    });
  }

  it("todo template talks to the Apps API state endpoint", () => {
    const files = readZip(templateZip("todo"));
    const app = files.find((f) => f.path === "app.js");
    expect(app?.bytes.toString("utf8")).toContain("/api/apps/v1/state");
  });
});
