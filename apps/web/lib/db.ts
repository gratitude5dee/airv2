/**
 * R-ARCH-05 — `db.write`, the checked-write wrapper. Supabase query
 * builders never throw: an unchecked `await supabase.from(...).insert(...)`
 * silently drops `{ error }` and the write vanishes. Wrapping the builder
 * in `db.write` flips that: the PostgrestError is logged with the caller's
 * ids and rethrown as a typed `DbWriteError` so the caller's retry / carry
 * / sweep path sees the failure.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import { log } from "./log";

export class DbWriteError extends Error {
  constructor(
    readonly what: string,
    readonly pg: Pick<PostgrestError, "message" | "code" | "details" | "hint">
  ) {
    super(`${what}: ${pg.message}`);
    this.name = "DbWriteError";
  }
}

interface WriteContext {
  what: string;
  user_id?: string | null;
  box_id?: string | null;
}

interface SupabaseResult<T> {
  data: T;
  error: PostgrestError | null;
}

export const db = {
  /**
   * `await db.write(supabase.from("t").insert(row), { what: "carried insert" })`
   * resolves the row payload or throws DbWriteError. Anything the caller
   * already destructures (`const { error } = await …`) stays as-is.
   */
  async write<T>(
    query: PromiseLike<SupabaseResult<T>>,
    ctx: WriteContext
  ): Promise<T> {
    const { data, error } = await query;
    if (error) {
      log.error("supabase write failed", {
        user_id: ctx.user_id ?? null,
        box_id: ctx.box_id ?? null,
        what: ctx.what,
        pg_code: error.code,
        error: error.message,
        hint: error.hint,
      });
      throw new DbWriteError(ctx.what, error);
    }
    return data;
  },
};
