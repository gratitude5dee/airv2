/**
 * /freeze iMessage lane. Runs inside the flush orchestrator right after the
 * /draw lane and before the generic mini-app card path: a bare `/freeze`
 * opens the studio card; `/freeze` with a photo seeds the session's source
 * still (iPhone HEIC converted to PNG at ingest); `/freeze <prompt>` runs
 * the sketch lane to generate the source. The burst — text plus
 * attachments — is consumed here; ordinary prose falls through to Hermes.
 *
 * The card goes out first; any generation runs after the send returns so a
 * slow render never delays the link. Registry lookup failures throw
 * MiniAppRegistryLookupError like the card path, so the caller requeues
 * the burst instead of eating it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import {
  cardLayout,
  mintSignedLink,
  persistCardSession,
} from "./cards";
import {
  createFreezeSession,
  runFreezeSketch,
  storeFreezeUpload,
} from "./freeze";
import {
  MiniAppRegistryLookupError,
  OWNER_ONLY_CARD_LINE,
} from "./imessageCommand";
import { getRegistryApp } from "./registry";

const FREEZE_COMMAND = /^\/freeze(?:\s+(.*))?$/is;
const ATTACHMENT_MARKER = /\[attachment:([^\]]+)\]/g;

export interface FreezeFlushJob {
  spaceId: string;
  userId: string;
  phone: string;
  senderTier: number | null;
}

/**
 * Handle the burst when it starts with /freeze. Returns true when the lane
 * consumed it — the caller must not run Hermes or the generic card path.
 */
export async function maybeRunFreezeLane(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: FreezeFlushJob,
  rawInput: string
): Promise<boolean> {
  // Media markers compose before the text, same shape as the draw lane.
  const attachmentIds: string[] = [];
  for (const marker of rawInput.matchAll(ATTACHMENT_MARKER)) {
    attachmentIds.push(...(marker[1] ?? "").split(",").filter(Boolean));
  }
  const match = FREEZE_COMMAND.exec(
    rawInput.replace(ATTACHMENT_MARKER, " ").trim()
  );
  if (!match) return false;

  const prompt = (match[1] ?? "").trim();

  const app = await getRegistryApp(supabase, "freeze").catch(
    (error: unknown) => {
      throw new MiniAppRegistryLookupError(
        error instanceof Error
          ? error.message
          : "mini-app registry lookup failed"
      );
    }
  );
  if (!app || app.status !== "published") return false;

  if (job.senderTier !== 0) {
    await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE);
    return true;
  }

  // First image attachment becomes the session's source still. HEIC goes
  // through the PNG decode — the source still is what the camera orbit
  // renders around, so it takes the lossless lane rather than JPEG.
  let sourceAssetId: string | undefined;
  for (const id of attachmentIds) {
    const fetched = await sender
      .getAttachment(id, job.phone)
      .catch(() => undefined);
    // storeFreezeUpload owns the whole contract: HEIC sniff + PNG convert
    // (octet-stream mislabels included), media guard, type allowlist.
    if (!fetched) continue;
    const asset = await storeFreezeUpload(
      supabase,
      job.userId,
      fetched.data,
      fetched.mimeType
    ).catch(() => undefined);
    if (asset) {
      sourceAssetId = asset.id;
      break;
    }
  }

  const session = await createFreezeSession(supabase, {
    userId: job.userId,
    spaceId: job.spaceId,
    phone: job.phone,
    ...(sourceAssetId ? { sourceAssetId } : {}),
  });

  // Card first: the link must land even if the generation below fails.
  try {
    const message = await sender.sendApp(job.spaceId, job.phone, () =>
      mintSignedLink(job.userId, "freeze", session.id, "card")
    , cardLayout("freeze"));
    await persistCardSession(
      supabase,
      job.userId,
      "freeze",
      session.id,
      job.spaceId,
      message
    );
  } catch {
    const url = mintSignedLink(job.userId, "freeze", session.id, "card");
    try {
      await sender.sendRichLink(job.spaceId, job.phone, url);
    } catch {
      await sender.sendText(job.spaceId, job.phone, url);
    }
  }

  // "/freeze <prompt>" without a photo generates the source still through
  // the sketch lane (Flare fast) — the studio opens on the camera stage
  // with the delivered image already in place.
  if (prompt && !sourceAssetId) {
    try {
      const { result } = await runFreezeSketch(supabase, session, {
        prompt,
        mode: "fast",
        channel: "imessage",
      });
      if (result.status !== "delivered") {
        await sender
          .sendText(job.spaceId, job.phone, result.line)
          .catch(() => undefined);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "freeze sketch auto-start failed",
          user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      await sender
        .sendText(
          job.spaceId,
          job.phone,
          "couldn't start that render — open the card and try there."
        )
        .catch(() => undefined);
    }
  }
  return true;
}
