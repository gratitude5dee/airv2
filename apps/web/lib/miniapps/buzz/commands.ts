/**
 * Buzz intent allowlist (buzz.goal.md §MA-Z3, §3, §4.3). The rule the shapes
 * enforce: **content never rides in a flag.** Every content-bearing value —
 * a message body, a canvas, a system prompt, a topic — lands in the single
 * `stdin` arg, which the signer passes to `buzz` as `--content -` / stdin,
 * never argv (argv is world-readable in a process list, and stdin also keeps
 * hostile content out of shell quoting, C9). Flag args here are ids, names,
 * and enums only, bounded and validated. Refused by construction:
 * `messages delete`, `mem rm`, anything bulk or destructive, and any path
 * that saves an agent — drafts are owner-reviewed in Buzz itself.
 */

export interface ValidatedIntent {
  group: string;
  verb: string;
  args: Record<string, unknown>;
}

export type IntentParse =
  | { ok: true; intent: ValidatedIntent; confirmLabel?: string | undefined }
  | { ok: false; error: string };

function fail(error: string): IntentParse {
  return { ok: false, error };
}

function flag(
  form: FormData,
  key: string,
  max: number,
  required: boolean
): string | null | undefined {
  const raw = form.get(key);
  if (typeof raw !== "string" || !raw.trim()) {
    return required ? undefined : null;
  }
  const value = raw.trim();
  // A flag value is an id/name/enum. Newlines mean someone is trying to
  // smuggle content into argv; that only ever belongs on stdin.
  if (/[\r\n]/.test(value)) return required ? undefined : null;
  return value.slice(0, max);
}

function stdin(form: FormData, key: string, max: number): string | undefined {
  const raw = form.get(key);
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.slice(0, max);
}

const HEX_ID = /^[0-9a-f]{8,64}$/i;
const EMOJI_MAX = 16;

export function parseBuzzIntent(action: string, form: FormData): IntentParse {
  switch (action) {
    case "refresh":
      return { ok: true, intent: { group: "info", verb: "refresh", args: {} } };
    case "channel-create": {
      const name = flag(form, "name", 120, true);
      if (name === undefined) return fail("the channel needs a name.");
      const kind = flag(form, "kind", 10, false);
      if (kind && kind !== "stream" && kind !== "forum") {
        return fail("channel kind must be stream or forum.");
      }
      return {
        ok: true,
        intent: {
          group: "channels",
          verb: "create",
          args: { name, kind: kind ?? null },
        },
      };
    }
    case "channel-join": {
      const id = flag(form, "channelId", 128, true);
      if (id === undefined) return fail("which channel?");
      return {
        ok: true,
        intent: { group: "channels", verb: "join", args: { channelId: id } },
      };
    }
    case "channel-topic": {
      const id = flag(form, "channelId", 128, true);
      const topic = stdin(form, "stdin", 400);
      if (id === undefined || topic === undefined) {
        return fail("channel and topic are both needed.");
      }
      return {
        ok: true,
        intent: {
          group: "channels",
          verb: "topic",
          args: { channelId: id, stdin: topic },
        },
      };
    }
    case "message-send": {
      const channelId = flag(form, "channelId", 128, true);
      const body = stdin(form, "stdin", 8000);
      if (channelId === undefined || body === undefined) {
        return fail("channel and message are both needed.");
      }
      const replyTo = flag(form, "replyTo", 128, false);
      return {
        ok: true,
        intent: {
          group: "messages",
          verb: "send",
          args: { channelId, replyTo, stdin: body },
        },
        confirmLabel: "a sent message is public and one-way",
      };
    }
    case "dm-open": {
      const pubkey = flag(form, "pubkey", 64, true);
      if (pubkey == null || !HEX_ID.test(pubkey)) {
        return fail("a dm needs the other side's hex pubkey.");
      }
      return {
        ok: true,
        intent: { group: "dms", verb: "open", args: { pubkey } },
      };
    }
    case "reaction-add": {
      const eventId = flag(form, "eventId", 64, true);
      const emoji = flag(form, "emoji", EMOJI_MAX, true);
      if (eventId === undefined || emoji === undefined) {
        return fail("event and emoji are both needed.");
      }
      return {
        ok: true,
        intent: { group: "reactions", verb: "add", args: { eventId, emoji } },
      };
    }
    case "canvas-set": {
      const channelId = flag(form, "channelId", 128, true);
      const body = stdin(form, "stdin", 16000);
      if (channelId === undefined || body === undefined) {
        return fail("channel and canvas content are both needed.");
      }
      return {
        ok: true,
        intent: {
          group: "canvas",
          verb: "set",
          args: { channelId, stdin: body },
        },
        confirmLabel: "the canvas is last-write-wins",
      };
    }
    case "workflow-trigger":
    case "workflow-approve": {
      const id = flag(form, "workflowId", 128, true);
      if (id === undefined) return fail("which workflow?");
      const verb = action === "workflow-approve" ? "approve" : "trigger";
      return {
        ok: true,
        intent: {
          group: "workflows",
          verb,
          args: {
            workflowId: id,
            approvalToken: flag(form, "approvalToken", 200, false),
          },
        },
        confirmLabel:
          verb === "approve" ? "an approval cannot be batched or undone" : undefined,
      };
    }
    case "agent-draft-create": {
      const channelId = flag(form, "channelId", 128, true);
      const displayName = flag(form, "displayName", 120, true);
      const systemPrompt = stdin(form, "stdin", 8000);
      if (
        channelId === undefined ||
        displayName === undefined ||
        systemPrompt === undefined
      ) {
        return fail("channel, display name, and system prompt are all needed.");
      }
      return {
        ok: true,
        intent: {
          group: "agents",
          verb: "draft-create",
          args: { channelId, displayName, stdin: systemPrompt },
        },
      };
    }
    case "agent-draft-update": {
      const channelId = flag(form, "channelId", 128, true);
      const agentName = flag(form, "agentName", 120, true);
      if (channelId === undefined || agentName === undefined) {
        return fail("channel and agent name are both needed.");
      }
      return {
        ok: true,
        intent: {
          group: "agents",
          verb: "draft-update",
          args: { channelId, agentName, stdin: stdin(form, "stdin", 8000) ?? null },
        },
      };
    }
    case "presence-set": {
      const presence = flag(form, "presence", 20, true);
      if (
        presence == null ||
        !["online", "away", "busy", "offline"].includes(presence)
      ) {
        return fail("presence must be online, away, busy, or offline.");
      }
      return {
        ok: true,
        intent: { group: "users", verb: "set-presence", args: { presence } },
      };
    }
    default:
      return fail("unknown action");
  }
}
