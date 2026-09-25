import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabase } from "../testing/fakeSupabase";

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

function fakeSupabase(toolkits: string[]): SupabaseClient {
  const db = new FakeSupabase();
  db.tables["connections"] = toolkits.map((toolkit) => ({
    user_id: "user-1",
    toolkit,
    status: "active",
  }));
  return db.client();
}

const target = { instanceId: "box-1", environment: "ubuntu" as const };

beforeEach(() => {
  runCommand.mockReset();
  runCommand.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
});

describe("writeConnectedToolsFile", () => {
  it("writes active toolkits to the command", async () => {
    await writeConnectedToolsFile(
      fakeSupabase(["notion", "gmail"]),
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
