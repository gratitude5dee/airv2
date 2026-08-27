/**
 * Session history replay for /v1/runs. Hermes' runs endpoint treats
 * `session_id` as a persistence/correlation scope only — it does NOT load
 * the stored transcript into the model context (unlike
 * /api/sessions/{id}/chat, which does). Without replay, every turn starts
 * blank and the agent re-asks for details the human already gave. We load
 * the persisted messages ourselves and pass them as `conversation_history`,
 * mirroring what the session-chat endpoint does server-side.
 */
import { z } from "zod";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Cap the replayed window: bounds token cost and keeps the request body
 * small. Recent-turn continuity (the failure the screenshots show) needs
 * tens of messages, not the whole transcript — deep recall is OpenViking's
 * job, not the replay window's.
 */
export const HISTORY_MESSAGE_LIMIT = 60;

/** Permissive row shape: transcripts carry tool/system rows and non-string
 * content; those are filtered here rather than failing the whole load. */
const RawMessageSchema = z.object({
  role: z.string().optional(),
  content: z.unknown().optional(),
});

const RawMessagesSchema = z.union([
  z.array(RawMessageSchema),
  z.object({
    data: z.array(RawMessageSchema).optional(),
    messages: z.array(RawMessageSchema).optional(),
  }),
]);

export function parseRawMessages(json: unknown): Array<z.infer<typeof RawMessageSchema>> {
  const parsed = RawMessagesSchema.safeParse(json);
  if (!parsed.success) return [];
  if (Array.isArray(parsed.data)) return parsed.data;
  return parsed.data.data ?? parsed.data.messages ?? [];
}

/**
 * Reduce a raw transcript to a strictly-alternating user/assistant history
 * the runs endpoint accepts: keep only user/assistant rows with non-empty
 * string content, merge consecutive same-role rows (strict role alternation
 * is a Hermes invariant), drop a leading assistant run, and keep only the
 * newest HISTORY_MESSAGE_LIMIT messages ending on an assistant reply.
 */
export function sanitizeConversation(
  raw: Array<{ role?: string | undefined; content?: unknown }>
): ConversationMessage[] {
  const merged: ConversationMessage[] = [];
  for (const row of raw) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    if (typeof row.content !== "string") continue;
    const content = row.content.trim();
    if (!content) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === row.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      merged.push({ role: row.role, content });
    }
  }
  while (merged.length > 0 && merged[0]?.role === "assistant") {
    merged.shift();
  }
  let window = merged.slice(-HISTORY_MESSAGE_LIMIT);
  // Keep alternation intact after the cut: the window must open on a user
  // message and close on an assistant reply (the new turn's user message
  // follows it).
  while (window.length > 0 && window[0]?.role === "assistant") {
    window = window.slice(1);
  }
  while (window.length > 0 && window[window.length - 1]?.role === "user") {
    window = window.slice(0, -1);
  }
  return window;
}
