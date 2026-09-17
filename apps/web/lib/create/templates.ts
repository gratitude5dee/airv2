/**
 * V12 §11.2 — the Kit's six scaffolds (`packages/create-kit/templates/<id>/`)
 * as the Planner and the Build Service see them. A template is a directory
 * of `air.json` (with `tests[]`, §8.4), `src/**`, an optional `public/**`
 * or `functions/**`, plus two Planner-only documents: `goal.template.md`
 * (the Appendix B skeleton with `<placeholders>`) and `README.md` (two
 * lines: what it is, what the Planner replaces).
 *
 * `loadTemplate` returns only the files a workspace admits
 * (build.ts `safeWorkspacePath`): the Planner copies them into the Box,
 * edits copy and tests, and the Build Service compiles them unchanged. The
 * briefs come from `loadTemplateBrief`. Everything is read from disk on each
 * call — the Kit is a committed tree, so nothing here caches or watches.
 */
import fs from "node:fs";
import path from "node:path";
import type { WorkspaceFile } from "./build";
import { kitRoot } from "./kit";

export const TEMPLATE_IDS = ["landing", "store", "game-2d", "game-3d", "tool", "page"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Planner-facing files that never enter a workspace. */
export const TEMPLATE_GOAL_FILE = "goal.template.md";
export const TEMPLATE_README_FILE = "README.md";

/** Workspace roots a template may ship (build.ts `safeWorkspacePath`). */
const WORKSPACE_DIRS = new Set(["src", "public", "functions"]);
const WORKSPACE_ROOT_FILES = new Set(["air.json"]);

export class TemplateError extends Error {
  readonly status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.name = "TemplateError";
    this.status = status;
  }
}

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/** `<kit>/templates`, honouring `KIT_DIR` the way `kitRoot()` does. */
export function templatesDir(root = kitRoot()): string {
  return path.join(root, "templates");
}

/** `<kit>/templates/<id>`; throws `TemplateError` for an unknown id. */
export function templateDir(id: string, root = kitRoot()): string {
  if (!isTemplateId(id)) throw new TemplateError(`unknown template ${id}`);
  return path.join(templatesDir(root), id);
}

/** Relative POSIX paths of every regular file under `dir`, sorted. */
function walk(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

function isWorkspacePath(rel: string): boolean {
  const top = rel.split("/")[0]!;
  if (WORKSPACE_ROOT_FILES.has(top)) return rel === top;
  return WORKSPACE_DIRS.has(top) && rel.includes("/");
}

/**
 * The template's workspace files as `path → text`: `air.json` and everything
 * under `src/`, `public/` and `functions/`. This is what the Planner copies
 * and what `compileWorkspace` consumes (via `toWorkspaceFiles`).
 */
export function loadTemplate(id: string, root = kitRoot()): Record<string, string> {
  const dir = templateDir(id, root);
  if (!fs.existsSync(path.join(dir, "air.json"))) {
    throw new TemplateError(`template ${id} is missing air.json`, 500);
  }
  const files: Record<string, string> = {};
  for (const rel of walk(dir)) {
    if (!isWorkspacePath(rel)) continue;
    files[rel] = fs.readFileSync(path.join(dir, rel), "utf8");
  }
  return files;
}

export interface TemplateBrief {
  /** Appendix B skeleton, pre-filled for the template, with `<placeholders>`. */
  goal: string;
  /** Two lines: what the template is, what the Planner replaces. */
  readme: string;
}

/** The Planner-only documents beside the workspace files. */
export function loadTemplateBrief(id: string, root = kitRoot()): TemplateBrief {
  const dir = templateDir(id, root);
  const read = (name: string) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) throw new TemplateError(`template ${id} is missing ${name}`, 500);
    return fs.readFileSync(file, "utf8");
  };
  return { goal: read(TEMPLATE_GOAL_FILE), readme: read(TEMPLATE_README_FILE) };
}

/** `path → text` into the Build Service's `WorkspaceFile[]`. */
export function toWorkspaceFiles(files: Record<string, string>): WorkspaceFile[] {
  return Object.entries(files)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([filePath, text]) => ({ path: filePath, bytes: Buffer.from(text, "utf8") }));
}

/** Convenience: a template straight into the shape `compileWorkspace` takes. */
export function templateWorkspace(id: string, root = kitRoot()): WorkspaceFile[] {
  return toWorkspaceFiles(loadTemplate(id, root));
}
