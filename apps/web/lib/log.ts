/**
 * The control-plane logger (R-ARCH-04). One JSON line per call, the same
 * shape the hand-rolled console.* sites emitted. README.md:57 requires
 * `user_id` and `box_id` on every line that touches a box; the grep test in
 * log.test.ts enforces `box_id` inside the box-touching modules
 * (lib/box, lib/hermes, lib/orchestrator, lib/provisioning, lib/migration,
 * app/api/box). Where the box is genuinely unknown — pre-wake, or the
 * user has none yet — the key stays present with `box_id: null`.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  user_id?: string | null;
  box_id?: string | null;
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  // Same JSON shape the hand-rolled console.* sites emitted — the level is
  // carried by the console method, not a key, so converted lines stay
  // byte-identical for readers and console-spy tests.
  const line = JSON.stringify({ msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: LogFields): void => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields): void => emit("error", msg, fields),
};
