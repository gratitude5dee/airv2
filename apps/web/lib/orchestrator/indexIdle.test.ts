import { beforeEach, describe, expect, it, vi } from "vitest";
import { command } from "@/lib/box/client";
import {
  claimIdleStop,
  commandMissing,
  LEGACY_STOP_GRACE_MS,
  releaseIdleStop,
} from "./indexIdle";

vi.mock("@/lib/box/client", () => ({ command: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const TOKEN = "0123456789abcdef0123456789abcdef";
const ok = (state: unknown) => ({ exitCode: 0, stdout: JSON.stringify(state), stderr: "" });
const missing = (name: string) => ({
  exitCode: 2,
  stdout: "",
  stderr: `usage: ovctl\novctl: error: argument cmd: invalid choice: '${name}' (choose from 'ensure', 'status')`,
});

/** Route each ovctl subcommand to a scripted result; unknown → absent. */
function box(results: Record<string, { exitCode: number; stdout: string; stderr: string } | Error>) {
  vi.mocked(command).mockImplementation(async (_box, cmd) => {
    const name = cmd.split(" ")[1] ?? "";
    const result = results[name] ?? missing(name);
    if (result instanceof Error) throw result;
    return result;
  });
}

describe("claimIdleStop on a box with the claim command", () => {
  it("stops only under an exclusive claim and hands back the token", async () => {
    box({ "stop-claim": ok({ claimed: true, token: TOKEN, pending: 0 }) });
    expect(await claimIdleStop("box", 0)).toEqual({ kind: "claimed", token: TOKEN });
    expect(command).toHaveBeenCalledWith("box", "ovctl stop-claim --grace-seconds 1200", 15);
    expect(command).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ claimed: false, reason: "pending", pending: 2 }, "pending"],
    [{ claimed: false, reason: "grace", idle_remaining_seconds: 400 }, "grace"],
    [{ claimed: false, reason: "busy" }, "busy"],
    [{ claimed: false, reason: "claimed" }, "claimed"],
  ])("defers with the worker's reason: %j", async (state, reason) => {
    box({ "stop-claim": ok(state) });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({ kind: "deferred", reason });
  });

  it.each([
    [ok({})],
    [ok(null)],
    [ok({ claimed: "true", token: TOKEN })],
    [ok({ claimed: true, token: "" })],
    [ok({ claimed: true, token: "$(rm -rf /)" })],
    [ok({ claimed: true })],
    [ok({ claimed: false, reason: "surprise" })],
    [{ exitCode: 0, stdout: "invalid", stderr: "" }],
    // Corrupt claim/queue state raises inside ovctl: exit 1 with a traceback.
    [{ exitCode: 1, stdout: "", stderr: "ValueError: invalid stop claim" }],
    [{ exitCode: 1, stdout: '{"claimed":true,"token":"' + TOKEN + '"}', stderr: "" }],
  ])("never stops on unclear or corrupt state: %j", async (result) => {
    box({ "stop-claim": result });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({
      kind: "deferred",
      reason: "probe_failed",
    });
  });

  it("defers when the box command itself fails", async () => {
    box({ "stop-claim": new Error("timeout") });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({
      kind: "deferred",
      reason: "probe_failed",
    });
  });
});

describe("claimIdleStop on old boxes", () => {
  it("falls back to the read-only probe when only idle-check exists", async () => {
    box({ "idle-check": ok({ can_stop: true, pending: 0, idle_remaining_seconds: 0 }) });
    expect(await claimIdleStop("box", 0)).toEqual({ kind: "legacy_probe" });
    expect(vi.mocked(command).mock.calls.map((call) => call[1])).toEqual([
      "ovctl stop-claim --grace-seconds 1200",
      "ovctl idle-check --grace-seconds 1200",
    ]);
  });

  it.each([
    [{ can_stop: false, pending: 2, idle_remaining_seconds: 0 }, "pending"],
    [{ can_stop: false, pending: 0, idle_remaining_seconds: 400 }, "grace"],
    [{ can_stop: "true" }, "probe_failed"],
    [{}, "probe_failed"],
  ])("legacy probe defers for %j", async (state, reason) => {
    box({ "idle-check": ok(state) });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({ kind: "deferred", reason });
  });

  it("legacy probe defers on a failing or corrupt probe", async () => {
    box({ "idle-check": { exitCode: 1, stdout: "", stderr: "ValueError" } });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({ kind: "deferred", reason: "probe_failed" });
    box({ "idle-check": { exitCode: 0, stdout: "{broken", stderr: "" } });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({ kind: "deferred", reason: "probe_failed" });
    box({ "idle-check": new Error("timeout") });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS * 10)).toEqual({ kind: "deferred", reason: "probe_failed" });
  });

  it("bounds the deferral of a box with no idle command at all", async () => {
    box({});
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS - 1)).toEqual({ kind: "deferred", reason: "legacy_grace" });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS)).toEqual({ kind: "legacy_stop" });
  });

  it("treats a missing ovctl binary like a box with no idle command", async () => {
    const notFound = { exitCode: 127, stdout: "", stderr: "bash: ovctl: command not found" };
    box({ "stop-claim": notFound, "idle-check": notFound });
    expect(await claimIdleStop("box", 0)).toEqual({ kind: "deferred", reason: "legacy_grace" });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS)).toEqual({ kind: "legacy_stop" });
  });

  it("logs why a probe failed, with the box id and exit or error, never on a missing command", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    box({ "stop-claim": { exitCode: 1, stdout: "", stderr: "Traceback\nValueError: invalid pending index state" } });
    await claimIdleStop("box", 0);
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stderr.mock.calls[0]?.[0] as string)).toEqual({
      msg: "ovctl probe failed",
      box_id: "box",
      subcommand: "stop-claim",
      exit: 1,
      stderr: "Traceback\nValueError: invalid pending index state",
    });
    stderr.mockClear();
    box({ "stop-claim": new Error("command timed out after 15s") });
    await claimIdleStop("box", 0);
    expect(JSON.parse(stderr.mock.calls[0]?.[0] as string)).toMatchObject({ error: "command timed out after 15s" });
    stderr.mockClear();
    box({});
    await claimIdleStop("box", 0);
    expect(stderr).not.toHaveBeenCalled();
    stderr.mockRestore();
  });

  it("does not mistake other exit-2 failures for a missing command", async () => {
    box({ "stop-claim": { exitCode: 2, stdout: "", stderr: "ovctl: error: argument --grace-seconds: invalid int value" } });
    expect(await claimIdleStop("box", LEGACY_STOP_GRACE_MS)).toEqual({ kind: "deferred", reason: "probe_failed" });
    expect(command).toHaveBeenCalledTimes(1);
  });
});

it("commandMissing matches argparse's unknown-subcommand message only for that subcommand", () => {
  expect(commandMissing(missing("stop-claim"), "stop-claim")).toBe(true);
  expect(commandMissing(missing("stop-claim"), "idle-check")).toBe(false);
  expect(commandMissing({ exitCode: 127, stdout: "", stderr: "" }, "stop-claim")).toBe(true);
  expect(commandMissing({ exitCode: 1, stdout: "", stderr: "invalid choice: 'stop-claim'" }, "stop-claim")).toBe(false);
});

describe("releaseIdleStop", () => {
  it("releases with the claim token and reports the outcome", async () => {
    box({ "stop-release": ok({ released: true }) });
    expect(await releaseIdleStop("box", TOKEN)).toBe(true);
    expect(command).toHaveBeenCalledWith("box", `ovctl stop-release --token ${TOKEN}`, 15);
    box({ "stop-release": { exitCode: 1, stdout: '{"released":false}', stderr: "" } });
    expect(await releaseIdleStop("box", TOKEN)).toBe(false);
    box({ "stop-release": new Error("box stopped") });
    expect(await releaseIdleStop("box", TOKEN)).toBe(false);
  });
});
