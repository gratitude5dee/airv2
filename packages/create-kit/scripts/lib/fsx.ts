import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function readText(p: string): string {
  return fs.readFileSync(p, "utf8");
}

export function writeText(p: string, text: string): boolean {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === text) return false;
  fs.writeFileSync(p, text);
  return true;
}

export function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export function writeJson(p: string, value: unknown): boolean {
  return writeText(p, JSON.stringify(value, null, 2) + "\n");
}

export function exists(p: string): boolean {
  return fs.existsSync(p);
}

/** Every regular file under `dir`, as posix paths relative to `dir`, sorted. */
export function walk(dir: string, skip: (name: string) => boolean = () => false): string[] {
  const out: string[] = [];
  const visit = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip(ent.name)) continue;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) visit(full);
      else if (ent.isFile()) out.push(path.relative(dir, full).split(path.sep).join("/"));
    }
  };
  if (fs.existsSync(dir)) visit(dir);
  return out.sort();
}

export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out as T;
  }
  return value;
}
