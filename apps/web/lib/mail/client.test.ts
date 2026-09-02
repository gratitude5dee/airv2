import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { agentmailCreateDraft, wzrdmailCreateDraft } = vi.hoisted(() => ({
  agentmailCreateDraft: vi.fn(async () => "am-draft"),
  wzrdmailCreateDraft: vi.fn(async () => "wm-draft"),
}));

vi.mock("../agentmail/client", () => ({
  createDraft: agentmailCreateDraft,
  AgentMailApiError: class extends Error {},
}));
vi.mock("../wzrdmail/client", () => ({
  createDraft: wzrdmailCreateDraft,
  WzrdMailApiError: class extends Error {},
}));

import { env } from "../env";
import { createDraft, inboundWebhookSecret, mailProvider } from "./client";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env["MAIL_PROVIDER"];
  process.env["AGENTMAIL_WEBHOOK_SECRET"] = "whsec_agentmail";
  process.env["WZRDMAIL_WEBHOOK_SECRET"] = "whsec_wzrdmail";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.clearAllMocks();
});

describe("MAIL_PROVIDER", () => {
  it("defaults to agentmail", () => {
    expect(env.mailProvider()).toBe("agentmail");
    expect(mailProvider()).toBe("agentmail");
  });

  it("selects wzrdmail when set", () => {
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    expect(mailProvider()).toBe("wzrdmail");
  });

  it("rejects unknown providers loudly", () => {
    process.env["MAIL_PROVIDER"] = "gmail";
    expect(() => env.mailProvider()).toThrow(/MAIL_PROVIDER/);
  });

  it("derives the default agent email domain from the provider", () => {
    delete process.env["AGENT_EMAIL_DOMAIN"];
    expect(env.agentEmailDomain()).toBe("agentmail.to");
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    expect(env.agentEmailDomain()).toBe("wzrd.tech");
    process.env["AGENT_EMAIL_DOMAIN"] = "custom.example";
    expect(env.agentEmailDomain()).toBe("custom.example");
  });

  it("wzrdmailBaseUrl defaults to api.wzrd.tech and strips trailing slashes", () => {
    delete process.env["WZRDMAIL_BASE_URL"];
    expect(env.wzrdmailBaseUrl()).toBe("https://api.wzrd.tech");
    process.env["WZRDMAIL_BASE_URL"] = "https://staging.wzrd.test/";
    expect(env.wzrdmailBaseUrl()).toBe("https://staging.wzrd.test");
  });
});

describe("provider dispatch", () => {
  it("routes to the AgentMail client by default", async () => {
    await expect(createDraft("inbox", { text: "hi" })).resolves.toBe(
      "am-draft",
    );
    expect(agentmailCreateDraft).toHaveBeenCalledWith("inbox", { text: "hi" });
    expect(wzrdmailCreateDraft).not.toHaveBeenCalled();
  });

  it("routes to the wzrdmail client behind the flag, evaluated per call", async () => {
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    await expect(createDraft("inbox", { text: "hi" })).resolves.toBe(
      "wm-draft",
    );
    expect(agentmailCreateDraft).not.toHaveBeenCalled();
  });

  it("picks the matching inbound webhook secret", () => {
    expect(inboundWebhookSecret()).toBe("whsec_agentmail");
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    expect(inboundWebhookSecret()).toBe("whsec_wzrdmail");
  });
});
