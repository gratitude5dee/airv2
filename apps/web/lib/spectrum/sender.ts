/**
 * Outbound iMessage. There is no HTTP send endpoint (ARCHITECTURE.md §7.2):
 * every send holds a live spectrum-ts instance, per invocation for beta
 * (§7.2 option b). The line is always pinned explicitly with `phone` from
 * the lines row — never the Chat SDK adapter's line inference, which throws
 * NotImplementedError on every cold thread once per-user lines exist.
 */
import { Spectrum, app as appCard, text, typing } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { env } from "../env";

export interface SpectrumSender {
  /** Fire a typing indicator at the chat — before the box resumes. */
  startTyping(spaceId: string, phone: string): Promise<void>;
  /** Send one finished text bubble. */
  sendText(spaceId: string, phone: string, body: string): Promise<void>;
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
    url: () => string | Promise<string>
  ): Promise<void>;
  /** Webhooks carry attachment metadata only; bytes come through the SDK. */
  getAttachment(
    attachmentId: string,
    phone: string
  ): Promise<{ data: Buffer; mimeType: string; name: string } | undefined>;
  close(): Promise<void>;
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
    sendText: async (spaceId, phone, body) => {
      await (await space(spaceId, phone)).send(text(body));
    },
    streamText: async (spaceId, phone, stream) => {
      await (await space(spaceId, phone)).send(text(stream));
    },
    sendApp: async (spaceId, phone, url) => {
      await (await space(spaceId, phone)).send(appCard(url, { live: true }));
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
