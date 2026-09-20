/**
 * The /twin command (onboarding.md §3.2, §11): act *as* a digital twin.
 *
 *   /twin                         → a card into the twin builder + status
 *   /twin @name                   → status of that twin (if you may use it)
 *   /twin [@name] say <script>    → talking video: cloned voice + lip-sync
 *   /twin [@name] <image brief>   → identity-consistent image
 *
 * Grammar is a discriminated union (the lib/trade/parse.ts shape); the
 * iMessage lane copies lib/miniapps/drawCommand.ts (runs inside the flush
 * orchestrator before the creative lane, consumes the burst) and delivers
 * through the creative lane's own delivery helper; the web lane lives in
 * app/api/chat/route.ts and returns a creative_job_id the chat follows over
 * SSE. Voice is owner-only: `@name say …` for someone else's twin is refused
 * by the resolver before any provider call.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeChannel } from "../creative/jobs";
import { deliverCreativeResult, type CreativeFlushJob } from "../creative/imessage";
import { mintSignedLink } from "../miniapps/cards";
import { OWNER_ONLY_CARD_LINE } from "../miniapps/imessageCommand";
import type { SpectrumSender } from "../spectrum/sender";
import { USERNAME_PATTERN } from "../settings/account";
import { resolveIdentityReference } from "./resolve";
import {
  createTwinImage,
  createTwinSpeechVideo,
  describeTwin,
  type TwinJobOptions,
  type TwinJobResult,
} from "./twin";

const TWIN_COMMAND = /^\/twin(?![A-Za-z0-9_-])(?:\s+([\s\S]*))?$/i;
const ATTACHMENT_MARKER = /\[attachment:([^\]]+)\]/g;
const HANDLE_FIRST = /^@([a-z0-9_]{2,24})(?![A-Za-z0-9_-])[,:]?\s*/i;
const SAY_VERB = /^(?:say|speak)\b[:,]?\s*/i;

export type TwinCommand =
  | { kind: "card" }
  | { kind: "status"; handle: string }
  | { kind: "speak"; handle: string | null; script: string }
  | { kind: "image"; handle: string | null; prompt: string };

export const TWIN_HELP_LINE =
  "try: /twin say Welcome to AirV2 · /twin a portrait in soft morning light · /twin @name for their twin's status.";
export const TWIN_SYNTHETIC_LINE = (username: string): string =>
  `synthetic voice and video of @${username} — say so when you share it.`;

/** Parse the typed text (attachment markers already stripped). */
export function parseTwinCommand(text: string): TwinCommand | null {
  const match = TWIN_COMMAND.exec(text.trim());
  if (!match) return null;
  let rest = (match[1] ?? "").trim();
  let handle: string | null = null;
  const lead = HANDLE_FIRST.exec(rest);
  if (lead?.[1]) {
    handle = lead[1].toLowerCase();
    rest = rest.slice(lead[0].length).trim();
  }
  if (!rest) {
    return handle ? { kind: "status", handle } : { kind: "card" };
  }
  const say = SAY_VERB.exec(rest);
  if (say) {
    const script = rest.slice(say[0].length).trim().replace(/^["“]|["”]$/g, "");
    if (!script) return { kind: "card" };
    return { kind: "speak", handle, script };
  }
  return { kind: "image", handle, prompt: rest };
}

/** The typed text with attachment markers removed. */
export function twinCommandText(rawInput: string): string {
  return rawInput
    .split("\n")
    .map((line) => line.replace(/^\[Earlier message\] /, ""))
    .join("\n")
    .replace(ATTACHMENT_MARKER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TwinFlushJob extends CreativeFlushJob {
  senderTier: number | null;
}

/** A signed link into the twin builder (the onboarding Photo Booth slide). */
export function twinBuilderLink(userId: string, via?: "card"): string {
  return `${mintSignedLink(userId, "onboarding", "default", via)}&step=consent`;
}

/**
 * Run a speak/image command for the caller. A named handle must resolve to
 * a twin the caller may use for that purpose; speech is always the
 * caller's own twin.
 */
export async function runTwinCommand(
  supabase: SupabaseClient,
  userId: string,
  command: Extract<TwinCommand, { kind: "speak" | "image" }>,
  opts: TwinJobOptions
): Promise<TwinJobResult | { ok: false; status: "refused"; line: string; jobId: null }> {
  if (command.handle) {
    const purpose = command.kind === "speak" ? "speech" : "image";
    const resolved = await resolveIdentityReference(
      supabase,
      userId,
      command.handle,
      purpose
    );
    if (!resolved.ok) {
      return { ok: false, status: "refused", line: resolved.line, jobId: null };
    }
    if (!resolved.twin.isOwner) {
      // Another user's public twin: only image references are shareable,
      // and those flow through /zap or /imagine with an @mention.
      return {
        ok: false,
        status: "refused",
        line: `use /zap or /imagine with @${resolved.twin.username} for a public twin — /twin acts as your own.`,
        jobId: null,
      };
    }
  }
  return command.kind === "speak"
    ? await createTwinSpeechVideo(supabase, userId, { ...opts, script: command.script })
    : await createTwinImage(supabase, userId, { ...opts, prompt: command.prompt });
}

/** One written line describing a twin the caller may look at. */
export async function twinStatusLine(
  supabase: SupabaseClient,
  userId: string,
  handle: string
): Promise<string> {
  const resolved = await resolveIdentityReference(supabase, userId, handle, "image");
  if (!resolved.ok) return resolved.line;
  return describeTwin(
    resolved.twin.username,
    resolved.twin.isOwner ? resolved.twin.twin : null,
    resolved.twin.profileImage !== null
  );
}

/** The caller's own username, for the bare `/twin` status line. */
async function ownUsername(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (data as { username?: unknown } | null)?.username;
  return typeof username === "string" && USERNAME_PATTERN.test(username)
    ? username
    : null;
}

/**
 * Handle the burst when it starts with /twin. Returns true when the lane
 * consumed it — the caller must not run Hermes or the generic card path.
 */
export async function maybeRunTwinLane(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: TwinFlushJob,
  rawInput: string
): Promise<boolean> {
  const command = parseTwinCommand(twinCommandText(rawInput));
  if (!command) return false;
  if (job.senderTier !== 0) {
    await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE);
    return true;
  }
  if (command.kind === "card") {
    const username = await ownUsername(supabase, job.userId);
    const status = username
      ? await twinStatusLine(supabase, job.userId, username)
      : "pick a username first — your twin is bound to your @name.";
    await sender.sendText(
      job.spaceId,
      job.phone,
      `${status}\n${TWIN_HELP_LINE}\nbuild or update it here: ${twinBuilderLink(job.userId, "card")}`
    );
    return true;
  }
  if (command.kind === "status") {
    await sender.sendText(
      job.spaceId,
      job.phone,
      await twinStatusLine(supabase, job.userId, command.handle)
    );
    return true;
  }
  const channel: CreativeChannel = "imessage";
  const result = await runTwinCommand(supabase, job.userId, command, { channel });
  if (!result.ok || !result.jobId) {
    await sender.sendText(job.spaceId, job.phone, result.line);
    return true;
  }
  const username = (await ownUsername(supabase, job.userId)) ?? "you";
  await deliverCreativeResult(
    supabase,
    sender,
    job,
    {
      status: result.status,
      line: result.line,
      ...(result.asset ? { asset: result.asset } : {}),
      ...(result.deliveryUrl ? { deliveryUrl: result.deliveryUrl } : {}),
      deliveryLine:
        command.kind === "speak"
          ? `here is your twin — ${TWIN_SYNTHETIC_LINE(username)}`
          : "here is your twin",
    },
    result.jobId,
    "twin"
  );
  return true;
}
