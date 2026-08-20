import { describe, expect, it } from "vitest";
import { createTerminalScanner } from "./terminal";

const COMPLETED = 'data: {"event":"run.completed","output":"done"}\n\n';
const FAILED = 'data: {"event":"run.failed","error":"boom"}\n\n';

describe("createTerminalScanner", () => {
  it("detects a terminal event delivered in one chunk", () => {
    const scanner = createTerminalScanner();
    expect(scanner.push(COMPLETED)).toBe("completed");
  });

  it("detects a terminal event split across chunks", () => {
    const scanner = createTerminalScanner();
    expect(scanner.push('data: {"event":"run.comp')).toBeNull();
    expect(scanner.push('leted","output":"ok"}\n\n')).toBe("completed");
  });

  it("detects run.failed split mid-event-name", () => {
    const scanner = createTerminalScanner();
    expect(scanner.push(FAILED.slice(0, 20))).toBeNull();
    expect(scanner.push(FAILED.slice(20))).toBe("failed");
  });

  it("ignores deltas whose text merely quotes the terminal event name", () => {
    const scanner = createTerminalScanner();
    const delta =
      'data: {"event":"message.delta","delta":"the \\"run.completed\\" event"}\n\n';
    expect(scanner.push(delta)).toBeNull();
    expect(scanner.flush()).toBeNull();
  });

  it("catches an undelimited terminal frame at end of stream via flush", () => {
    const scanner = createTerminalScanner();
    expect(
      scanner.push('data: {"event":"run.completed","output":"tail"}')
    ).toBeNull();
    expect(scanner.flush()).toBe("completed");
  });

  it("reports the outcome only once", () => {
    const scanner = createTerminalScanner();
    expect(scanner.push(COMPLETED)).toBe("completed");
    expect(scanner.push(COMPLETED)).toBeNull();
    expect(scanner.flush()).toBeNull();
  });

  it("skips frames that are not valid JSON", () => {
    const scanner = createTerminalScanner();
    expect(scanner.push("data: not-json\n\n")).toBeNull();
    expect(scanner.push(FAILED)).toBe("failed");
  });
});
