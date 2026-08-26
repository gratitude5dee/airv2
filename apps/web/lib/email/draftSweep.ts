/**
 * Draft-review backstop (C10 hardening): the box is instructed to file every
 * AgentMail draft for review, but an agent that forgets leaves a composed
 * email invisible to Needs-you. This sweep closes that hole structurally —
 * it lists recent drafts in each recently-active user's owned inboxes and
 * files an email_draft decision for any draft no decision row has ever
 * covered. It only ever adds a review; it can never send.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDrafts } from "../agentmail/client";
import { queueEmailDraftReview } from "./review";

/** Only users whose box was active recently are swept, bounding API calls. */
const ACTIVE_WINDOW_MS = 30 * 60_000;
/** Grace period so the box's own review call wins the race, avoiding dupes. */
const MIN_DRAFT_AGE_MS = 5 * 60_000;
/** Drafts older than this are stale leftovers, not fresh unfiled work. */
const MAX_DRAFT_AGE_MS = 48 * 3600_000;
/** Per-sweep filing cap: the sweep runs every minute, so it catches up. */
const MAX_FILINGS_PER_SWEEP = 10;

interface InboxOwner {
  userId: string;
  inboxId: string;
}

async function recentInboxes(
  supabase: SupabaseClient,
  now: Date
): Promise<InboxOwner[]> {
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS).toISOString();
  const { data: boxes } = await supabase
    .from("boxes")
    .select("user_id")
    .gte("last_active_at", activeSince);
  const userIds = [
    ...new Set(
      (boxes ?? [])
        .map((box) => box.user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  if (userIds.length === 0) return [];
  const { data: addresses } = await supabase
    .from("agent_addresses")
    .select("user_id, agentmail_inbox_id")
    .in("user_id", userIds)
    .is("retired_at", null);
  return (addresses ?? [])
    .filter(
      (address): address is { user_id: string; agentmail_inbox_id: string } =>
        typeof address.user_id === "string" &&
        typeof address.agentmail_inbox_id === "string" &&
        address.agentmail_inbox_id.length > 0
    )
    .map((address) => ({
      userId: address.user_id,
      inboxId: address.agentmail_inbox_id,
    }));
}

// A draft without a parseable timestamp is skipped: acting on it would
// bypass both the grace period (racing the box's own filing) and the
// staleness cap. The next sweep retries, so nothing is lost.
function inSweepWindow(updatedAt: string | undefined, now: Date): boolean {
  if (!updatedAt) return false;
  const stamp = Date.parse(updatedAt);
  if (Number.isNaN(stamp)) return false;
  const age = now.getTime() - stamp;
  return age >= MIN_DRAFT_AGE_MS && age <= MAX_DRAFT_AGE_MS;
}

export async function sweepUnfiledDrafts(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<number> {
  const inboxes = await recentInboxes(supabase, now);
  let filed = 0;
  for (const { userId, inboxId } of inboxes) {
    if (filed >= MAX_FILINGS_PER_SWEEP) break;
    let drafts;
    try {
      drafts = await listDrafts(inboxId);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "draft sweep list failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      continue;
    }
    const candidates = drafts.filter((draft) =>
      inSweepWindow(draft.updated_at, now)
    );
    if (candidates.length === 0) continue;
    // Any decision row for the draft — pending, approved, or dismissed —
    // means the owner has already seen (or resolved) it; never re-file.
    const { data: existing } = await supabase
      .from("decisions")
      .select("ref")
      .eq("user_id", userId)
      .eq("kind", "email_draft")
      .in(
        "ref",
        candidates.map((draft) => draft.draft_id)
      );
    const covered = new Set(
      (existing ?? [])
        .map((row) => row.ref)
        .filter((ref): ref is string => typeof ref === "string")
    );
    for (const draft of candidates) {
      if (filed >= MAX_FILINGS_PER_SWEEP) break;
      if (covered.has(draft.draft_id)) continue;
      const to =
        Array.isArray(draft.to) && typeof draft.to[0] === "string"
          ? draft.to[0]
          : undefined;
      try {
        await queueEmailDraftReview(supabase, userId, {
          draftId: draft.draft_id,
          ...(to !== undefined ? { to } : {}),
          ...(draft.subject !== undefined ? { subject: draft.subject } : {}),
        });
        filed += 1;
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "draft sweep filing failed",
            user_id: userId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    }
  }
  return filed;
}
