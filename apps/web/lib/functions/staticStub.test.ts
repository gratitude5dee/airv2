import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STATIC_STUB_MAIN, STATIC_STUB_MODULE } from "./staticStub";

const CANONICAL = new URL(
  "../../../../infra/workers/static-stub/index.mjs",
  import.meta.url
);

describe("static stub", () => {
  it("embedded module matches infra/workers/static-stub byte for byte", () => {
    const onDisk = readFileSync(CANONICAL, "utf8");
    expect(STATIC_STUB_MODULE).toBe(onDisk);
  });

  it("main module name is stable", () => {
    expect(STATIC_STUB_MAIN).toBe("index.mjs");
  });
});
