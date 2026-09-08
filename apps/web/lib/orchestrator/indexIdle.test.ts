import { beforeEach, expect, it, vi } from "vitest";
import { command } from "@/lib/box/client";
import { indexingAllowsIdleStop } from "./indexIdle";

vi.mock("@/lib/box/client", () => ({ command: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it.each([
  [{ can_stop: true, pending: 0 }, true],
  [{ can_stop: false, pending: 2 }, false],
  [{ can_stop: false, idle_remaining_seconds: 400 }, false],
  [{}, false], [null, false], [{ can_stop: "true" }, false],
])("requires explicit stop permission from the queue: %j", async (state, expected) => {
  vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: JSON.stringify(state), stderr: "" });
  expect(await indexingAllowsIdleStop("box")).toBe(expected);
  expect(command).toHaveBeenCalledWith("box", "ovctl idle-check --grace-seconds 1200", 15);
});

it("defers when the box command fails", async () => {
  vi.mocked(command).mockRejectedValue(new Error("timeout"));
  expect(await indexingAllowsIdleStop("box")).toBe(false);
  vi.mocked(command).mockResolvedValue({ exitCode: 1, stdout: '{"can_stop":true}', stderr: "" });
  expect(await indexingAllowsIdleStop("box")).toBe(false);
  vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: "invalid", stderr: "" });
  expect(await indexingAllowsIdleStop("box")).toBe(false);
});
