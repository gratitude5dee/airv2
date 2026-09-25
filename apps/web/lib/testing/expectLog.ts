import { format } from "node:util";
import { expect } from "vitest";

export type LogLevel = "error" | "warn";

export interface CapturedLog {
  level: LogLevel;
  text: string;
  claimed: boolean;
}

let buffer: CapturedLog[] = [];
const original = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
};

const capture =
  (level: LogLevel) =>
  (...args: unknown[]) => {
    buffer.push({ level, text: format(...args), claimed: false });
  };

/** Route console.error/console.warn into the per-test buffer. The real
 * console is intentionally silenced — a green run's stderr stays quiet. */
export function installConsoleCapture(): void {
  console.error = capture("error");
  console.warn = capture("warn");
}

/** For spies that must reach the real console (rare). */
export function restoreConsole(): void {
  console.error = original.error;
  console.warn = original.warn;
}

export function resetCapturedLogs(): void {
  buffer = [];
}

export function capturedLogs(): readonly CapturedLog[] {
  return buffer;
}

/** Assert an expected log line was emitted, and mark it so the suite's
 * afterEach doesn't flag it. Matches substring or RegExp against each
 * captured line; pass `{ level }` to pin error vs warn. `{ optional: true }`
 * claims the line if present but does not require it — for parameterized
 * tests whose emitted lines vary by row. */
export function expectLog(
  pattern: RegExp | string,
  opts?: { level?: LogLevel; optional?: boolean },
): string | null {
  const matches = (text: string) =>
    pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern);
  const hit = buffer.find(
    (entry) =>
      !entry.claimed &&
      (opts?.level === undefined || entry.level === opts.level) &&
      matches(entry.text),
  );
  if (!hit && opts?.optional) return null;
  expect(
    hit,
    `expected a ${opts?.level ?? "error/warn"} log matching ${String(
      pattern,
    )}\ncaptured logs: ${JSON.stringify(
      buffer.map(({ level, text }) => ({ level, text })),
      null,
      2,
    )}`,
  ).toBeTruthy();
  hit!.claimed = true;
  return hit!.text;
}

/** afterEach hook body: every captured line must have been expectLog'd. */
export function assertNoUnexpectedLogs(): void {
  const unexpected = buffer.filter((entry) => !entry.claimed);
  expect(
    unexpected,
    `unexpected console output during test:\n${unexpected
      .map((entry) => `[${entry.level}] ${entry.text}`)
      .join("\n")}`,
  ).toEqual([]);
}
