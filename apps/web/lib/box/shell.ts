/**
 * POSIX single-quoting for values interpolated into Box shell commands.
 * Inside single quotes nothing expands — unlike JSON/double quotes, where
 * `$VAR`, backticks and `$(…)` still substitute. Embedded single quotes
 * become `'\''` (close, escaped quote, reopen), so any string is safe.
 * Callers should still validate inputs first; this is defense in depth.
 */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
