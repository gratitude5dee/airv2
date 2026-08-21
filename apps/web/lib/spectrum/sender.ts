/**
 * Outbound iMessage. There is no HTTP send endpoint (ARCHITECTURE.md §7.2):
 * every send holds a live spectrum-ts instance, per invocation for beta
 * (§7.2 option b). The line is always pinned explicitly with `phone` from
 * the lines row — never the Chat SDK adapter's line inference, which throws
 * NotImplementedError on every cold thread once per-user lines exist.
 */
import {
  Spectrum,
  app as appCard,
  attachment,
  edit,
  reaction,
  read,
  richlink,
  text,
  typing,
  type Message,
} from "spectrum-ts";
import {
  customizedMiniApp,
  imessage,
} from "spectrum-ts/providers/imessage";
import { env } from "../env";
import {
  parseMiniAppCardSession,
  type MiniAppCardSession,
} from "../miniapps/cardSessions";

export interface SpectrumSender {
  /** Fire a typing indicator at the chat — before the box resumes. */
  startTyping(spaceId: string, phone: string): Promise<void>;
  /**
   * Surface a read receipt for an inbound message (chat-level on iMessage:
   * everything unread in the chat is marked read). Best-effort.
   */
  markRead(spaceId: string, phone: string, messageId: string): Promise<void>;
  /** Send one finished text bubble. */
  sendText(spaceId: string, phone: string, body: string): Promise<void>;
  /**
   * Attach a tapback/emoji reaction to an inbound message. Resolves true
   * when the reaction was sent, false when the target could not be resolved
   * or the platform skipped it.
   */
  react(
    spaceId: string,
    phone: string,
    messageId: string,
    emoji: string
  ): Promise<boolean>;
  /**
   * Stream a reply: the first chunk lands as a real message and is edited
   * in place as more arrives (goal.md M2 task 6).
   */
  streamText(
    spaceId: string,
    phone: string,
    stream: AsyncIterable<string>
  ): Promise<void>;
  /**
   * Send a live app card; the URL is produced by a thunk so signed links
   * are minted at send time, never stored (C15).
   */
  sendApp(
    spaceId: string,
    phone: string,
    url: () => string | Promise<string>,
    layout?: AppCardLayout
  ): Promise<Message | undefined>;
  /** Refresh a previously-sent live app card and return its new session. */
  editApp(
    spaceId: string,
    phone: string,
    session: MiniAppCardSession,
    url: () => string | Promise<string>,
    layout?: AppCardLayout
  ): Promise<MiniAppCardSession | undefined>;
  /** Send bytes as a native media bubble (M16 creative delivery). */
  sendAttachment(
    spaceId: string,
    phone: string,
    data: Buffer,
    options: { name: string; mimeType: string }
  ): Promise<void>;
  /** Send a rich link card — the fallback when native media send fails. */
  sendRichLink(spaceId: string, phone: string, url: string): Promise<void>;
  /** Webhooks carry attachment metadata only; bytes come through the SDK. */
  getAttachment(
    attachmentId: string,
    phone: string
  ): Promise<{ data: Buffer; mimeType: string; name: string } | undefined>;
  close(): Promise<void>;
}

export interface AppCardLayout {
  caption?: string;
  subcaption?: string;
}

/**
 * Cards are sent as customized iMessage App cards for the extension
 * identified by the IMESSAGE_* env vars (default: Photon/Spectrum's
 * published extension). `live` is deliberately omitted: live cards render
 * the extension UI inline in the transcript bubble, while a static card
 * opens the full-screen sheet view on tap — the presentation mini-apps need.
 */
function buildAppCard(
  url: string,
  layout: AppCardLayout | undefined
): ReturnType<typeof appCard> {
  const extension = env.imessageMiniAppExtension();
  return customizedMiniApp({
    appName: extension.appName,
    extensionBundleId: extension.extensionBundleId,
    teamId: extension.teamId,
    ...(extension.appStoreId ? { appStoreId: extension.appStoreId } : {}),
    url,
    layout: {
      ...(layout?.caption ? { caption: layout.caption } : {}),
      ...(layout?.subcaption ? { subcaption: layout.subcaption } : {}),
    },
  });
}

export async function createSpectrumSender(): Promise<SpectrumSender> {
  const app = await Spectrum({
    projectId: env.spectrumProjectId(),
    projectSecret: env.spectrumProjectSecret(),
    providers: [imessage.config()],
  });
  const im = imessage(app);
  const space = async (spaceId: string, phone: string) =>
    await im.space.get(spaceId, { phone });

  return {
    startTyping: async (spaceId, phone) => {
      await (await space(spaceId, phone)).send(typing("start"));
    },
    markRead: async (spaceId, phone, messageId) => {
      const s = await space(spaceId, phone);
      const message = await s.getMessage(messageId);
      if (!message || message.direction !== "inbound") return;
      await s.send(read(message));
    },
    sendText: async (spaceId, phone, body) => {
      await (await space(spaceId, phone)).send(text(body));
    },
    react: async (spaceId, phone, messageId, emoji) => {
      const s = await space(spaceId, phone);
      const message = await s.getMessage(messageId);
      if (!message || message.direction !== "inbound") return false;
      const sent = await s.send(reaction(emoji, message));
      return sent !== undefined;
    },
    streamText: async (spaceId, phone, stream) => {
      await (await space(spaceId, phone)).send(text(stream));
    },
    sendAttachment: async (spaceId, phone, data, options) => {
      await (await space(spaceId, phone)).send(attachment(data, options));
    },
    sendRichLink: async (spaceId, phone, url) => {
      await (await space(spaceId, phone)).send(richlink(url));
    },
    sendApp: async (spaceId, phone, url, layout) => {
      return (await space(spaceId, phone)).send(
        buildAppCard(await url(), layout)
      );
    },
    editApp: async (spaceId, phone, session, url, layout) => {
      const s = await space(spaceId, phone);
      const messageIds = [
        session.targetMessageGuid,
        session.messageGuid,
      ].filter((id, index, ids) => ids.indexOf(id) === index);
      let message: Message | undefined;
      for (const messageId of messageIds) {
        let candidate: Message | undefined;
        try {
          candidate = await s.getMessage(messageId);
        } catch {
          continue;
        }
        if (candidate && candidate.direction === "outbound") {
          message = candidate;
          break;
        }
      }
      if (!message || message.direction !== "outbound") return undefined;
      const target = Object.assign(message, {
        miniAppCardSession: session,
      });
      await s.send(edit(buildAppCard(await url(), layout), target));
      return parseMiniAppCardSession(target.miniAppCardSession);
    },
    getAttachment: async (attachmentId, phone) => {
      const attachment = await im.getAttachment(attachmentId, phone);
      if (!attachment) return undefined;
      return {
        data: await attachment.read(),
        mimeType: attachment.mimeType,
        name: attachment.name,
      };
    },
    close: async () => {
      await app.stop();
    },
  };
}
