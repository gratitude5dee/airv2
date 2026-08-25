/**
 * Composio tool results arrive as loosely-shaped JSON. These helpers walk
 * that JSON without assuming a schema: every access is narrowed, and a
 * missing id is a hard error (CC7 — never mark a slot done without the
 * platform's id in hand).
 */
import { PublishError } from "./adapter";
import { asRecord } from "../records";

export { asRecord };

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
const STATUS_CODE = /\b(?:http\s+|status(?:_code)?["':\s=]+)(401|403|429|500|502|503)\b/;
const AUTH_TEXT =
  /unauthorized|invalid[ _](?:access[ _])?token|token (?:has )?(?:been )?(?:expired|revoked)|session (?:has )?expired|invalid_grant|oauthexception|re-?authenticat/;
const THROTTLE_TEXT = /rate limit|too many requests/;
const TRANSIENT_TEXT = /timeout|timed out|temporarily|internal server error|service unavailable|bad gateway/;

function inferStatus(message: string): number {
  const lowered = message.toLowerCase();
  const anchored = STATUS_CODE.exec(lowered);
  if (anchored?.[1]) {
    const status = Number(anchored[1]);
    return status === 401 || status === 403 ? 401 : status;
  }
  if (AUTH_TEXT.test(lowered)) return 401;
  if (THROTTLE_TEXT.test(lowered)) return 429;
  if (TRANSIENT_TEXT.test(lowered)) return 503;
  return 400;
}
