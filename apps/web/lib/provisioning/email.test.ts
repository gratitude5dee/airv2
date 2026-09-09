import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mail, box } = vi.hoisted(() => ({
  mail: {
    ensurePod: vi.fn(async () => ({ pod_id: "pod_1", client_id: "user-1" })),
    createInbox: vi.fn(async () => ({ inbox_id: "sam@wzrd.tech" })),
    createDraftOnlyKeyForProvider: vi.fn(async () => "wm_live_draftonly"),
    ensureWebhook: vi.fn(async () => undefined),
  },
  box: {
    command: vi.fn<(boxId: string, cmd: string, timeout?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>>(
      async () => ({ exitCode: 0, stdout: "", stderr: "" })
    ),
    readFile: vi.fn(
      async () =>
        "OPENAI_API_KEY=gw\nAGENTMAIL_API_KEY=old\nAGENTMAIL_INBOX_ID=old@agentmail.to\n",
    ),
    writeFile: vi.fn<(boxId: string, path: string, body: string) => Promise<void>>(
      async () => undefined
    ),
  },
}));

vi.mock("../mail/client", async () => {
  const actual =
    await vi.importActual<typeof import("../mail/client")>("../mail/client");
  return {
    ...actual,
    ensurePod: mail.ensurePod,
    createInbox: mail.createInbox,
    createDraftOnlyKeyForProvider: mail.createDraftOnlyKeyForProvider,
    ensureWebhook: mail.ensureWebhook,
  };
});
vi.mock("../box/client", async () => {
  const actual =
    await vi.importActual<typeof import("../box/client")>("../box/client");
  return { ...actual, ...box };
});

import {
  boxMailWiring,
  installExistingMailbox,
  installMailboxOnBox,
  mailMcpInstallScript,
  provisionEmail,
} from "./email";
import { BoxApiError } from "../box/client";
import { MailApiError } from "../mail/errors";

const ORIGINAL = { ...process.env };

function fakeSupabase(
  boxId: string | null,
  existingInboxId: string | null = null,
) {
  return {
    from: vi.fn((table: string) => {
      // Every builder method returns the builder; awaiting it resolves to the
      // builder itself (no `then`), which the code under test ignores.
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        is: vi.fn(() => q),
        update: vi.fn(() => q),
        insert: vi.fn(async () => ({ error: null })),
        maybeSingle: vi.fn(async () => ({
          data:
            table === "boxes" && boxId
              ? { provider_box_id: boxId }
              : table === "agent_addresses" && existingInboxId
                ? {
                    address: "sam@wzrd.tech",
                    agentmail_inbox_id: existingInboxId,
                  }
                : null,
          error: null,
        })),
      };
      return q;
    }),
  } as never;
}

beforeEach(() => {
  process.env["APP_ORIGIN"] = "https://air.test";
  delete process.env["AGENT_EMAIL_DOMAIN"];
  delete process.env["WZRDMAIL_MCP_URL"];
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.clearAllMocks();
});

describe("boxMailWiring", () => {
  it("wzrdmail: WZRDMAIL_* env + hosted MCP at mcp.mail.wzrd.tech", () => {
    expect(boxMailWiring("wzrdmail")).toEqual({
      mcpName: "wzrdmail",
      mcpUrl: "https://mcp.mail.wzrd.tech/mcp",
      envPrefix: "WZRDMAIL_",
      apiKeyVar: "WZRDMAIL_API_KEY",
      inboxIdVar: "WZRDMAIL_INBOX_ID",
    });
  });

  it("agentmail: unchanged legacy wiring", () => {
    expect(boxMailWiring("agentmail")).toMatchObject({
      mcpName: "agentmail",
      mcpUrl: "https://mcp.agentmail.to/mcp",
      apiKeyVar: "AGENTMAIL_API_KEY",
      inboxIdVar: "AGENTMAIL_INBOX_ID",
    });
  });

  it("MCP install script uses the x-api-key template and disables the other provider", () => {
    const script = mailMcpInstallScript(boxMailWiring("wzrdmail"));
    expect(script).toContain(
      's["wzrdmail"] = {"url": "https://mcp.mail.wzrd.tech/mcp", "headers": {"x-api-key": "${WZRDMAIL_API_KEY}"}, "enabled": True}',
    );
    expect(script).toContain(
      'if "agentmail" in s: s["agentmail"]["enabled"] = False',
    );
    expect(script).not.toContain("wm_live_");
  });
});

describe("provisionEmail (MAIL_PROVIDER=wzrdmail)", () => {
  beforeEach(() => {
    process.env["MAIL_PROVIDER"] = "wzrdmail";
  });

  it("provisions pod → inbox → webhook → draft-only key and rewires the box", async () => {
    const result = await provisionEmail(fakeSupabase("box_1"), "user-1", "sam");
    expect(result).toEqual({ address: "sam@wzrd.tech" });

    expect(mail.ensurePod).toHaveBeenCalledWith("user-1");
    expect(mail.createInbox).toHaveBeenCalledWith("pod_1", "sam");
    expect(mail.ensureWebhook).toHaveBeenCalledWith(
      "https://air.test/api/inbound/email",
      ["pod_1"],
    );
    expect(mail.createDraftOnlyKeyForProvider).toHaveBeenCalledWith(
      "wzrdmail",
      "sam@wzrd.tech",
      "box-user-1",
    );

    // .hermes/.env: WZRDMAIL_* injected, AGENTMAIL_* left alone, other lines kept.
    const [boxIdArg, pathArg, written] = box.writeFile.mock.calls[0]!;
    expect([boxIdArg, pathArg]).toEqual(["box_1", ".hermes/.env"]);
    expect(written.split("\n").filter(Boolean)).toEqual([
      "OPENAI_API_KEY=gw",
      "AGENTMAIL_API_KEY=old",
      "AGENTMAIL_INBOX_ID=old@agentmail.to",
      "WZRDMAIL_API_KEY=wm_live_draftonly",
      "WZRDMAIL_INBOX_ID=sam@wzrd.tech",
    ]);

    // MCP registration never puts the key on a command line.
    const cmd = box.command.mock.calls[0]![1];
    expect(cmd).toContain("https://mcp.mail.wzrd.tech/mcp");
    expect(cmd).toContain('"x-api-key": "${WZRDMAIL_API_KEY}"');
    expect(cmd).not.toContain("wm_live_draftonly");
  });

  it("skips box wiring when the user has no box yet", async () => {
    await provisionEmail(fakeSupabase(null), "user-1", "sam");
    expect(mail.createDraftOnlyKeyForProvider).not.toHaveBeenCalled();
    expect(box.writeFile).not.toHaveBeenCalled();
  });

  it("rewires an already-provisioned address instead of returning early", async () => {
    await provisionEmail(
      fakeSupabase("bx_replacement", "sam@wzrd.tech"),
      "user-1",
      "sam",
    );
    expect(mail.createInbox).not.toHaveBeenCalled();
    expect(mail.createDraftOnlyKeyForProvider).toHaveBeenCalledWith(
      "wzrdmail",
      "sam@wzrd.tech",
      "box-user-1",
    );
    expect(box.writeFile).toHaveBeenCalledWith(
      "bx_replacement",
      ".hermes/.env",
      expect.stringContaining("WZRDMAIL_API_KEY=wm_live_draftonly"),
    );
  });

  it.each(["bx_replacement", "tk_replacement"])(
    "installs an existing mailbox on %s",
    async (boxId) => {
      const installed = await installExistingMailbox(
        fakeSupabase(null, "sam@wzrd.tech"),
        "user-1",
        boxId,
      );
      expect(installed).toBe(true);
      expect(mail.createDraftOnlyKeyForProvider).toHaveBeenCalledWith(
        "wzrdmail",
        "sam@wzrd.tech",
        "box-user-1",
      );
      expect(box.writeFile).toHaveBeenCalledWith(
        boxId,
        ".hermes/.env",
        expect.stringContaining("WZRDMAIL_INBOX_ID=sam@wzrd.tech"),
      );
      expect(box.command).toHaveBeenCalledWith(
        boxId,
        expect.stringContaining('"x-api-key": "${WZRDMAIL_API_KEY}"'),
        120,
      );
    },
  );

  it("falls back to the legacy mailbox provider on a missing current-provider inbox", async () => {
    mail.createDraftOnlyKeyForProvider
      .mockRejectedValueOnce(new MailApiError(404, "inbox not found"))
      .mockResolvedValueOnce("legacy_draft_key");

    await installExistingMailbox(
      fakeSupabase(null, "legacy@wzrd.tech"),
      "user-1",
      "bx_replacement",
    );

    expect(mail.createDraftOnlyKeyForProvider.mock.calls).toEqual([
      ["wzrdmail", "legacy@wzrd.tech", "box-user-1"],
      ["agentmail", "legacy@wzrd.tech", "box-user-1"],
    ]);
    expect(box.writeFile).toHaveBeenCalledWith(
      "bx_replacement",
      ".hermes/.env",
      expect.stringContaining("AGENTMAIL_API_KEY=legacy_draft_key"),
    );
  });

  it("initializes mailbox variables when .hermes/.env is absent", async () => {
    box.readFile.mockRejectedValueOnce(new BoxApiError(404, "missing"));

    await installMailboxOnBox(
      "bx_replacement",
      "user-1",
      "sam@wzrd.tech",
      "wzrdmail",
    );

    expect(box.writeFile).toHaveBeenCalledWith(
      "bx_replacement",
      ".hermes/.env",
      "WZRDMAIL_API_KEY=wm_live_draftonly\nWZRDMAIL_INBOX_ID=sam@wzrd.tech\n",
    );
  });

  it("does not overwrite .hermes/.env after a non-not-found read failure", async () => {
    box.readFile.mockRejectedValueOnce(new BoxApiError(503, "transport failed"));

    await expect(
      installMailboxOnBox(
        "bx_replacement",
        "user-1",
        "sam@wzrd.tech",
        "wzrdmail",
      ),
    ).rejects.toMatchObject({ status: 503 });

    expect(box.writeFile).not.toHaveBeenCalled();
    expect(box.command).not.toHaveBeenCalled();
  });
});

describe("provisionEmail (default provider)", () => {
  it("uses the wzrdmail env names and MCP", async () => {
    delete process.env["MAIL_PROVIDER"];
    box.readFile.mockResolvedValueOnce("OPENAI_API_KEY=gw\n");
    await provisionEmail(fakeSupabase("box_1"), "user-1", "sam");
    const written = box.writeFile.mock.calls[0]![2];
    expect(written).toContain("WZRDMAIL_API_KEY=wm_live_draftonly");
    expect(written).toContain("WZRDMAIL_INBOX_ID=sam@wzrd.tech");
    expect(written).not.toContain("AGENTMAIL_");
    expect(box.command.mock.calls[0]![1]).toContain(
      "https://mcp.mail.wzrd.tech/mcp",
    );
  });
});
