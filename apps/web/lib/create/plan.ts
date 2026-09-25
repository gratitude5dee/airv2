/**
 * V12 §5.3 plan delivery. The Planner writes `plan.md` (and `plan.v<n>.md`)
 * into the owner's Box under `~/.hermes/create/<appname>/`; the Box then asks
 * the control plane to attach it to the owner's iMessage thread. The bytes
 * are read from the Box for that one send, capped at 64 KiB, handed to
 * Spectrum and dropped — never logged, never stored (CR21). When the
 * attachment send throws, the owner gets the plan's first 12 lines as text
 * plus the Create-surface card, whose Plan pane shows the full file.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { loadTarget, readComputeFile } from "../compute/runtime";
import { sendMarkedCards } from "../miniapps/cards";
import { WORKSPACE_ROOT } from "./build";
import { safeArchivePath } from "./kit";
import { log } from "../log";

/** §14.1: a plan attachment is at most this many bytes. */
export const PLAN_MAX_BYTES = 64 * 1024;
/** §5.3: the text fallback carries this many leading lines. */
export const PLAN_FALLBACK_LINES = 12;
/** Plan deliveries per owner per hour (`plan` ops kind). */
export const PLAN_DELIVERIES_PER_HOUR = 60;

export class PlanError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlanError";
    this.status = status;
  }
}

const APPNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/**
 * Resolve the Box path of a plan file. Accepts a workspace-relative path
 * (`plan.md`, `plan.v2.md`, `intake/plan.md`) or the same path spelled from
 * `~/.hermes/create/<appname>/`, `$HOME/…` or an absolute home directory;
 * anything that leaves the workspace or is not a `.md` file is refused.
 */
export function planFilePath(appname: string, rawPath: string): string {
  if (!APPNAME_RE.test(appname)) throw new PlanError("invalid appname");
  if (typeof rawPath !== "string" || rawPath.length === 0 || rawPath.length > 512) {
    throw new PlanError("invalid path");
  }
  const workspace = `${WORKSPACE_ROOT}/${appname}/`;
  const slashed = rawPath.replace(/\\/g, "/");
  let relative: string;
  const at = slashed.indexOf(workspace);
  if (at >= 0) {
    const head = slashed.slice(0, at);
    if (!/^(?:~\/|\$HOME\/|\/(?:[^/\s]+\/)*|)$/.test(head)) throw new PlanError("invalid path");
    relative = slashed.slice(at + workspace.length);
  } else if (slashed.startsWith("/") || slashed.startsWith("~") || slashed.startsWith("$")) {
    throw new PlanError("path must be inside the app workspace");
  } else {
    relative = slashed;
  }
  const safe = relative.endsWith("/") ? null : safeArchivePath(relative);
  if (!safe || !/\.md$/i.test(safe) || safe.split("/").some((segment) => segment.startsWith("."))) {
    throw new PlanError("path must be a .md file inside the app workspace");
  }
  return `${workspace}${safe}`;
}

/** The first `lines` lines of the plan, for the text fallback. */
export function planSummary(text: string, lines: number = PLAN_FALLBACK_LINES): string {
  return text.split(/\r?\n/).slice(0, lines).join("\n").trim();
}

/** The owner's iMessage thread (tier-0 destination); null when none is known. */
export async function ownerThread(
  supabase: SupabaseClient,
  userId: string
): Promise<{ spaceId: string; phone: string } | null> {
  const { data, error } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new PlanError("could not look up the owner's thread; try again", 503);
  const row = data as { space_id?: unknown; phone?: unknown } | null;
  if (!row || typeof row.space_id !== "string" || typeof row.phone !== "string") return null;
  return { spaceId: row.space_id, phone: row.phone };
}

export interface PlanDelivery {
  delivered: "attachment" | "text";
  bytes: number;
}

/**
 * Read `path` from the owner's Box and attach it to their thread as
 * `<appname>-plan.md` (text/markdown); on an attachment failure, send the
 * first 12 lines and the `[card: create]` card instead. The bytes live only
 * in this call frame.
 */
export async function deliverPlan(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  userId: string,
  input: { appname: string; path: string }
): Promise<PlanDelivery> {
  const boxPath = planFilePath(input.appname, input.path);
  const thread = await ownerThread(supabase, userId);
  if (!thread) throw new PlanError("the owner has no iMessage thread yet", 409);

  await ensureBoxAwake(supabase, userId);
  let bytes: Buffer;
  let text: string;
  try {
    const target = await loadTarget(supabase, userId);
    text = await readComputeFile(target, boxPath);
    bytes = Buffer.from(text, "utf8");
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  if (bytes.length === 0) throw new PlanError("the plan file is empty", 422);
  if (bytes.length > PLAN_MAX_BYTES) throw new PlanError("plan is larger than 64 KiB", 413);

  try {
    await sender.sendAttachment(thread.spaceId, thread.phone, bytes, {
      name: `${input.appname}-plan.md`,
      mimeType: "text/markdown",
    });
    return { delivered: "attachment", bytes: bytes.length };
  } catch (error) {
    log.error("plan attachment failed; falling back to text", {user_id: userId,
        appname: input.appname,
        bytes: bytes.length,
        error: error instanceof Error ? error.message : "unknown",});
  }
  await sender.sendText(thread.spaceId, thread.phone, planSummary(text));
  await sendMarkedCards(
    supabase,
    { userId, spaceId: thread.spaceId, phone: thread.phone },
    ["create"]
  ).catch(() => 0);
  return { delivered: "text", bytes: bytes.length };
}
