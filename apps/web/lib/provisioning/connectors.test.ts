import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { runCommand } = vi.hoisted(() => ({
  runCommand: vi.fn(),
}));

vi.mock("../compute/runtime", async () => {
  const actual =
    await vi.importActual<typeof import("../compute/runtime")>(
      "../compute/runtime",
    );
  return {
    ...actual,
    hermesBin: vi.fn(() => "/home/user/.hermes-venv/bin/python"),
    runCommand,
  };
});

import { writeConnectedToolsFile } from "./connectors";

function fakeSupabase(rows: Array<{ toolkit: string }>): SupabaseClient {
  type Query = {
    select: () => Query;
    eq: () => Query;
    then: (
      resolve: (value: {
        data: Array<{ toolkit: string }>;
        error: null;
      }) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  };
  const query = {} as Query;
  query.select = () => query;
  query.eq = () => query;
  query.then = (resolve, reject) =>
    Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient;
}

const target = { instanceId: "box-1", environment: "ubuntu" as const };

beforeEach(() => {
  runCommand.mockReset();
  runCommand.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
});

describe("writeConnectedToolsFile", () => {
  it("writes active toolkits to the command", async () => {
    await writeConnectedToolsFile(
      fakeSupabase([{ toolkit: "notion" }, { toolkit: "gmail" }]),
      "user-1",
      target,
    );

    expect(runCommand).toHaveBeenCalledOnce();
    expect(runCommand.mock.calls[0]?.[1]).toContain(
      "Connected: gmail, notion.",
    );
  });

  it("writes the empty connected state when there are no active toolkits", async () => {
    await writeConnectedToolsFile(fakeSupabase([]), "user-1", target);

    expect(runCommand.mock.calls[0]?.[1]).toContain(
      "Connected: nothing yet.",
    );
  });

  it("throws when the box command fails", async () => {
    runCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr: "permission denied",
    });

    await expect(
      writeConnectedToolsFile(fakeSupabase([]), "user-1", target),
    ).rejects.toThrow("connected-tools write failed: permission denied");
  });
});
