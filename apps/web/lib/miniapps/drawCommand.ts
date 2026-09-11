/**
 * /draw iMessage lane. Runs inside the flush orchestrator before the generic
 * mini-app card path and before the creative lane: a bare `/draw` opens the
 * studio card; `/draw <prompt> [image]` also auto-starts the first
 * generation off the same session. The burst — text plus attachments — is
 * consumed here; ordinary prose falls through to Hermes unchanged.
 *
 * The card goes out first; the generation runs after the send returns so a
 * slow render never delays the link. Registry lookup failures throw
 * MiniAppRegistryLookupError like the card path, so the caller requeues the
 * burst instead of eating it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestUploadedMedia } from "../creative/store";
import type { SpectrumSender } from "../spectrum/sender";
import {
  cardLayout,
  mintSignedLink,
  persistCardSession,
} from "./cards";
import {
  admitDrawGeneration,
  createDrawSession,
  DEFAULT_DRAW_MODE,
  isDrawMode,
  runDrawJob,
  type DrawMode,
} from "./draw";
import {
  MiniAppRegistryLookupError,
  OWNER_ONLY_CARD_LINE,
} from "./imessageCommand";
import { getRegistryApp } from "./registry";

// sketch/paint are draw aliases — they can't live in imessageCommand's
// ALIASES map because that path has no draw session to bind the card to.
const DRAW_COMMAND = /^\/(?:draw|sketch|paint)(?:\s+(.*))?$/is;
const ATTACHMENT_MARKER = /\[attachment:([^\]]+)\]/g;

export interface DrawFlushJob {
  spaceId: string;
  userId: string;
  phone: string;
  senderTier: number | null;
}

/**
 * Handle the burst when it starts with /draw. Returns true when the lane
 * consumed it — the caller must not run Hermes or the generic card path.
 */
export async function maybeRunDrawLane(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: DrawFlushJob,
  rawInput: string
): Promise<boolean> {
  // The burst composes media markers before the text ("[attachment:x]\n
  // /draw fox" — a photo sent first, or a captioned share). Extract ids
  // from the raw input, then match the command on text alone.
  const attachmentIds: string[] = [];
  for (const marker of rawInput.matchAll(ATTACHMENT_MARKER)) {
    attachmentIds.push(...(marker[1] ?? "").split(",").filter(Boolean));
  }
  const match = DRAW_COMMAND.exec(
    rawInput.replace(ATTACHMENT_MARKER, " ").trim()
  );
  if (!match) return false;

  const rest = (match[1] ?? "").trim();
  // An optional mode word comes first: "/draw hq a fox" or "/draw a fox".
  const words = rest.split(/\s+/).filter(Boolean);
  const first = (words[0] ?? "").toLowerCase();
  const mode: DrawMode = isDrawMode(first)
    ? (words.shift(), first as DrawMode)
    : DEFAULT_DRAW_MODE;

  const prompt = words.join(" ").trim();

  const app = await getRegistryApp(supabase, "draw").catch((error: unknown) => {
    throw new MiniAppRegistryLookupError(
      error instanceof Error ? error.message : "mini-app registry lookup failed"
    );
  });
  if (!app || app.status !== "published") return false;

  if (job.senderTier !== 0) {
    await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE);
    return true;
  }

  // First image attachment becomes the session's initial asset (photo-to-
  // image); later attachments in the same burst are ignored for now.
  let initialAssetId: string | undefined;
  for (const id of attachmentIds) {
    const fetched = await sender.getAttachment(id, job.phone).catch(() => undefined);
    if (!fetched || !fetched.mimeType.startsWith("image/")) continue;
    const asset = await ingestUploadedMedia(
      supabase,
      job.userId,
      fetched.data,
      fetched.mimeType
    ).catch(() => undefined);
    if (asset) {
      initialAssetId = asset.id;
      break;
    }
  }

  const session = await createDrawSession(supabase, {
    userId: job.userId,
    spaceId: job.spaceId,
    phone: job.phone,
    ...(initialAssetId ? { initialAssetId } : {}),
  });

  // Card first: the link must land even if the generation below fails.
  try {
    const message = await sender.sendApp(job.spaceId, job.phone, () =>
      mintSignedLink(job.userId, "draw", session.id, "card")
    , cardLayout("draw"));
    await persistCardSession(
      supabase,
      job.userId,
      "draw",
      session.id,
      job.spaceId,
      message
    );
  } catch {
    const url = mintSignedLink(job.userId, "draw", session.id, "card");
    try {
      await sender.sendRichLink(job.spaceId, job.phone, url);
    } catch {
      await sender.sendText(job.spaceId, job.phone, url);
    }
  }

  if (prompt || initialAssetId) {
    // Auto-start (plan §4.3): a prompt or an attached image admits the first
    // job on the spot; a bare /draw leaves a clean canvas.
    const text =
      prompt ||
      "Turn this photo into something worth keeping — polish it into a finished image.";
    try {
      const creativeJob = await admitDrawGeneration(supabase, session, {
        prompt: text,
        mode,
        channel: "imessage",
        ...(initialAssetId ? { inputAssetId: initialAssetId } : {}),
      });
      const result = await runDrawJob(supabase, session, creativeJob, text);
      if (result.status !== "delivered") {
        await sender
          .sendText(job.spaceId, job.phone, result.line)
          .catch(() => undefined);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "draw auto-start failed",
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
