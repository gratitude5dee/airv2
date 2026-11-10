/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * workerd-compatible drop-in for `@photon-ai/advanced-imessage/grpc`.
 *
 * The package's gRPC client lazily imports `@grpc/grpc-js`, which needs
 * `node:http2` — absent on Cloudflare Workers, so every `space.send` threw
 * (`first_bubble_failed` on every run). The Photon gateway fronts the gRPC
 * service with envoy's gRPC-Web filter, which speaks plain HTTP/1.1 POSTs of
 * framed protobuf — fully within fetch().
 *
 * `next.config.ts` webpack-aliases `@photon-ai/advanced-imessage/grpc` to this
 * module and `photon-grpc-shared` / `photon-grpc-codecs` to the package's two
 * shared chunks (proto message coders, mappers, error classes). Those chunks
 * are runtime-agnostic and are the same ones the fetch-based `/http` entry
 * imports; only their generated `*ServiceDefinition` objects are needed here.
 */
import type { AdvancedIMessage } from "@photon-ai/advanced-imessage";

import * as shared from "photon-grpc-shared";
import * as codecs from "photon-grpc-codecs";

const {
  AuthenticationError,
  ConnectionError,
  EventServiceDefinition,
  IMessageError,
  NotFoundError,
  RateLimitError,
  TypedEventStream,
  ValidationError,
  generateIdempotencyKey,
  mapAttachmentInfo,
  mapChat,
  mapChatEvent,
  mapCompanionInfo,
  mapEmbeddedMedia,
  mapGroupEvent,
  mapLocationRequestReceipt,
  mapMessage,
  mapMessageEvent,
  mapMultiServiceAddressInfo,
  mapOutgoingMessagePart,
  mapPoll,
  mapPollEvent,
  mapReplyTarget,
  mapSharedFriendLocation,
  mapSharedFriendLocationUpdated,
  mapTextFormatInput,
  normalizeChatGuid,
  unwrap,
} = shared;
const {
  AddressServiceDefinition,
  AttachmentServiceDefinition,
  ChatServiceDefinition,
  GroupServiceDefinition,
  LocationServiceDefinition,
  MessageServiceDefinition,
  PollServiceDefinition,
} = codecs;

export {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  NotFoundError,
  RateLimitError,
  TypedEventStream,
  ValidationError,
};
export const ErrorCode: any = shared["ErrorCode"];
export const MessageEffect: any = shared["MessageEffect"];
export const TextEffect: any = shared["TextEffect"];
export const decodeCatchUpEvent: any = shared["decodeCatchUpEvent"];
export const parseChatChangeEvent: any = shared["parseChatChangeEvent"];
export const parseGroupChangeEvent: any = shared["parseGroupChangeEvent"];
export const parseMessageChangeEvent: any = shared["parseMessageChangeEvent"];
export const parsePollChangeEvent: any = shared["parsePollChangeEvent"];

type GrpcStatus = { code: number; message: string; meta: Record<string, string> };

interface ClientOptions {
  address: string;
  token?: string | (() => Promise<string>) | (() => string);
  server?: string;
  tls?: boolean;
  timeout?: number;
  autoIdempotency?: boolean;
  retry?: boolean | { attempts?: number; delayMs?: number };
  onHeartbeat?: () => void;
}

const GRPC_WEB_CONTENT_TYPE = "application/grpc-web+proto";

function baseUrlFor(address: string): string {
  const withScheme = address.startsWith("http") ? address : `https://${address}`;
  return withScheme.replace(/\/+$/, "");
}

function encodeFrame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  out[0] = 0;
  new DataView(out.buffer).setUint32(1, payload.length, false);
  out.set(payload, 5);
  return out;
}

/** Incremental gRPC-web frame parser; feed chunks, read complete frames. */
class FrameParser {
  private buf = new Uint8Array(0);
  push(chunk: Uint8Array): { trailer: boolean; payload: Uint8Array }[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;
    const frames: { trailer: boolean; payload: Uint8Array }[] = [];
    while (this.buf.length >= 5) {
      const flags = this.buf[0] ?? 0;
      const len = new DataView(
        this.buf.buffer,
        this.buf.byteOffset + 1,
        4
      ).getUint32(0, false);
      if (this.buf.length < 5 + len) break;
      frames.push({
        trailer: (flags & 0x80) !== 0,
        payload: this.buf.slice(5, 5 + len),
      });
      this.buf = this.buf.slice(5 + len);
    }
    return frames;
  }
}

function parseTrailerBlock(payload: Uint8Array): Record<string, string> {
  const text = new TextDecoder().decode(payload);
  const meta: Record<string, string> = {};
  for (const line of text.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return meta;
}

function headersToMeta(headers: Headers): Record<string, string> {
  const meta: Record<string, string> = {};
  headers.forEach((value, key) => {
    meta[key.toLowerCase()] = value;
  });
  return meta;
}

function toGrpcError(status: GrpcStatus): Error {
  const { code, message, meta } = status;
  const options = {
    code: meta["error-code"] ?? "internalError",
    context: Object.fromEntries(
      Object.entries(meta)
        .filter(([k]) => k.startsWith("error-context-"))
        .map(([k, v]) => [k.slice("error-context-".length), v])
    ),
    retryable: meta["x-retryable"] === "true",
    grpcCode: code,
  };
  switch (code) {
    case 16: // UNAUTHENTICATED
    case 7: // PERMISSION_DENIED
      return new AuthenticationError(message, options);
    case 5: // NOT_FOUND
      return new NotFoundError(message, options);
    case 8: // RESOURCE_EXHAUSTED
      return new RateLimitError(message, options);
    case 3: // INVALID_ARGUMENT
    case 9: // FAILED_PRECONDITION
      return new ValidationError(message, options);
    case 14: // UNAVAILABLE
    case 4: // DEADLINE_EXCEEDED
      return new ConnectionError(message, options);
    default:
      return new IMessageError(message, options);
  }
}

const RETRYABLE_CODES = new Set([4, 14]); // DEADLINE_EXCEEDED, UNAVAILABLE

class GrpcWebTransport {
  constructor(private readonly options: ClientOptions) {}

  private async headers(): Promise<Record<string, string>> {
    const t = this.options.token;
    const token = typeof t === "function" ? await t() : t;
    const headers: Record<string, string> = {
      "content-type": GRPC_WEB_CONTENT_TYPE,
      "x-grpc-web": "1",
      accept: GRPC_WEB_CONTENT_TYPE,
    };
    if (token) headers["authorization"] = `Bearer ${token}`;
    if (this.options.server) headers["x-photon-server"] = this.options.server;
    return headers;
  }

  private url(def: { fullName: string }, method: { name: string }): string {
    return `${baseUrlFor(this.options.address)}/${def.fullName}/${method.name}`;
  }

  private withTimeout(signal?: AbortSignal): AbortSignal | undefined {
    const timeout = this.options.timeout;
    if (!timeout) return signal;
    const timeoutSignal = AbortSignal.timeout(timeout);
    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  }

  private assertStatus(status: GrpcStatus) {
    if (status.code !== 0) throw toGrpcError(status);
  }

  async unary(
    def: { fullName: string; methods: Record<string, any> },
    methodKey: string,
    request: Record<string, unknown>,
    attempt = 0
  ): Promise<any> {
    const method = def.methods[methodKey];
    if (this.options.autoIdempotency && "clientMessageId" in request) {
      request["clientMessageId"] ??= generateIdempotencyKey();
    }
    const payload = method.requestType.encode(request).finish();
    const signal = this.withTimeout();
    let res: Response;
    try {
      res = await fetch(this.url(def, method), {
        method: "POST",
        headers: await this.headers(),
        body: encodeFrame(payload) as BodyInit,
        signal: signal ?? null,
      });
    } catch (err) {
      if (attempt === 0 && this.options.retry) return this.unary(def, methodKey, request, 1);
      throw toGrpcError({
        code: 14,
        message: err instanceof Error ? err.message : String(err),
        meta: {},
      });
    }
    const meta = headersToMeta(res.headers);
    const statusHeader = res.headers.get("grpc-status");
    const buf = new Uint8Array(await res.arrayBuffer());
    const parser = new FrameParser();
    const frames = parser.push(buf);
    let response: any;
    let trailerStatus: GrpcStatus | undefined;
    for (const frame of frames) {
      if (frame.trailer) {
        const tm = parseTrailerBlock(frame.payload);
        trailerStatus = {
          code: Number(tm["grpc-status"] ?? 0),
          message: decodeURIComponent(tm["grpc-message"] ?? ""),
          meta: { ...meta, ...tm },
        };
      } else {
        response = method.responseType.decode(frame.payload);
      }
    }
    const status: GrpcStatus =
      trailerStatus ??
      (statusHeader !== null
        ? {
            code: Number(statusHeader),
            message: decodeURIComponent(res.headers.get("grpc-message") ?? ""),
            meta,
          }
        : { code: 0, message: "", meta });
    if (status.code !== 0) {
      if (attempt === 0 && this.options.retry && RETRYABLE_CODES.has(status.code)) {
        await new Promise((r) => setTimeout(r, 300));
        return this.unary(def, methodKey, request, 1);
      }
      this.assertStatus(status);
    }
    return response;
  }

  stream(
    def: { fullName: string; methods: Record<string, any> },
    methodKey: string,
    request: Record<string, unknown>,
    onHeartbeat?: () => void
  ): AsyncGenerator<any, void, void> {
    const method = def.methods[methodKey];
    if (this.options.autoIdempotency && "clientMessageId" in request) {
      request["clientMessageId"] ??= generateIdempotencyKey();
    }
    const payload = method.requestType.encode(request).finish();
    const abort = new AbortController();
    return this.streamFrames(def, method, payload, abort, onHeartbeat);
  }

  private async *streamFrames(
    def: { fullName: string },
    method: { name: string; responseType: any },
    payload: Uint8Array,
    abort: AbortController,
    onHeartbeat?: () => void
  ): AsyncGenerator<any, void, void> {
    let res: Response;
    try {
      res = await fetch(this.url(def, method), {
        method: "POST",
        headers: await this.headers(),
        body: encodeFrame(payload) as BodyInit,
        signal: abort.signal,
      });
    } catch (err) {
      throw toGrpcError({
        code: 14,
        message: err instanceof Error ? err.message : String(err),
        meta: {},
      });
    }
    const statusHeader = res.headers.get("grpc-status");
    if (statusHeader !== null && Number(statusHeader) !== 0) {
      this.assertStatus({
        code: Number(statusHeader),
        message: decodeURIComponent(res.headers.get("grpc-message") ?? ""),
        meta: headersToMeta(res.headers),
      });
    }
    const parser = new FrameParser();
    let trailer: GrpcStatus | undefined;
    const meta = headersToMeta(res.headers);
    const reader = res.body?.getReader();
    if (!reader) return;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const frame of parser.push(value)) {
          if (frame.trailer) {
            const tm = parseTrailerBlock(frame.payload);
            trailer = {
              code: Number(tm["grpc-status"] ?? 0),
              message: decodeURIComponent(tm["grpc-message"] ?? ""),
              meta: { ...meta, ...tm },
            };
            continue;
          }
          const decoded = method.responseType.decode(frame.payload);
          if (decoded?.heartbeat) {
            onHeartbeat?.();
            continue;
          }
          yield decoded;
        }
      }
    } finally {
      reader.releaseLock();
    }
    if (trailer && trailer.code !== 0) this.assertStatus(trailer);
  }

  close() {
    // Stateless: every call is its own fetch; nothing to tear down.
  }

  static __GRPC_WEB_TRANSPORT__ = true;
}

type Transport = GrpcWebTransport;

function toReactionKind(reaction: string): number {
  switch (reaction) {
    case "love":
      return 0;
    case "like":
      return 1;
    case "dislike":
      return 2;
    case "laugh":
      return 3;
    case "emphasize":
      return 4;
    case "question":
      return 5;
    case "emoji":
      return 6;
    default:
      throw new TypeError(`Unsupported reaction kind: ${String(reaction)}`);
  }
}

function normalizeSequenceCursor(cursor: number | undefined, field: string) {
  if (cursor === undefined) return undefined;
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new ValidationError(`${field} must be a non-negative safe integer.`, {
      code: "invalidArgument",
      context: { field, value: String(cursor) },
      grpcCode: 3,
      retryable: false,
    });
  }
  return cursor;
}

function mapMiniAppCardSession(session: any) {
  const cardSession = unwrap(session, "miniAppCardSession");
  return {
    chatGuid: cardSession.chatGuid,
    messageGuid: cardSession.messageGuid,
    sessionId: cardSession.sessionId,
    targetMessageGuid: cardSession.targetMessageGuid,
  };
}

function mapMiniAppMessageResult(response: any) {
  return {
    ...mapMessage(unwrap(response.message, "message")),
    miniAppCardSession: mapMiniAppCardSession(response.miniAppCardSession),
  };
}

function streamOf<T>(
  transport: Transport,
  def: any,
  methodKey: string,
  request: Record<string, unknown>,
  map: (frame: any) => T | undefined,
  onHeartbeat?: () => void
): AsyncIterable<T> {
  const inner = transport.stream(def, methodKey, request, onHeartbeat);
  return {
    [Symbol.asyncIterator]() {
      const it = inner[Symbol.asyncIterator]();
      return {
        async next(): Promise<IteratorResult<T>> {
          for (;;) {
            const { done, value } = await it.next();
            if (done) return { done: true, value: undefined };
            const mapped = map(value);
            if (mapped !== undefined) return { done: false, value: mapped };
          }
        },
      };
    },
  };
}

function typedStream<T>(
  transport: Transport,
  def: any,
  methodKey: string,
  request: Record<string, unknown>,
  map: (frame: any) => T | undefined,
  onHeartbeat?: () => void
): any {
  const abort = new AbortController();
  const iterable = streamOf(transport, def, methodKey, request, map, onHeartbeat);
  return new TypedEventStream(iterable, async () => abort.abort());
}

function buildClient(options: ClientOptions): AdvancedIMessage {
  const transport = new GrpcWebTransport(options);
  const hb = options.onHeartbeat;

  const messages = {
    async sendText(chat: string, text: string, options?: any) {
      const response = await transport.unary(MessageServiceDefinition, "sendTextMessage", {
        chatGuid: normalizeChatGuid(chat),
        text,
        replyTo: mapReplyTarget(options?.replyTo),
        subject: options?.subject,
        effectId: options?.effect,
        enableDataDetection: options?.enableDataDetection,
        enableLinkPreview: options?.enableLinkPreview,
        formatting: (options?.formatting ?? []).map(mapTextFormatInput),
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async sendAttachment(chat: string, attachment: string, options?: any) {
      const response = await transport.unary(MessageServiceDefinition, "sendAttachmentMessage", {
        chatGuid: normalizeChatGuid(chat),
        attachment: { attachmentGuid: attachment },
        replyTo: mapReplyTarget(options?.replyTo),
        effectId: options?.effect,
        isAudioMessage: options?.isAudioMessage,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async sendMultipart(chat: string, parts: any[], options?: any) {
      const response = await transport.unary(MessageServiceDefinition, "sendMultipartMessage", {
        chatGuid: normalizeChatGuid(chat),
        parts: parts.map(mapOutgoingMessagePart),
        replyTo: mapReplyTarget(options?.replyTo),
        subject: options?.subject,
        effectId: options?.effect,
        enableDataDetection: options?.enableDataDetection,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async sendCustomizedMiniApp(chat: string, message: any, options?: any) {
      const response = await transport.unary(
        MessageServiceDefinition,
        "sendCustomizedMiniAppMessage",
        {
          chatGuid: normalizeChatGuid(chat),
          teamId: message.teamId,
          extensionBundleId: message.extensionBundleId,
          appName: message.appName,
          url: message.url,
          layout: message.layout,
          appStoreId: message.appStoreId,
          live: message.live ?? false,
          clientMessageId: options?.clientMessageId,
        }
      );
      return mapMiniAppMessageResult(response);
    },
    async updateCustomizedMiniApp(session: any, message: any, options?: any) {
      const response = await transport.unary(
        MessageServiceDefinition,
        "updateCustomizedMiniAppMessage",
        {
          session,
          teamId: message.teamId,
          extensionBundleId: message.extensionBundleId,
          appName: message.appName,
          url: message.url,
          layout: message.layout,
          appStoreId: message.appStoreId,
          live: message.live ?? false,
          clientMessageId: options?.clientMessageId,
        }
      );
      return mapMiniAppMessageResult(response);
    },
    async edit(chat: string, message: string, newText: string, options?: any) {
      const response = await transport.unary(MessageServiceDefinition, "editMessage", {
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        newText,
        backwardCompatText: options?.backwardCompatText,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async unsend(chat: string, message: string, options?: any) {
      await transport.unary(MessageServiceDefinition, "unsendMessage", {
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        clientMessageId: options?.clientMessageId,
      });
    },
    async setReaction(
      chat: string,
      message: string,
      reaction: { kind: string; emoji?: string },
      isSet: boolean,
      options?: any
    ) {
      const kind = toReactionKind(reaction.kind);
      const response = await transport.unary(MessageServiceDefinition, "setReaction", {
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        reaction: { kind, emoji: reaction.emoji },
        isSet,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async placeSticker(
      chat: string,
      message: string,
      sticker: string,
      placement: any,
      options?: any
    ) {
      const response = await transport.unary(MessageServiceDefinition, "placeSticker", {
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        sticker: { attachmentGuid: sticker },
        placement,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async notifySilenced(chat: string, message: string, options?: any) {
      await transport.unary(MessageServiceDefinition, "notifySilencedMessage", {
        chatGuid: normalizeChatGuid(chat),
        messageGuid: message,
        clientMessageId: options?.clientMessageId,
      });
    },
    async get(message: string) {
      const response = await transport.unary(MessageServiceDefinition, "getMessage", {
        messageGuid: message,
      });
      return mapMessage(unwrap(response.message, "message"));
    },
    async listRecent(options?: any) {
      const response = await transport.unary(MessageServiceDefinition, "listRecentMessages", {
        pageSize: options?.pageSize,
        pageToken: options?.pageToken,
        isFromMe: options?.isFromMe,
        isRead: options?.isRead,
        before: options?.before,
        after: options?.after,
      });
      return {
        messages: (response.messages ?? []).map(mapMessage),
        nextPageToken: response.nextPageToken,
      };
    },
    async listInChat(chat: string, options?: any) {
      const response = await transport.unary(MessageServiceDefinition, "listChatMessages", {
        chatGuid: normalizeChatGuid(chat),
        pageSize: options?.pageSize,
        pageToken: options?.pageToken,
        isFromMe: options?.isFromMe,
        isRead: options?.isRead,
        before: options?.before,
        after: options?.after,
      });
      return {
        messages: (response.messages ?? []).map(mapMessage),
        nextPageToken: response.nextPageToken,
      };
    },
    async getEmbeddedMedia(chat: string, message: string) {
      const response = await transport.unary(MessageServiceDefinition, "getEmbeddedMedia", {
        chatGuid: normalizeChatGuid(chat),
        messageGuid: message,
      });
      return mapEmbeddedMedia(unwrap(response.media, "media"));
    },
    subscribeEvents(filter?: any) {
      return typedStream(
        transport,
        MessageServiceDefinition,
        "subscribeMessageEvents",
        { chatGuid: filter?.chat ? normalizeChatGuid(filter.chat) : undefined },
        (frame) =>
          frame.sequence === undefined || !frame.messageChanged
            ? undefined
            : mapMessageEvent(frame.sequence, frame.messageChanged),
        hb
      );
    },
  };

  const chats = {
    async create(addresses: string[], options?: any) {
      const message = options?.message;
      if (message !== undefined && typeof message !== "string") {
        throw new ValidationError("message must be a string.", {
          code: "invalidArgument",
          context: { field: "message", value: String(message) },
          grpcCode: 3,
          retryable: false,
        });
      }
      const response = await transport.unary(ChatServiceDefinition, "createChat", {
        addresses,
        clientMessageId: options?.clientMessageId,
        service: 1, // CHAT_SERVICE_TYPE_IMESSAGE
        initialMessage:
          message === undefined
            ? undefined
            : {
                attributedBody: options?.attributedBody,
                text: message,
                effectId: options?.effect,
                subject: options?.subject,
              },
      });
      return {
        chat: mapChat(unwrap(response.chat, "chat")),
        initialMessage: response.initialMessage
          ? mapMessage(response.initialMessage)
          : undefined,
      };
    },
    async get(chat: string) {
      const response = await transport.unary(ChatServiceDefinition, "getChat", {
        chatGuid: normalizeChatGuid(chat),
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    async count(options?: any) {
      const response = await transport.unary(ChatServiceDefinition, "getChatCount", {
        includeArchived: options?.includeArchived ?? false,
      });
      return response.count;
    },
    async hasBackground(chat: string) {
      const response = await transport.unary(ChatServiceDefinition, "hasBackground", {
        chatGuid: normalizeChatGuid(chat),
      });
      return response.backgroundPresent;
    },
    async setBackground(chat: string, data: Uint8Array) {
      await transport.unary(ChatServiceDefinition, "setBackground", {
        chatGuid: normalizeChatGuid(chat),
        data,
      });
    },
    async removeBackground(chat: string) {
      await transport.unary(ChatServiceDefinition, "removeBackground", {
        chatGuid: normalizeChatGuid(chat),
      });
    },
    async markRead(chat: string) {
      await transport.unary(ChatServiceDefinition, "markChatRead", {
        chatGuid: normalizeChatGuid(chat),
      });
    },
    async shareContactInfo(chat: string) {
      await transport.unary(ChatServiceDefinition, "shareContactInfo", {
        chatGuid: normalizeChatGuid(chat),
      });
    },
    async setTyping(chat: string, isTyping: boolean) {
      await transport.unary(ChatServiceDefinition, "setTyping", {
        chatGuid: normalizeChatGuid(chat),
        isTyping,
      });
    },
    subscribeEvents(filter?: any) {
      return typedStream(
        transport,
        ChatServiceDefinition,
        "subscribeChatEvents",
        { chatGuid: filter?.chat ? normalizeChatGuid(filter.chat) : undefined },
        (frame) =>
          frame.sequence === undefined || !frame.chatChanged
            ? undefined
            : mapChatEvent(frame.sequence, frame.chatChanged),
        hb
      );
    },
  };

  const groups = {
    async setDisplayName(chat: string, displayName: string, options?: any) {
      const response = await transport.unary(GroupServiceDefinition, "setDisplayName", {
        chatGuid: normalizeChatGuid(chat),
        displayName,
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    async addParticipants(chat: string, addresses: string[], options?: any) {
      const response = await transport.unary(GroupServiceDefinition, "addParticipants", {
        chatGuid: normalizeChatGuid(chat),
        addresses,
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    async removeParticipants(chat: string, addresses: string[], options?: any) {
      const response = await transport.unary(GroupServiceDefinition, "removeParticipants", {
        chatGuid: normalizeChatGuid(chat),
        addresses,
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    async leave(chat: string, options?: any) {
      const response = await transport.unary(GroupServiceDefinition, "leaveGroup", {
        chatGuid: normalizeChatGuid(chat),
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    async setIcon(chat: string, data: Uint8Array, options?: any) {
      const response = await transport.unary(GroupServiceDefinition, "setIcon", {
        chatGuid: normalizeChatGuid(chat),
        icon: { data },
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    async getIcon(chat: string) {
      const response = await transport.unary(GroupServiceDefinition, "getIcon", {
        chatGuid: normalizeChatGuid(chat),
      });
      const icon = unwrap(response.icon, "icon");
      return icon?.data ?? icon;
    },
    async removeIcon(chat: string, options?: any) {
      const response = await transport.unary(GroupServiceDefinition, "removeIcon", {
        chatGuid: normalizeChatGuid(chat),
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    },
    subscribeEvents() {
      return typedStream(
        transport,
        GroupServiceDefinition,
        "subscribeGroupEvents",
        {},
        (frame) =>
          frame.sequence === undefined || !frame.groupChanged
            ? undefined
            : mapGroupEvent(frame.sequence, frame.groupChanged),
        hb
      );
    },
  };

  const attachments = {
    async get(attachment: string) {
      const response = await transport.unary(AttachmentServiceDefinition, "getAttachmentInfo", {
        attachmentGuid: attachment,
      });
      return mapAttachmentInfo(unwrap(response.attachment, "attachment"));
    },
    async upload(input: { fileName: string; data: Uint8Array; companion?: { data: Uint8Array } }) {
      const response = await transport.unary(AttachmentServiceDefinition, "uploadAttachment", {
        fileName: input.fileName,
        data: input.data,
        companion: input.companion
          ? { data: input.companion.data, kind: 1 } // COMPANION_KIND_LIVE_PHOTO_VIDEO
          : undefined,
      });
      return {
        attachment: mapAttachmentInfo(unwrap(response.attachment, "attachment")),
        companion: response.companion ? mapCompanionInfo(response.companion) : undefined,
      };
    },
    downloadStream(attachment: string) {
      const iterable = streamOf(
        transport,
        AttachmentServiceDefinition,
        "downloadAttachment",
        { attachmentGuid: attachment },
        (frame) => {
          if (frame.header) {
            return {
              type: "header",
              info: mapAttachmentInfo(unwrap(frame.header.attachment, "attachment")),
              companionInfo: frame.header.companion
                ? mapCompanionInfo(frame.header.companion)
                : undefined,
            };
          }
          if (frame.primaryChunk) return { type: "primaryChunk", data: frame.primaryChunk };
          if (frame.companionChunk) return { type: "companionChunk", data: frame.companionChunk };
          return undefined;
        }
      );
      const abort = new AbortController();
      return new TypedEventStream(iterable, async () => abort.abort());
    },
  };

  const addresses = {
    async get(address: string) {
      const response = await transport.unary(AddressServiceDefinition, "getAddressInfo", {
        address,
      });
      return mapMultiServiceAddressInfo(unwrap(response.info, "info"));
    },
    async isFocusSilenced(address: string) {
      const response = await transport.unary(AddressServiceDefinition, "getFocusStatus", {
        address,
      });
      return response.isSilencedByFocus;
    },
    async isIMessageAvailable(address: string) {
      const response = await transport.unary(AddressServiceDefinition, "getIMessageAvailability", {
        address,
      });
      return response.isAvailable;
    },
  };

  const polls = {
    async create(chat: string, title: string, choices: string[], options?: any) {
      const response = await transport.unary(PollServiceDefinition, "createPoll", {
        chatGuid: normalizeChatGuid(chat),
        title,
        options: choices,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    },
    async get(pollMessage: string) {
      const response = await transport.unary(PollServiceDefinition, "getPoll", {
        pollMessageGuid: pollMessage,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    },
    async vote(pollMessage: string, optionId: string, options?: any) {
      const response = await transport.unary(PollServiceDefinition, "votePoll", {
        pollMessageGuid: pollMessage,
        optionIdentifier: optionId,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    },
    async unvote(pollMessage: string, options?: any) {
      const response = await transport.unary(PollServiceDefinition, "unvotePoll", {
        pollMessageGuid: pollMessage,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    },
    async addOption(pollMessage: string, text: string, options?: any) {
      const response = await transport.unary(PollServiceDefinition, "addPollOption", {
        pollMessageGuid: pollMessage,
        optionText: text,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    },
    subscribeEvents(filter?: any) {
      return typedStream(
        transport,
        PollServiceDefinition,
        "subscribePollEvents",
        { pollMessageGuid: filter?.pollMessage },
        (frame) =>
          frame.sequence === undefined || !frame.pollChanged
            ? undefined
            : mapPollEvent(frame.sequence, frame.pollChanged),
        hb
      );
    },
  };

  const locations = {
    async list() {
      const response = await transport.unary(
        LocationServiceDefinition,
        "listSharedFriendLocations",
        {}
      );
      return (response.locations ?? []).map(mapSharedFriendLocation);
    },
    async get(address: string) {
      const response = await transport.unary(
        LocationServiceDefinition,
        "getSharedFriendLocation",
        { address }
      );
      return mapSharedFriendLocation(unwrap(response.location, "location"));
    },
    async request(chat: string, address: string, options: any = {}) {
      const response = await transport.unary(
        LocationServiceDefinition,
        "requestFriendLocationSharing",
        {
          address,
          chatGuid: normalizeChatGuid(chat),
          clientMessageId: options.clientMessageId,
        }
      );
      return mapLocationRequestReceipt(response);
    },
    watch(address?: string) {
      return typedStream(
        transport,
        LocationServiceDefinition,
        "watchSharedFriendLocations",
        { address },
        (frame) =>
          frame.locationUpdated
            ? mapSharedFriendLocationUpdated(frame.locationUpdated)
            : undefined,
        hb
      );
    },
  };

  const events = {
    catchUp(since?: number) {
      const afterSequence = normalizeSequenceCursor(since, "since");
      const iterable = streamOf(
        transport,
        EventServiceDefinition,
        "catchUpEvents",
        { afterSequence },
        (frame) => {
          if (frame.complete) {
            return {
              type: "catchup.complete",
              headSequence: frame.complete.headSequence,
            };
          }
          if (frame.sequence === undefined) return undefined;
          if (frame.messageChanged) return mapMessageEvent(frame.sequence, frame.messageChanged);
          if (frame.chatChanged) return mapChatEvent(frame.sequence, frame.chatChanged);
          if (frame.groupChanged) return mapGroupEvent(frame.sequence, frame.groupChanged);
          if (frame.pollChanged) return mapPollEvent(frame.sequence, frame.pollChanged);
          return undefined;
        }
      );
      const abort = new AbortController();
      return new TypedEventStream(iterable, async () => abort.abort());
    },
  };

  function close() {
    transport.close();
    return Promise.resolve();
  }

  return {
    messages,
    chats,
    groups,
    attachments,
    addresses,
    polls,
    locations,
    events,
    close,
    async [Symbol.asyncDispose]() {
      await close();
    },
  } as unknown as AdvancedIMessage;
}

/**
 * Drop-in for the package's `createGrpcClient` — same options, same
 * `AdvancedIMessage` surface, over gRPC-Web instead of HTTP/2 gRPC.
 */
export function createGrpcClient(options: ClientOptions): AdvancedIMessage {
  return buildClient(options);
}

export const createClient = createGrpcClient;
