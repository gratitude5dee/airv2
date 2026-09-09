import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  agentmailCreateDraft,
  agentmailCreateDraftOnlyKey,
  wzrdmailCreateDraft,
  wzrdmailCreateDraftOnlyKey,
} = vi.hoisted(() => ({
  agentmailCreateDraft: vi.fn(async () => "am-draft"),
  agentmailCreateDraftOnlyKey: vi.fn(async () => "am-key"),
  wzrdmailCreateDraft: vi.fn(async () => "wm-draft"),
  wzrdmailCreateDraftOnlyKey: vi.fn(async () => "wm-key"),
}));

vi.mock("../agentmail/client", () => ({
  createDraft: agentmailCreateDraft,
  createDraftOnlyKey: agentmailCreateDraftOnlyKey,
  AgentMailApiError: class extends Error {},
}));
vi.mock("../wzrdmail/client", () => ({
  createDraft: wzrdmailCreateDraft,
  createDraftOnlyKey: wzrdmailCreateDraftOnlyKey,
  WzrdMailApiError: class extends Error {},
}));

import { env } from "../env";
import {
  createDraft,
  createDraftOnlyKeyForProvider,
  inboundWebhookSecret,
  mailProvider,
} from "./client";

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
  it("defaults to wzrdmail", () => {
    expect(env.mailProvider()).toBe("wzrdmail");
    expect(mailProvider()).toBe("wzrdmail");
  });

  it("selects wzrdmail when explicitly set", () => {
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    expect(mailProvider()).toBe("wzrdmail");
  });

  it("selects agentmail when explicitly set", () => {
    process.env["MAIL_PROVIDER"] = "agentmail";
    expect(mailProvider()).toBe("agentmail");
  });

  it("rejects unknown providers loudly", () => {
    process.env["MAIL_PROVIDER"] = "gmail";
    expect(() => env.mailProvider()).toThrow(/MAIL_PROVIDER/);
  });

  it("derives the agent email domain from the provider", () => {
    delete process.env["AGENT_EMAIL_DOMAIN"];
    expect(env.agentEmailDomain()).toBe("wzrd.tech");
    process.env["MAIL_PROVIDER"] = "agentmail";
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
  it("routes to the wzrdmail client by default", async () => {
    await expect(createDraft("inbox", { text: "hi" })).resolves.toBe(
      "wm-draft",
    );
    expect(wzrdmailCreateDraft).toHaveBeenCalledWith("inbox", { text: "hi" });
    expect(agentmailCreateDraft).not.toHaveBeenCalled();
  });

  it("routes to the AgentMail client when explicitly set", async () => {
    process.env["MAIL_PROVIDER"] = "agentmail";
    await expect(createDraft("inbox", { text: "hi" })).resolves.toBe(
      "am-draft",
    );
    expect(agentmailCreateDraft).toHaveBeenCalledWith("inbox", { text: "hi" });
    expect(wzrdmailCreateDraft).not.toHaveBeenCalled();
  });

  it("routes to the wzrdmail client when explicitly set, evaluated per call", async () => {
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    await expect(createDraft("inbox", { text: "hi" })).resolves.toBe(
      "wm-draft",
    );
    expect(agentmailCreateDraft).not.toHaveBeenCalled();
  });

  it("can target a mailbox provider independently of the deployment default", async () => {
    await expect(
      createDraftOnlyKeyForProvider("agentmail", "inbox", "box-user"),
    ).resolves.toBe("am-key");
    expect(agentmailCreateDraftOnlyKey).toHaveBeenCalledWith(
      "inbox",
      "box-user",
    );
    expect(wzrdmailCreateDraftOnlyKey).not.toHaveBeenCalled();
  });

  it("picks the matching inbound webhook secret", () => {
    expect(inboundWebhookSecret()).toBe("whsec_wzrdmail");
    process.env["MAIL_PROVIDER"] = "agentmail";
    expect(inboundWebhookSecret()).toBe("whsec_agentmail");
    process.env["MAIL_PROVIDER"] = "wzrdmail";
    expect(inboundWebhookSecret()).toBe("whsec_wzrdmail");
  });
});
