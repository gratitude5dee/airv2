/**
 * M16 iMessage creative lane. Runs inside the flush orchestrator after trust
 * gating and before any box wake: tier-2 senders never reach the flush at
 * all (the inbound webhook records a decision and returns before enqueue),
 * so a burst arriving here is already tier-0/1. An explicit /imagine,
 * /animate, or /zap consumes the settled burst — text plus attachments —
 * without waking the box; ordinary prose falls through to Hermes unchanged.
 *
 * Delivery is native attachment bytes first, then the caption; a rich-link
 * or bare-URL fallback uses only the short-TTL signed delivery URL — a
 * provider URL is never sent (C3/C4).
 *
 * Outbound sends stay best-effort — a dead Spectrum connection must not
 * abort a job whose asset is already stored — but every failed send is
 * logged, and a turn where nothing at all reached the chat is logged as
 * `creative delivery silent`: total silence on the user's side is otherwise
 * indistinguishable from success in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSETS_BUCKET } from "../assets/keys";
import type { SpectrumSender } from "../spectrum/sender";
import type { MediaInput } from "./gmi";
import { createCreativeJob } from "./jobs";
import {
  AMBIGUOUS_COMMAND_LINE,
  parseExplicitGenerationCommand,
} from "./parse";
import { deterministicGenerationLines } from "./router";
import { executeCreativeJob } from "./run";
import { removeStagedInputs, stageCreativeInput } from "./store";

const ATTACHMENT_MARKER = /\[attachment:([^\]]+)\]/g;

/**
 * Best-effort send that reports whether the bubble actually left. Failures
 * are swallowed for control flow but never for observability.
 */
async function trySend(
  stage: string,
  job: CreativeFlushJob,
  send: () => Promise<unknown>
): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "creative delivery send failed",
        stage,
        user_id: job.userId,
        space_id: job.spaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return false;
  }
}

export interface CreativeFlushJob {
  spaceId: string;
  userId: string;
  phone: string;
}

/**
 * Handle the burst if it carries an explicit creative command. Returns true
 * when the lane consumed the burst (the caller must not run Hermes).
 */
export async function maybeRunCreativeLane(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: CreativeFlushJob,
  rawInput: string
): Promise<boolean> {
  // Strip debounce framing so the parser sees only the user's words.
  const attachmentIds: string[] = [];
  const text = rawInput
    .split("\n")
    .map((line) => line.replace(/^\[Earlier message\] /, ""))
    .join("\n")
    .replace(ATTACHMENT_MARKER, (_, ids: string) => {
      attachmentIds.push(...ids.split(",").filter(Boolean));
      return " ";
    });

  const command = parseExplicitGenerationCommand(text);
  if (!command) {
    return false;
  }
  if ("ambiguous" in command) {
    // Deterministic rejection — no model or provider call happens.
    await sender.sendText(job.spaceId, job.phone, AMBIGUOUS_COMMAND_LINE);
    return true;
  }

  // Stage inbound attachments as short-lived signed provider inputs.
  const mediaInputs: MediaInput[] = [];
  const stagedKeys: string[] = [];
  for (const id of attachmentIds) {
    const fetched = await sender
      .getAttachment(id, job.phone)
      .catch(() => undefined);
    if (!fetched) continue;
    const staged = await stageCreativeInput(
      supabase,
      job.userId,
      fetched.data,
      fetched.mimeType
    );
    if (staged) {
      mediaInputs.push({
        url: staged.url,
        kind: staged.kind,
        mimeType: staged.mimeType,
      });
      stagedKeys.push(staged.storageKey);
    }
  }

  const ack = deterministicGenerationLines(command.mode, mediaInputs);
  const ackSent = await trySend("ack", job, () =>
    sender.sendText(job.spaceId, job.phone, ack.chat_reply)
  );

  const creativeJob = await createCreativeJob(
    supabase,
    job.userId,
    "imessage",
    command.mode
  );
  let result: Awaited<ReturnType<typeof executeCreativeJob>>;
  try {
    result = await executeCreativeJob(supabase, creativeJob.id, job.userId, {
      mode: command.mode,
      cleanedText: command.cleanedText,
      text,
      mediaInputs,
    });
  } finally {
    // Staged inputs are single-use provider references; reclaim them now.
    await removeStagedInputs(supabase, stagedKeys);
  }

  if (result.status !== "delivered" || !result.asset) {
    await sender.sendText(job.spaceId, job.phone, result.line);
    return true;
  }

  // Native bytes first: re-read our own stored master, never provider bytes.
  let sent = false;
  const download = await supabase.storage
    .from(ASSETS_BUCKET)
    .download(result.asset.storage_key);
  if (!download.error && download.data) {
    const bytes = Buffer.from(await download.data.arrayBuffer());
    const name = `wzrd-${result.asset.sha256.slice(0, 8)}.${result.asset.ext}`;
    const mimeType = downloadMime(result.asset.ext);
    sent = await trySend("attachment", job, () =>
      sender.sendAttachment(job.spaceId, job.phone, bytes, { name, mimeType })
    );
  } else {
    console.error(
      JSON.stringify({
        msg: "creative delivery send failed",
        stage: "asset_download",
        user_id: job.userId,
        space_id: job.spaceId,
        error: download.error?.message ?? "empty asset download",
      })
    );
  }
  if (!sent && result.deliveryUrl) {
    // Fallbacks carry only the short-TTL signed delivery URL.
    const deliveryUrl = result.deliveryUrl;
    sent = await trySend("rich_link", job, () =>
      sender.sendRichLink(job.spaceId, job.phone, deliveryUrl)
    );
    if (!sent) {
      sent = await trySend("delivery_url", job, () =>
        sender.sendText(job.spaceId, job.phone, deliveryUrl)
      );
    }
  }
  const caption = sent
    ? (result.deliveryLine ?? "made this for you")
    : "made it, but couldn't send it here. check the app.";
  const captionSent = await trySend("caption", job, () =>
    sender.sendText(job.spaceId, job.phone, caption)
  );
  if (!ackSent && !sent && !captionSent) {
    // The job is `delivered` in the database and the chat saw nothing.
    console.error(
      JSON.stringify({
        msg: "creative delivery silent",
        user_id: job.userId,
        space_id: job.spaceId,
        job_id: creativeJob.id,
        mode: command.mode,
      })
    );
  }
  return true;
}

const downloadMime = (ext: string): string =>
  ({
    gif: "image/gif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    mov: "video/quicktime",
    mp4: "video/mp4",
    png: "image/png",
    webp: "image/webp",
  })[ext] ?? "application/octet-stream";
