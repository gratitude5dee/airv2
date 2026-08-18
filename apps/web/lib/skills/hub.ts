/**
 * Skill hub operations, executed inside the user's own box via the Box
 * command API — the same server-side path `hermes mcp add` uses (C3: no
 * box URL or key ever reaches a browser). Inputs are strictly validated
 * before being interpolated into a shell command.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { shellQuote } from "../box/shell";
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
        `/home/user/.hermes-venv/bin/hermes skills install ${shellQuote(identifier)} --yes`,
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
    `/home/user/.hermes-venv/bin/hermes skills search ${shellQuote(query)} --json --limit 20`,
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
    `/home/user/.hermes-venv/bin/hermes skills install ${shellQuote(identifier)} --yes`,
    300
  );
  if (result.exitCode !== 0) {
    throw new SkillHubError(
      502,
      `skill install failed: ${(result.stderr || result.stdout).slice(0, 200)}`
    );
  }
}

export interface SkillUpdateStatus {
  name: string;
  identifier: string;
  source: string;
  status: "up_to_date" | "update_available" | "unavailable";
}

const UPDATE_STATUSES = new Set(["up_to_date", "update_available", "unavailable"]);

/**
 * Hub-vs-installed comparison, computed by Hermes' own updater inside the
 * box (content-hash of the recorded provenance source — never a cross-registry
 * fallback). Fixed script, no interpolation; the cd puts tools.skills_hub
 * on the import path (python reading stdin resolves imports from the cwd).
 */
const CHECK_SCRIPT = `cd /home/user/hermes-agent && /home/user/.hermes-venv/bin/python - <<'PY'
import json
from tools.skills_hub import check_for_skill_updates
print(json.dumps(check_for_skill_updates()))
PY`;

export async function checkSkillUpdates(
  supabase: SupabaseClient,
  userId: string
): Promise<SkillUpdateStatus[]> {
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(box.boxId, CHECK_SCRIPT, 180);
  if (result.exitCode !== 0) {
    throw new SkillHubError(
      502,
      `skill update check failed: ${(result.stderr || result.stdout).slice(0, 200)}`
    );
  }
  return parseJsonArray(result.stdout).flatMap((r) => {
    const row = r as Partial<SkillUpdateStatus>;
    if (typeof row.name !== "string" || !UPDATE_STATUSES.has(row.status ?? "")) {
      return [];
    }
    return [
      {
        name: row.name,
        identifier: row.identifier ?? "",
        source: row.source ?? "",
        status: row.status as SkillUpdateStatus["status"],
      },
    ];
  });
}

export async function updateSkill(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<void> {
  validate(NAME_RE, name, "name");
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(
    box.boxId,
    `/home/user/.hermes-venv/bin/hermes skills update ${shellQuote(name)}`,
    300
  );
  if (result.exitCode !== 0) {
    throw new SkillHubError(
      502,
      `skill update failed: ${(result.stderr || result.stdout).slice(0, 200)}`
    );
  }
}

export interface SkillDetail {
  name: string;
  source: string | null;
  trust_level: string | null;
  identifier: string | null;
  installed_at: string | null;
  readme: string | null;
}

/**
 * Detail-sheet data: hub provenance from the lockfile when present, plus the
 * SKILL.md text (bundled/local skills resolve through Hermes' own scanner).
 * The name is validated against NAME_RE and passed as a single-quoted argv,
 * never spliced into python source; the cd puts tools.skills_hub on the
 * import path (python reading stdin resolves imports from the cwd).
 */
function inspectScript(name: string): string {
  return `cd /home/user/hermes-agent && /home/user/.hermes-venv/bin/python - ${shellQuote(name)} <<'PY'
import json, sys
from tools.skills_hub import SKILLS_DIR, HubLockFile
name = sys.argv[1]
out = {"name": name, "source": None, "trust_level": None,
       "identifier": None, "installed_at": None, "readme": None}
entry = HubLockFile().get_installed(name)
path = None
if entry:
    for key in ("source", "trust_level", "identifier", "installed_at"):
        value = entry.get(key)
        if isinstance(value, str):
            out[key] = value
    install_path = entry.get("install_path")
    if isinstance(install_path, str) and install_path:
        candidate = SKILLS_DIR / install_path / "SKILL.md"
        if candidate.is_file():
            path = candidate
if path is None:
    candidate = SKILLS_DIR / name / "SKILL.md"
    if candidate.is_file():
        path = candidate
if path is not None:
    out["readme"] = path.read_text(encoding="utf-8", errors="replace")[:6000]
print(json.dumps(out))
PY`;
}

export async function inspectSkill(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<SkillDetail> {
  validate(NAME_RE, name, "name");
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(box.boxId, inspectScript(name), 120);
  if (result.exitCode !== 0) {
    throw new SkillHubError(
      502,
      `skill inspect failed: ${(result.stderr || result.stdout).slice(0, 200)}`
    );
  }
  const start = result.stdout.indexOf("{");
  const end = result.stdout.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new SkillHubError(502, "skill inspect returned no data");
  }
  let parsed: Partial<SkillDetail>;
  try {
    parsed = JSON.parse(result.stdout.slice(start, end + 1)) as Partial<SkillDetail>;
  } catch {
    throw new SkillHubError(502, "skill inspect returned no data");
  }
  return {
    name,
    source: typeof parsed.source === "string" ? parsed.source : null,
    trust_level: typeof parsed.trust_level === "string" ? parsed.trust_level : null,
    identifier: typeof parsed.identifier === "string" ? parsed.identifier : null,
    installed_at: typeof parsed.installed_at === "string" ? parsed.installed_at : null,
    readme: typeof parsed.readme === "string" ? parsed.readme : null,
  };
}

/**
 * "Suggested for you" seeds (V8): the wave's own playbooks, preinstalled on
 * every box from infra/template/skills/. Static metadata — no box call.
 */
export const SUGGESTED_SKILLS = [
  {
    name: "vault-use",
    description:
      "Sign in to websites with your vault — credentials typed straight into the browser, never through chat.",
  },
  {
    name: "social-engage",
    description:
      "Engage on socials under your standing rules — likes and reactions capped per day, posts always approved by you.",
  },
  {
    name: "shopping-checkout",
    description:
      "Check out carts with fill tickets — card details go browser-only, every purchase reviewed by you first.",
  },
  {
    name: "calendar-native",
    description:
      "Work your calendar natively — scheduling, invites, and reminders through your connected accounts.",
  },
] as const;

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
