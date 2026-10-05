/**
 * Provider-neutral mail client. Every call is routed at invocation time by
 * MAIL_PROVIDER (default `wzrdmail`) to lib/agentmail/client.ts or
 * lib/wzrdmail/client.ts, which share one function surface. Callers import
 * from here; the provider modules are implementation detail.
 */
import { env } from "../env";
import * as agentmail from "../agentmail/client";
import * as wzrdmail from "../wzrdmail/client";

export { MailApiError } from "./errors";
export type {
  AgentMailAttachment as MailAttachment,
  AgentMailDraft as MailDraft,
  AgentMailMessage as MailMessage,
  AgentMailThread as MailThread,
  AgentMailThreadDetail as MailThreadDetail,
  AgentMailThreadPage as MailThreadPage,
  MailDraftPatch,
  MailMessageListOptions,
  MailMessagePage,
  MailMessagePatch,
  MailThreadListOptions,
  MailThreadPatch,
} from "../agentmail/client";

export type MailProvider = "agentmail" | "wzrdmail";

export function mailProvider(): MailProvider {
  return env.mailProvider();
}

/** The shared function surface (everything but each provider's error class). */
type MailClient = Omit<typeof agentmail, "AgentMailApiError">;

function client(): MailClient {
  return mailProvider() === "wzrdmail" ? wzrdmail : agentmail;
}

function clientFor(provider: MailProvider): MailClient {
  return provider === "wzrdmail" ? wzrdmail : agentmail;
}

export const deletePod: MailClient["deletePod"] = (...args) =>
  client().deletePod(...args);
export const ensurePod: MailClient["ensurePod"] = (...args) =>
  client().ensurePod(...args);
export const createInbox: MailClient["createInbox"] = (...args) =>
  client().createInbox(...args);
export const createDraftOnlyKey: MailClient["createDraftOnlyKey"] = (...args) =>
  client().createDraftOnlyKey(...args);
export function createDraftOnlyKeyForProvider(
  provider: MailProvider,
  ...args: Parameters<MailClient["createDraftOnlyKey"]>
): ReturnType<MailClient["createDraftOnlyKey"]> {
  return clientFor(provider).createDraftOnlyKey(...args);
}
export const getAttachmentBytes: MailClient["getAttachmentBytes"] = (...args) =>
  client().getAttachmentBytes(...args);
export const getMessage: MailClient["getMessage"] = (...args) =>
  client().getMessage(...args);
export const listThreads: MailClient["listThreads"] = (...args) =>
  client().listThreads(...args);
export const listThreadsPage: MailClient["listThreadsPage"] = (...args) =>
  client().listThreadsPage(...args);
export const getThread: MailClient["getThread"] = (...args) =>
  client().getThread(...args);
export const replyToMessage: MailClient["replyToMessage"] = (...args) =>
  client().replyToMessage(...args);
export const createDraft: MailClient["createDraft"] = (...args) =>
  client().createDraft(...args);
export const sendDraft: MailClient["sendDraft"] = (...args) =>
  client().sendDraft(...args);
export const listDrafts: MailClient["listDrafts"] = (...args) =>
  client().listDrafts(...args);
export const getDraft: MailClient["getDraft"] = (...args) =>
  client().getDraft(...args);
export const updateDraft: MailClient["updateDraft"] = (...args) =>
  client().updateDraft(...args);
export const deleteDraft: MailClient["deleteDraft"] = (...args) =>
  client().deleteDraft(...args);
export const listThreadsFiltered: MailClient["listThreadsFiltered"] = (
  ...args
) => client().listThreadsFiltered(...args);
export const searchThreads: MailClient["searchThreads"] = (...args) =>
  client().searchThreads(...args);
export const getThreadLabels: MailClient["getThreadLabels"] = (...args) =>
  client().getThreadLabels(...args);
export const patchThread: MailClient["patchThread"] = (...args) =>
  client().patchThread(...args);
export const trashThread: MailClient["trashThread"] = (...args) =>
  client().trashThread(...args);
export const restoreThread: MailClient["restoreThread"] = (...args) =>
  client().restoreThread(...args);
export const listMessages: MailClient["listMessages"] = (...args) =>
  client().listMessages(...args);
export const searchMessages: MailClient["searchMessages"] = (...args) =>
  client().searchMessages(...args);
export const patchMessage: MailClient["patchMessage"] = (...args) =>
  client().patchMessage(...args);
export const batchUpdateMessages: MailClient["batchUpdateMessages"] = (
  ...args
) => client().batchUpdateMessages(...args);
export const trashMessage: MailClient["trashMessage"] = (...args) =>
  client().trashMessage(...args);
export const restoreMessage: MailClient["restoreMessage"] = (...args) =>
  client().restoreMessage(...args);
export const addInboxBlockEntry: MailClient["addInboxBlockEntry"] = (...args) =>
  client().addInboxBlockEntry(...args);
export const removeInboxBlockEntry: MailClient["removeInboxBlockEntry"] = (
  ...args
) => client().removeInboxBlockEntry(...args);
export const ensureWebhook: MailClient["ensureWebhook"] = (...args) =>
  client().ensureWebhook(...args);

/** The `whsec_` secret that signs the active provider's inbound webhook. */
export function inboundWebhookSecret(): string {
  return mailProvider() === "wzrdmail"
    ? env.wzrdmailWebhookSecret()
    : env.agentmailWebhookSecret();
}
