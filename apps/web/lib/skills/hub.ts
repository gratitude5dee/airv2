/**
 * Skill hub operations, executed inside the user's own box via the Box
 * command API — the same server-side path `hermes mcp add` uses (C3: no
 * box URL or key ever reaches a browser). Inputs are strictly validated
 * before being interpolated into a shell command.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";

const QUERY_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Base skills installed on every new box at provision time (on top of the
 * bundled skill library Hermes ships with).
 */
export const BASE_SKILLS = [
  "official/email/agentmail",
  "official/research/duckduckgo-search",
] as const;

/** Best-effort base-skill install on an already-awake box (provisioning). */
export async function installBaseSkills(boxId: string): Promise<void> {
  for (const identifier of BASE_SKILLS) {
    try {
      const result = await command(
        boxId,
        `/home/user/.hermes-venv/bin/hermes skills install "${identifier}" --yes`,
        300
      );
      if (result.exitCode !== 0) {
        console.error(
          JSON.stringify({
            msg: "base skill install failed",
            box_id: boxId,
            skill: identifier,
            error: (result.stderr || result.stdout).slice(0, 200),
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(
        JSON.stringify({
          msg: "base skill install failed",
          box_id: boxId,
          skill: identifier,
          error: message,
        })
      );
    }
  }
}

export interface HubSkill {
  name: string;
  identifier: string;
  source: string;
  trust_level: string;
  description: string;
}

export class SkillHubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SkillHubError";
    this.status = status;
  }
}

function validate(pattern: RegExp, value: string, label: string): string {
  if (!pattern.test(value) || value.includes("..")) {
    throw new SkillHubError(400, `invalid ${label}`);
  }
  return value;
}

/** Extract the JSON array from CLI stdout that may carry leading noise. */
function parseJsonArray(stdout: string): unknown[] {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(stdout.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function searchHub(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<HubSkill[]> {
  validate(QUERY_RE, query, "query");
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(
    box.boxId,
    `/home/user/.hermes-venv/bin/hermes skills search "${query}" --json --limit 20`,
    180
  );
  if (result.exitCode !== 0) {
    throw new SkillHubError(502, `skill search failed: ${result.stderr.slice(0, 200)}`);
  }
  return parseJsonArray(result.stdout).map((r) => {
    const row = r as Partial<HubSkill>;
    return {
      name: row.name ?? "",
      identifier: row.identifier ?? "",
      source: row.source ?? "",
      trust_level: row.trust_level ?? "",
      description: row.description ?? "",
    };
  });
}

export async function installSkill(
  supabase: SupabaseClient,
  userId: string,
  identifier: string
): Promise<void> {
  validate(IDENTIFIER_RE, identifier, "identifier");
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(
    box.boxId,
    `/home/user/.hermes-venv/bin/hermes skills install "${identifier}" --yes`,
    300
  );
  if (result.exitCode !== 0) {
    throw new SkillHubError(
      502,
      `skill install failed: ${(result.stderr || result.stdout).slice(0, 200)}`
    );
  }
}

export async function uninstallSkill(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<void> {
  validate(NAME_RE, name, "name");
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(
    box.boxId,
    `/home/user/.hermes-venv/bin/hermes skills uninstall "${name}"`,
    180
  );
  if (result.exitCode !== 0) {
    throw new SkillHubError(
      502,
      `skill uninstall failed: ${(result.stderr || result.stdout).slice(0, 200)}`
    );
  }
}
