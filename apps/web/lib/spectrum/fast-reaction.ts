/**
 * Latency-critical iMessage tapbacks.
 *
 * The universal Spectrum sender must first build an app, resolve the message,
 * and then issue the reaction. For the deterministic acknowledgement we
 * already have the chat guid and message guid from the signed webhook, so the
 * Advanced iMessage client can set the reaction in one request. Cloud
 * tokens are cached only in this warm process and refreshed before expiry;
 * no bearer is persisted or logged.
 */
import { createGrpcClient } from "@photon-ai/advanced-imessage/grpc";
import { cloud, type TokenData } from "spectrum-ts";
import { env } from "../env";

const DEFAULT_IMESSAGE_ADDRESS = "imessage.spectrum.photon.codes:443";
const TOKEN_REFRESH_SKEW_MS = 30_000;
const CHILD_MESSAGE_ID = /^p:(\d+)\/(.+)$/;

interface CachedTokenData {
  data: TokenData;
  expiresAtMs: number;
}

let tokenCache: CachedTokenData | undefined;
let tokenRequest: Promise<TokenData> | undefined;

async function issueTokenData(): Promise<TokenData> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - now > TOKEN_REFRESH_SKEW_MS) {
    return tokenCache.data;
  }
  if (!tokenRequest) {
    tokenRequest = cloud
      .issueImessageTokens(
        env.spectrumProjectId(),
        env.spectrumProjectSecret(),
      )
      .then((data) => {
        tokenCache = {
          data,
          expiresAtMs: Date.now() + Math.max(0, data.expiresIn) * 1_000,
        };
        return data;
      })
      .finally(() => {
        tokenRequest = undefined;
      });
  }
  return tokenRequest;
}

function dedicatedInstanceForPhone(
  data: Extract<TokenData, { type: "dedicated" }>,
  phone: string,
): string | undefined {
  return Object.entries(data.numbers).find(
    ([, number]) => number === phone,
  )?.[0];
}

function reactionTarget(messageId: string): {
  guid: string;
  partIndex?: number;
} {
  const child = messageId.match(CHILD_MESSAGE_ID);
  if (!child) return { guid: messageId };
  return {
    guid: child[2]!,
    partIndex: Number(child[1]),
  };
}

export interface FastReactionSender {
  react(
    spaceId: string,
    messageId: string,
    emoji: string,
  ): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Warm the token/client as soon as routing identifies a line. Constructing an
 * HTTP client performs no send; tier checks still gate the `react` call.
 */
export async function createFastReactionSender(
  phone: string,
): Promise<FastReactionSender | undefined> {
  // Eval runs record sends through the SpectrumSender seam instead; no
  // fast-path tokens exist there, so the caller falls back to sender.react.
  if (env.evalSpectrumRecordUrl()) return undefined;
  const tokenData = await issueTokenData();
  let address =
    process.env["SPECTRUM_IMESSAGE_ADDRESS"] ?? DEFAULT_IMESSAGE_ADDRESS;
  let token: string;
  if (tokenData.type === "shared") {
    token = tokenData.token;
  } else {
    const server = dedicatedInstanceForPhone(tokenData, phone);
    if (!server) return undefined;
    const dedicatedToken = tokenData.auth[server];
    if (!dedicatedToken) return undefined;
    token = dedicatedToken;
    address = `${server}.imsg.photon.codes:443`;
  }
  const client = createGrpcClient({
    address,
    autoIdempotency: true,
    retry: true,
    tls: true,
    token,
  });
  return {
    react: async (spaceId, messageId, emoji) => {
      const target = reactionTarget(messageId);
      await client.messages.setReaction(
        spaceId,
        target.guid,
        { kind: "emoji", emoji },
        true,
        target.partIndex === undefined
          ? undefined
          : { partIndex: target.partIndex },
      );
      return true;
    },
    close: () => client.close(),
  };
}
