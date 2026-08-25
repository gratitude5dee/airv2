/**
 * Boundary narrowing for loosely-shaped JSON (DB json columns, third-party
 * tool results). Validates at runtime instead of asserting, so no
 * `as Record<string, unknown>` casts are needed at call sites.
 */
import { z } from "zod";

const RecordSchema = z.record(z.unknown());

/** Narrow unknown JSON to a plain object, or null when it is not one. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  const parsed = RecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
