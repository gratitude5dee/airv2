/**
 * Incremental SSE terminal-event detection for re-emitted Hermes streams.
 * Chunks are buffered and split on the \n\n frame boundary (the same framing
 * hermesDeltas uses), so a terminal event split across network chunks is
 * still detected, and a delta that merely quotes "run.completed" in its text
 * never reads as terminal.
 */

export type TerminalOutcome = "completed" | "failed";

function frameOutcome(frame: string): TerminalOutcome | null {
  const line = frame.split("\n").find((entry) => entry.startsWith("data: "));
  if (!line) return null;
  let event: { event?: string };
  try {
    event = JSON.parse(line.slice(6)) as { event?: string };
  } catch {
    return null;
  }
  if (event.event === "run.completed") return "completed";
  if (event.event === "run.failed") return "failed";
  return null;
}

export interface TerminalScanner {
  /** Feed decoded text; returns the outcome the first time it is seen. */
  push(text: string): TerminalOutcome | null;
  /** Scan any trailing partial frame at end of stream. */
  flush(): TerminalOutcome | null;
}

export function createTerminalScanner(): TerminalScanner {
  let buffer = "";
  let seen: TerminalOutcome | null = null;
  return {
    push(text: string): TerminalOutcome | null {
      if (seen) return null;
      buffer += text;
      let index: number;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const outcome = frameOutcome(frame);
        if (outcome) {
          seen = outcome;
          buffer = "";
          return outcome;
        }
      }
      return null;
    },
    flush(): TerminalOutcome | null {
      if (seen || !buffer) return null;
      const outcome = frameOutcome(buffer);
      buffer = "";
      if (outcome) seen = outcome;
      return outcome;
    },
  };
}
