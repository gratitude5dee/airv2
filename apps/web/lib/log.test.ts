/**
 * R-ARCH-04 — the logger contract. Unit-tests the JSON line shape, then
 * greps the box-touching modules for the two disciplines README.md:57
 * requires: no raw console.* (everything goes through lib/log) and a
 * `box_id` key on every log call. Where no box exists in scope the key is
 * still required — `box_id: null` says so explicitly.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { log } from "./log";

const WEB_ROOT = join(__dirname, "..");
const BOX_TOUCHING_DIRS = [
  "lib/box",
  "lib/hermes",
  "lib/orchestrator",
  "lib/provisioning",
  "lib/migration",
  "app/api/box",
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      yield path;
    }
  }
}

/**
 * Given the index of `(` for a call, return the raw text of its argument
 * list through the matching `)` — skipping comments and string/template
 * literals so a `)` inside them cannot end the scan early.
 */
function callArgs(source: string, openParen: number): string {
  let i = openParen + 1;
  let depth = 1;
  const start = i;
  while (i < source.length && depth > 0) {
    const c = source[i]!;
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
        i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    i += 1;
  }
  return source.slice(start, i - 1);
}

function lineOf(source: string, index: number | undefined): number {
  return source.slice(0, index).split("\n").length;
}

describe("log", () => {
  it("emits one JSON line with msg and fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("run failed", {
      user_id: "u1",
      box_id: "bx_1",
      error: "boom",
    });
    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line).toEqual({
      msg: "run failed",
      user_id: "u1",
      box_id: "bx_1",
      error: "boom",
    });
  });

  it("routes warn to console.warn and info/debug to console.log", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    log.warn("w");
    log.info("i");
    log.debug("d");
    expect(warn).toHaveBeenCalledOnce();
    expect(out).toHaveBeenCalledTimes(2);
  });
});

describe("box-touching modules carry the required ids", () => {
  it("no raw console.* inside the box-touching modules", () => {
    const offenders: string[] = [];
    for (const dir of BOX_TOUCHING_DIRS) {
      for (const file of walk(join(WEB_ROOT, dir))) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(
          /\bconsole\.(log|info|warn|error|debug)\s*\(/g
        )) {
          offenders.push(
            `${relative(WEB_ROOT, file)}:${lineOf(source, match.index)}`
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every log.* call in the box-touching modules carries box_id", () => {
    const offenders: string[] = [];
    for (const dir of BOX_TOUCHING_DIRS) {
      for (const file of walk(join(WEB_ROOT, dir))) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(
          /\blog\.(debug|info|warn|error)\s*\(/g
        )) {
          const openParen = source.indexOf("(", match.index);
          const args = callArgs(source, openParen);
          if (!/\bbox_id\s*:/.test(args)) {
            offenders.push(
              `${relative(WEB_ROOT, file)}:${lineOf(source, match.index)}`
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
