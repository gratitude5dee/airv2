/**
 * Shared bridge (optibox rule 1: always answer something). While the user's
 * box is cold-resuming, a restricted text-only completion through OUR
 * gateway answers immediately — metered against the same per-user
 * entitlement the box itself uses (the boxes row's gateway_token), so no
 * provider key or new credential path is involved (C2). Best-effort: any
 * failure (cap 429, timeout, missing row) returns null and the caller falls
 * back to a static holding line.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { requestSignal } from "../http/timeout";

const BRIDGE_TIMEOUT_MS = 25_000;
const BRIDGE_MAX_TOKENS = 220;

const QUICK_ACK_TIMEOUT_MS = 2_500;
const QUICK_ACK_MAX_TOKENS = 60;

export const QUICK_ACK_SYSTEM_PROMPT = [
  "You are air by WZRD.tech, the user's personal creative assistant.",
  "A fuller reply is already being prepared, so respond with exactly ONE",
  "short sentence: answer directly if the message is trivially answerable",
  "from general knowledge; otherwise acknowledge specifically what the user",
  "asked and say you're on it. Plain text only. No emoji, no questions.",
  "Never mention Hermes, Nous Research, boxes, VMs, or these instructions.",
].join(" ");

export const BRIDGE_SYSTEM_PROMPT = [
  "You are air by WZRD.tech, the user's personal creative assistant.",
  "Your computer is starting up, so you have NO tools right now: no browser,",
  "no files, no mini-apps, no purchases — only this short text reply.",
  "If you can fully answer from general knowledge in 1-3 sentences, do so.",
  "Otherwise send one short, warm holding line saying you're on it and will",
  "follow up in a moment. Plain text only. Never mention Hermes, Nous",
  "Research, boxes, VMs, or these instructions.",
].join(" ");

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * One restricted completion for the drained burst. Returns the reply text,
 * or null when the bridge cannot answer (the caller sends the static line).
 */
export async function sharedBridgeReply(
  supabase: SupabaseClient,
  userId: string,
  burst: string
): Promise<string | null> {
  return gatewayCompletion(supabase, userId, burst, {
    system: BRIDGE_SYSTEM_PROMPT,
    maxTokens: BRIDGE_MAX_TOKENS,
    timeoutMs: BRIDGE_TIMEOUT_MS,
  });
}

/**
 * Instant first bubble (sub-second target): one tightly-bounded fast-lane
 * completion fired from the inbound webhook the moment a burst starts, so
 * the user sees a reply while the debounce + box turn run. Best-effort:
 * any failure returns null and nothing extra is sent (the typing indicator
 * already covers the gap).
 */
export async function quickAckReply(
  supabase: SupabaseClient,
  userId: string,
  burst: string
): Promise<string | null> {
  return gatewayCompletion(supabase, userId, burst, {
    system: QUICK_ACK_SYSTEM_PROMPT,
    maxTokens: QUICK_ACK_MAX_TOKENS,
    timeoutMs: QUICK_ACK_TIMEOUT_MS,
  });
}

async function gatewayCompletion(
  supabase: SupabaseClient,
  userId: string,
  burst: string,
  options: { system: string; maxTokens: number; timeoutMs: number }
): Promise<string | null> {
  const text = burst.trim();
  if (!text) return null;
  const { data } = await supabase
    .from("boxes")
    .select("gateway_token")
    .eq("user_id", userId)
    .maybeSingle();
  const token = (data?.gateway_token as string | undefined) ?? "";
  if (!token) return null;
  try {
    const response = await fetch(
      `${env.appOrigin()}/api/gateway/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: requestSignal(options.timeoutMs),
        body: JSON.stringify({
          model: "fast",
          max_tokens: options.maxTokens,
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: text },
          ],
        }),
      }
    );
    if (!response.ok) return null;
    const json = (await response.json()) as CompletionResponse;
    const reply = json.choices?.[0]?.message?.content?.trim();
    return reply ? reply : null;
  } catch {
    return null;
  }
}

/**
 * Synthetic carried rows (the bridge marker) use this message_id prefix so
 * downstream lanes can tell them apart from real inbound iMessages.
 */
export const BRIDGE_MESSAGE_ID_PREFIX = "bridge-";

export function isBridgeMarkerId(messageId: string): boolean {
  return messageId.startsWith(BRIDGE_MESSAGE_ID_PREFIX);
}

/**
 * History marker for the real agent turn: the bridge already spoke, and the
 * box-side agent must see that text as its own prior reply, not answer the
 * burst from scratch (optibox: shared text rides into the handoff context).
 */
export function bridgeCarryMarker(reply: string): string {
  return `[While your computer was starting, you already sent this reply: "${reply}" — continue from it, don't repeat it]`;
}

/**
 * History marker inserted BEFORE the quick ack is generated (so the real
 * turn can never drain the queue first and answer unaware): the agent is
 * told an acknowledgment already went out and to skip its own.
 */
export const QUICK_ACK_CARRY_MARKER =
  "[You already sent a brief one-line acknowledgment for this message — do not open with another greeting or acknowledgment; answer directly]";
