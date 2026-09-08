/**
 * MA9.1 — Hermes persistent memory, surfaced through the control plane.
 *
 * Memory is content (C4): the two files live in the user's box filesystem
 * (~/.hermes/memories/) and their bytes only ever transit an owner-session
 * request/response or the admin export — never a Postgres row, never a log
 * line. Everything here goes through lib/box wrappers (server-side only).
 */
import { createHash } from "node:crypto";
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

/**
 * Fingerprint of a USER.md revision as the owner loaded it. An absent file
 * and an empty one hash alike, matching how Hermes treats them.
 */
export function profileRevision(content: string | null): string {
  return createHash("sha256").update(content ?? "", "utf8").digest("hex");
}

const REVISION_PATTERN = /^[0-9a-f]{64}$/;

export function isProfileRevision(value: unknown): value is string {
  return typeof value === "string" && REVISION_PATTERN.test(value);
}

/** The profile changed on the box after the owner loaded it. */
export class UserProfileConflictError extends Error {
  constructor() {
    super("user profile changed since it was loaded");
    this.name = "UserProfileConflictError";
  }
}

const CAS_CONFLICT_EXIT = 3;

/**
 * Owner edit of USER.md. Hermes's own memory tool is the file's other
 * writer, so an owner save that carries the revision it started from is a
 * compare-and-swap on the box (hash, then a rename into place): a profile
 * the agent rewrote in the meantime is never silently overwritten and the
 * owner sees a conflict instead. Without a revision the write is
 * unconditional.
 */
export async function writeUserProfile(
  boxId: string,
  content: string,
  baseRevision?: string
): Promise<void> {
  if (baseRevision === undefined) {
    await writeFile(boxId, USER_PROFILE_PATH, content);
    return;
  }
  const path = shellQuote(USER_PROFILE_PATH);
  const result = await command(
    boxId,
    `mkdir -p .hermes/memories && f=${path} && ` +
      `cur=$( { [ -f "$f" ] && cat "$f" || printf ''; } | sha256sum | cut -d' ' -f1 ) && ` +
      `{ [ "$cur" = ${shellQuote(baseRevision)} ] || exit ${CAS_CONFLICT_EXIT}; } && ` +
      `printf '%s' ${shellQuote(content)} > "$f.tmp.$$" && mv -f "$f.tmp.$$" "$f"`
  );
  if (result.exitCode === CAS_CONFLICT_EXIT) throw new UserProfileConflictError();
  if (result.exitCode !== 0) throw new Error("user profile write failed");
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
