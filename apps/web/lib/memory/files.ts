/**
 * MA9.1 — Hermes persistent memory, surfaced through the control plane.
 *
 * Memory is content (C4): the two files live in the user's box filesystem
 * (~/.hermes/memories/) and their bytes only ever transit an owner-session
 * request/response or the admin export — never a Postgres row, never a log
 * line. Everything here goes through lib/box wrappers (server-side only).
 */
import { command, readFile, writeFile } from "@/lib/box/client";
import { shellQuote } from "@/lib/box/shell";

export const MEMORY_PATH = ".hermes/memories/MEMORY.md";
export const USER_PROFILE_PATH = ".hermes/memories/USER.md";

/** Hermes enforces 1,375 chars on USER.md tool writes; owner edits get the
 * same bound so a web edit can't blow the system-prompt budget. */
export const USER_PROFILE_CHAR_LIMIT = 1375;

export type MemoryTarget = "memory" | "user" | "both";

export interface MemoryFiles {
  /** MEMORY.md contents, null when the file does not exist yet. */
  memory: string | null;
  /** USER.md contents, null when the file does not exist yet. */
  user: string | null;
}

export async function readMemoryFiles(boxId: string): Promise<MemoryFiles> {
  const [memory, user] = await Promise.all([
    readFile(boxId, MEMORY_PATH).catch(() => null),
    readFile(boxId, USER_PROFILE_PATH).catch(() => null),
  ]);
  return { memory, user };
}

export async function writeUserProfile(
  boxId: string,
  content: string
): Promise<void> {
  await writeFile(boxId, USER_PROFILE_PATH, content);
}

/** Clear = truncate to empty (the gateway re-reads at session start; an
 * absent vs empty file behave the same, and truncating never races a
 * concurrent memory-tool write into a deleted directory). */
export async function clearMemoryFiles(
  boxId: string,
  target: MemoryTarget
): Promise<void> {
  const paths: string[] = [];
  if (target === "memory" || target === "both") paths.push(MEMORY_PATH);
  if (target === "user" || target === "both") paths.push(USER_PROFILE_PATH);
  const result = await command(
    boxId,
    `mkdir -p .hermes/memories && ${paths
      .map((path) => `: > ${shellQuote(path)}`)
      .join(" && ")}`
  );
  if (result.exitCode !== 0) {
    throw new Error("memory clear failed");
  }
}
