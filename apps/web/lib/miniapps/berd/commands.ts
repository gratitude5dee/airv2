/**
 * Berd command allowlist (berd.goal.md §MA-B3, §3.2). The mini-app never
 * builds a shell string: an action becomes an allowlisted (group, action)
 * pair with validated, bounded args, and the paired Berd routes it through
 * its own berdctl broker and renderer command registry — the same gauntlet
 * every other Berd command runs. Anything not named here does not exist on
 * this surface; destructive verbs (delete agent, remove provider) are
 * refused by construction and stay in Berd's own UI.
 */

export interface ValidatedCommand {
  group: string;
  action: string;
  args: Record<string, unknown>;
}

export type CommandParse =
  | { ok: true; command: ValidatedCommand }
  | { ok: false; error: string };

function fail(error: string): CommandParse {
  return { ok: false, error };
}

function text(
  form: FormData,
  key: string,
  max: number,
  required: boolean
): string | null | undefined {
  const raw = form.get(key);
  if (typeof raw !== "string" || !raw.trim()) {
    return required ? undefined : null;
  }
  return raw.trim().slice(0, max);
}

/**
 * Every action the mini-app can queue, keyed by its form `action` value.
 * `refresh` is the read fan-out; the rest are the §MA-B5 write set: create
 * and edit only — visible, reversible, and always owner-initiated.
 */
export function parseBerdCommand(
  action: string,
  form: FormData
): CommandParse {
  switch (action) {
    case "refresh":
      return { ok: true, command: { group: "info", action: "refresh", args: {} } };
    case "agent-create": {
      const name = text(form, "name", 200, true);
      if (name === undefined) return fail("the agent needs a name.");
      return {
        ok: true,
        command: {
          group: "agents",
          action: "create",
          args: {
            name,
            description: text(form, "description", 2000, false),
            harness: text(form, "harness", 80, false),
            model: text(form, "model", 120, false),
          },
        },
      };
    }
    case "agent-update": {
      const id = text(form, "id", 128, true);
      if (id === undefined) return fail("which agent?");
      return {
        ok: true,
        command: {
          group: "agents",
          action: "update",
          args: {
            id,
            name: text(form, "name", 200, false),
            description: text(form, "description", 2000, false),
            model: text(form, "model", 120, false),
          },
        },
      };
    }
    case "project-create": {
      const name = text(form, "name", 200, true);
      if (name === undefined) return fail("the project needs a name.");
      return {
        ok: true,
        command: { group: "projects", action: "create", args: { name } },
      };
    }
    case "project-archive":
    case "project-unarchive": {
      const id = text(form, "id", 128, true);
      if (id === undefined) return fail("which project?");
      return {
        ok: true,
        command: {
          group: "projects",
          action: action === "project-archive" ? "archive" : "unarchive",
          args: { id },
        },
      };
    }
    case "skill-create": {
      const name = text(form, "name", 200, true);
      if (name === undefined) return fail("the skill needs a name.");
      return {
        ok: true,
        command: {
          group: "skills",
          action: "create",
          args: {
            name,
            summary: text(form, "summary", 400, false),
            body: text(form, "body", 8000, false),
          },
        },
      };
    }
    case "session-start": {
      return {
        ok: true,
        command: {
          group: "sessions",
          action: "start",
          args: {
            projectId: text(form, "projectId", 128, false),
            title: text(form, "title", 200, false),
          },
        },
      };
    }
    case "automation-enable":
    case "automation-disable": {
      const id = text(form, "id", 128, true);
      if (id === undefined) return fail("which automation?");
      return {
        ok: true,
        command: {
          group: "automations",
          action: "toggle",
          args: { id, enabled: action === "automation-enable" },
        },
      };
    }
    default:
      return fail("unknown action");
  }
}
