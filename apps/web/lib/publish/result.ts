/**
 * Composio tool results arrive as loosely-shaped JSON. These helpers walk
 * that JSON without assuming a schema: every access is narrowed, and a
 * missing id is a hard error (CC7 — never mark a slot done without the
 * platform's id in hand).
 */
import { PublishError } from "./adapter";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Walk a dotted path through nested objects; return a string leaf or null. */
export function pickString(value: unknown, path: string[]): string | null {
  let cursor: unknown = value;
  for (const key of path) {
    const record = asRecord(cursor);
    if (!record) return null;
    cursor = record[key];
  }
  if (typeof cursor === "string" && cursor.length > 0) return cursor;
  if (typeof cursor === "number") return String(cursor);
  return null;
}

/** Find the first present string among candidate paths. */
export function firstString(
  value: unknown,
  paths: string[][]
): string | null {
  for (const path of paths) {
    const found = pickString(value, path);
    if (found) return found;
  }
  return null;
}

/** Composio wraps tool output as { successful, data, error }. Unwrap it and
 * convert failures into a PublishError the adapter can classify. */
export function unwrapToolResult(result: unknown): unknown {
  const record = asRecord(result);
  if (!record) {
    throw new PublishError(502, "malformed tool result");
  }
  if (record.successful === false || record.successfull === false) {
    const message =
      typeof record.error === "string"
        ? record.error
        : JSON.stringify(record.error ?? "tool execution failed");
    throw new PublishError(inferStatus(message), message);
  }
  return record.data ?? record;
}

/** Composio flattens the platform's HTTP status into the error text; fish it
 * back out so classify() can route auth failures and throttles correctly. */
function inferStatus(message: string): number {
  const lowered = message.toLowerCase();
  if (
    lowered.includes("unauthorized") ||
    lowered.includes("invalid token") ||
    lowered.includes("expired") ||
    lowered.includes("re-auth") ||
    lowered.includes("oauth") ||
    lowered.includes("401") ||
    lowered.includes("403")
  ) {
    return 401;
  }
  if (lowered.includes("rate limit") || lowered.includes("429")) {
    return 429;
  }
  if (
    lowered.includes("500") ||
    lowered.includes("502") ||
    lowered.includes("503") ||
    lowered.includes("timeout") ||
    lowered.includes("temporarily")
  ) {
    return 503;
  }
  return 400;
}
