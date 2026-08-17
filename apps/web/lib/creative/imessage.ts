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
  await sender
    .sendText(job.spaceId, job.phone, ack.chat_reply)
    .catch(() => undefined);

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
    sent = await sender
      .sendAttachment(job.spaceId, job.phone, bytes, {
        name,
        mimeType: downloadMime(result.asset.ext),
      })
      .then(() => true)
      .catch(() => false);
  }
  if (!sent && result.deliveryUrl) {
    // Fallbacks carry only the short-TTL signed delivery URL.
    sent = await sender
      .sendRichLink(job.spaceId, job.phone, result.deliveryUrl)
      .then(() => true)
      .catch(() => false);
    if (!sent) {
      sent = await sender
        .sendText(job.spaceId, job.phone, result.deliveryUrl)
        .then(() => true)
        .catch(() => false);
    }
  }
  const caption = sent
    ? (result.deliveryLine ?? "made this for you")
    : "made it, but couldn't send it here. check the app.";
  await sender.sendText(job.spaceId, job.phone, caption).catch(() => undefined);
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
