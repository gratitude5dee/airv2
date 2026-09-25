/**
 * Request-shape rules for the OpenAI-compatible inference gateway: which
 * bearer is a Functions runtime token, how a gmi turn is classified for the
 * fast lane, the fleet-wide provider override, and the timeout classifier
 * the retry paths share. Pure functions — unit-testable without NextRequest.
 */
import { isModelFamily, type ModelFamily } from "../entitlements/models";

type Json = Record<string, unknown>;

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error || error instanceof DOMException)) return false;
  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /timed?\s*out|timeout/i.test(error.message)
  );
}

// Task-type routing for the gmi family (goal-gmi-models Phase 2): a turn
// that opens with a short user message carrying no depth cue and no
// money/publish cue is routine work — draft an email, check the calendar,
// quick lookup — and rides the fast lane (GLM-5.3-Flash) instead of the
// entitled tier. The rule only ever downgrades, so spend stays
// entitlement-bounded; it mirrors the deterministic half of the box's
// shadow taskrouter (infra/template/taskrouter) until hermes can consult it
// per-turn upstream. Mid-turn continuations (the last message is a tool
// result, not the opener) keep the request's resolution, and a caller's
// explicit `model:"fast"` is unaffected either way. GMI_ROUTINE_FAST=off
// disables the rule.
export const GMI_ROUTINE_MAX_CHARS = 280;
// Depth cues keep the entitled tier — these are the turns Astra is for.
export const GMI_DEEP_TURN_RE =
  /\b(research|analy[sz]e|compare|plan(?:ning)?|strategy|debug|investigate|essay|whitepaper|refactor|architect)\b/i;
// Money movement and public publishing never ride the routine lane — the
// approval queue is the real control, but those turns keep the entitled
// model regardless.
export const GMI_RISK_TURN_RE =
  /(\$\s?\d|\b(wire|venmo|zelle|paypal|checkout|charge|deposit|renew|reorder|refund|invoice|payment|purchase|transfer|delete|publish|tweet)\b)/i;

/** Text of the request's opening user message, or null for any other shape. */
export function openingUserTurnText(body: Json): string | null {
  const messages = body["messages"];
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const last = messages[messages.length - 1];
  if (!last || typeof last !== "object") return null;
  const msg = last as { role?: unknown; content?: unknown };
  if (msg.role !== "user") return null;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    const text = (msg.content as { type?: unknown; text?: unknown }[])
      .map((part) =>
        part && part.type === "text" && typeof part.text === "string"
          ? part.text
          : ""
      )
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

/** True when a gmi request's opening user turn reads as routine work. */
export function gmiRoutineTurn(body: Json): boolean {
  if (process.env["GMI_ROUTINE_FAST"] === "off") return false;
  const text = openingUserTurnText(body)?.trim();
  if (!text || text.length > GMI_ROUTINE_MAX_CHARS) return false;
  return !GMI_DEEP_TURN_RE.test(text) && !GMI_RISK_TURN_RE.test(text);
}

/**
 * Once a non-sensitive turn has a tool result, Astra has already made the
 * expensive planning decision. Let GLM interpret the result and choose the
 * next step so multi-tool iMessage turns do not pay Astra latency on every
 * loop. Money movement, checkout, deletion, and publishing remain on the
 * entitled model for the whole conversation.
 */
export function gmiFastToolContinuation(body: Json): boolean {
  const messages = body["messages"];
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (!last || typeof last !== "object" || (last as { role?: unknown }).role !== "tool") {
    return false;
  }
  return !messages.some((message) => {
    if (!message || typeof message !== "object") return false;
    const row = message as { role?: unknown; content?: unknown };
    return (
      row.role === "user" &&
      typeof row.content === "string" &&
      GMI_RISK_TURN_RE.test(row.content)
    );
  });
}

/**
 * Temporary fleet-wide provider switch. Unlike changing every entitlement,
 * this preserves each user's saved preference and can be reversed without a
 * database migration. An override deliberately uses the platform provider
 * key so operations can move spend between platform credit pools.
 */
export function gatewayModelFamilyOverride(): ModelFamily | null {
  const value = process.env["GATEWAY_MODEL_FAMILY_OVERRIDE"] ?? "";
  return isModelFamily(value) ? value : null;
}

/** Runtime tokens are prefixed so the two principals never share a lookup. */
export function isRuntimeBearer(token: string): boolean {
  return token.startsWith("art_");
}
