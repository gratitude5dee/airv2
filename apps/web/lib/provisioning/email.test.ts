import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mail, box } = vi.hoisted(() => ({
  mail: {
    ensurePod: vi.fn(async () => ({ pod_id: "pod_1", client_id: "user-1" })),
    createInbox: vi.fn(async () => ({ inbox_id: "sam@wzrd.tech" })),
    createDraftOnlyKey: vi.fn(async () => "wm_live_draftonly"),
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
    createDraftOnlyKey: mail.createDraftOnlyKey,
    ensureWebhook: mail.ensureWebhook,
  };
});
vi.mock("../box/client", () => box);

import { boxMailWiring, mailMcpInstallScript, provisionEmail } from "./email";

const ORIGINAL = { ...process.env };

function fakeSupabase(boxId: string | null) {
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
          data: table === "boxes" && boxId ? { provider_box_id: boxId } : null,
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
    expect(mail.createDraftOnlyKey).toHaveBeenCalledWith(
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
    expect(mail.createDraftOnlyKey).not.toHaveBeenCalled();
    expect(box.writeFile).not.toHaveBeenCalled();
  });
});

describe("provisionEmail (default provider)", () => {
  it("keeps the AgentMail env names and MCP", async () => {
    delete process.env["MAIL_PROVIDER"];
    box.readFile.mockResolvedValueOnce("OPENAI_API_KEY=gw\n");
    await provisionEmail(fakeSupabase("box_1"), "user-1", "sam");
    const written = box.writeFile.mock.calls[0]![2];
    expect(written).toContain("AGENTMAIL_API_KEY=wm_live_draftonly");
    expect(written).toContain("AGENTMAIL_INBOX_ID=sam@wzrd.tech");
    expect(written).not.toContain("WZRDMAIL_");
    expect(box.command.mock.calls[0]![1]).toContain(
      "https://mcp.agentmail.to/mcp",
    );
  });
});
