import { fileURLToPath } from "node:url";
import path from "node:path";

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_ROOT = path.resolve(KIT_ROOT, "..", "..");
export const KIT_DIR = path.join(KIT_ROOT, "kit");
export const VENDOR_DIR = path.join(KIT_ROOT, "vendor");
export const VENDOR_TARBALLS = path.join(VENDOR_DIR, "tarballs");
export const VENDOR_EXTRACTED = path.join(VENDOR_DIR, ".extracted");
export const EVIDENCE_DIR = path.join(KIT_ROOT, "evidence");
export const PROMPTS_DIR = path.join(KIT_ROOT, "prompts");
export const PROMPTS_SRC = path.join(PROMPTS_DIR, "src");
export const CACHE_DIR = path.join(KIT_ROOT, ".cache");
export const HARNESS_DIR = path.join(KIT_ROOT, ".harness");
export const LOCK_FILE = path.join(KIT_ROOT, "kit.lock.json");
export const SOURCES_FILE = path.join(KIT_ROOT, "kit.sources.json");
export const DESIGN_FILE = path.join(KIT_ROOT, "DESIGN.md");
export const SYSTEM_PROMPT_FILE = path.join(PROMPTS_DIR, "create-agent.system.md");
export const TEMPLATE_DESIGN_FILE = path.join(
  REPO_ROOT,
  "infra",
  "template",
  "skills",
  "create-miniapp",
  "DESIGN.md"
);

export function rel(p: string): string {
  return path.relative(KIT_ROOT, p).split(path.sep).join("/");
}
