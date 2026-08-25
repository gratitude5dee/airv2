/**
 * CM4 publish worker: due slots → one wake per user (coalesced, CM4 task 2's
 * reasoning applied to machine starts) → resolve package → mint deliveries
 * (CM2) → validate → publish (CM3) → verdicts. external_id is written
 * before the slot is marked done (CC7); reauth/fix-content park the slot
 * behind a "Needs you" decision; retry backs off invisibly with capped
 * attempts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchPackage,
  ingestAsset,
  mintDelivery,
  revokeDeliveries,
  type CreativeAsset,
} from "@/lib/assets/pipeline";
import {
  armStopAfter,
  ensureBoxAwake,
  type UserBox,
} from "@/lib/orchestrator/boxes";
import type { Draft, DraftKind, DraftMedia } from "./adapter";
import { PublishError } from "./adapter";
import { makePublishCtx } from "./context";
import { adapterFor } from "./registry";
import {
  capHeadroom,
  claimSlot,
  CLAIM_TTL_MS,
  parseContentSlot,
  SLOT_COLUMNS,
  type ContentSlot,
} from "./slots";
import {
  MAX_RETRY_ATTEMPTS,
  raiseVerdictDecision,
  retryDelaySeconds,
  verdictFor,
} from "./verdict";

/** All of a user's slots due inside this window ride one wake — a machine
 * start is the limit that actually binds (ARCHITECTURE §6.2), so it is one
 * start per user per window, never one per post. */
export const COALESCE_WINDOW_MS = 10 * 60 * 1000;

const VIDEO_EXTS = new Set(["mp4", "mov"]);

const PLATFORM_TOOLKIT: Record<string, string> = {
  instagram: "instagram",
  facebook: "facebook",
  x: "twitter",
  youtube: "youtube",
  tiktok: "tiktok",
};

export interface PublishSweepResult {
  usersWoken: number;
  published: number;
  parked: number;
  deferred: number;
  retried: number;
}

/** Fire everything due: due slots plus, for each user already being woken,
 * anything inside the coalesce window. */
export async function publishDueSlots(
  supabase: SupabaseClient
): Promise<PublishSweepResult> {
  // CM8 kill switch: halt scheduled publishing within one sweep without
  // touching a single slot — flipping back resumes the calendar as-is.
  if (process.env["PUBLISH_KILL_SWITCH"] === "1") {
    return { usersWoken: 0, published: 0, parked: 0, deferred: 0, retried: 0 };
  }
  const nowIso = new Date().toISOString();
  const staleClaim = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const [due, stale] = await Promise.all([
    supabase
      .from("content_slots")
      .select(SLOT_COLUMNS)
      .eq("status", "scheduled")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(100),
    // Claims left by dead invocations: resume them (publish_state carries
    // the checkpoint — an Instagram container id resumes, never re-creates).
    supabase
      .from("content_slots")
      .select(SLOT_COLUMNS)
      .eq("status", "publishing")
      .lt("claimed_at", staleClaim)
      .limit(20),
  ]);
  const dueSlots = (due.data ?? [])
    .map(parseContentSlot)
    .filter((slot): slot is ContentSlot => slot !== null);
  const staleSlots = (stale.data ?? [])
    .map(parseContentSlot)
    .filter((slot): slot is ContentSlot => slot !== null);

  const byUser = new Map<string, ContentSlot[]>();
  for (const slot of [...dueSlots, ...staleSlots]) {
    const slots = byUser.get(slot.user_id) ?? [];
    slots.push(slot);
    byUser.set(slot.user_id, slots);
  }
  if (byUser.size === 0) {
    return { usersWoken: 0, published: 0, parked: 0, deferred: 0, retried: 0 };
  }

  // Per-user kill switch: paused users' slots are skipped, not modified.
  const { data: paused } = await supabase
    .from("users")
    .select("id")
    .in("id", [...byUser.keys()])
    .eq("publish_paused", true);
  for (const row of paused ?? []) {
    if (typeof row.id === "string") byUser.delete(row.id);
  }
  if (byUser.size === 0) {
    return { usersWoken: 0, published: 0, parked: 0, deferred: 0, retried: 0 };
  }

  // Coalesce: a user we are waking anyway also serves slots due soon.
  const horizon = new Date(Date.now() + COALESCE_WINDOW_MS).toISOString();
  const upcoming = await supabase
    .from("content_slots")
    .select(SLOT_COLUMNS)
    .eq("status", "scheduled")
    .gt("scheduled_at", nowIso)
    .lte("scheduled_at", horizon)
    .in("user_id", [...byUser.keys()])
    .limit(100);
  for (const value of upcoming.data ?? []) {
    const slot = parseContentSlot(value);
    if (!slot) continue;
    const slots = byUser.get(slot.user_id);
    if (slots && !slots.some((existing) => existing.id === slot.id)) {
      slots.push(slot);
    }
  }

  const result: PublishSweepResult = {
    usersWoken: 0,
    published: 0,
    parked: 0,
    deferred: 0,
    retried: 0,
  };
  for (const [userId, slots] of byUser) {
    // ensureBoxAwake nulls stop_after before it can fail, and the sweeper
    // only stops boxes with a past deadline — re-arm on every exit so a
    // failed wake or publish can't leave the box running forever.
    try {
      let box: UserBox;
      try {
        box = await ensureBoxAwake(supabase, userId);
        result.usersWoken += 1;
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "publish sweep wake failed",
            user_id: userId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        continue; // slots stay scheduled; next sweep retries the wake
      }
      for (const slot of slots) {
        const outcome = await publishSlot(supabase, box, slot).catch(
          (error) => {
            console.error(
              JSON.stringify({
                msg: "publish slot crashed",
                slot_id: slot.id,
                user_id: userId,
                error: error instanceof Error ? error.message : String(error),
              })
            );
            return "skipped" as const;
          }
        );
        if (outcome === "published") result.published += 1;
        else if (outcome === "parked") result.parked += 1;
        else if (outcome === "deferred") result.deferred += 1;
        else if (outcome === "retried") result.retried += 1;
      }
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }
  return result;
}

export type SlotOutcome =
  | "published"
  | "parked"
  | "deferred"
  | "retried"
  | "skipped";

/**
 * Publish one slot end-to-end. "Publish now" and "publish at 09:00" run
 * exactly this path (CM4 task 8).
 */
export async function publishSlot(
  supabase: SupabaseClient,
  box: UserBox,
  slot: ContentSlot
): Promise<SlotOutcome> {
  const adapter = adapterFor(slot.platform);
  if (!adapter) {
    await park(supabase, slot, "fix-content", "This platform isn't available.");
    return "parked";
  }

  // CC8: enforce the cap before the call; defer with a visible next window.
  const headroom = await capHeadroom(
    supabase,
    slot.user_id,
    slot.platform,
    slot.account_ref,
    adapter.limits.dailyCap
  );
  if (!headroom.allowed) {
    // Restores 'scheduled' so a reclaimed stale claim stops matching the
    // stale-claim query — no repeated wakes while the cap holds.
    await supabase
      .from("content_slots")
      .update({
        status: "scheduled",
        claimed_at: null,
        scheduled_at: headroom.nextWindow,
        last_verdict: "deferred",
        error_message: `Behind today's ${slot.platform} limit (${headroom.cap}/24h) — next window ${headroom.nextWindow}.`,
      })
      .eq("id", slot.id)
      .eq("attempt_epoch", slot.attempt_epoch);
    return "deferred";
  }

  const claimed = await claimSlot(supabase, slot);
  if (!claimed) return "skipped"; // another invocation owns it

  // A resumed claim that already carries the platform's id was published —
  // the invocation died between the external_id write and the done mark.
  // Finalize instead of posting again.
  if (claimed.external_id) {
    const finalized = await finalizeAsPublished(supabase, slot.id);
    return finalized ? "published" : "skipped";
  }

  const connection = await supabase
    .from("connections")
    .select("status, external_account_id")
    .eq("user_id", slot.user_id)
    .eq("toolkit", PLATFORM_TOOLKIT[slot.platform] ?? slot.platform)
    .maybeSingle();
  if (connection.data?.status !== "active") {
    await park(
      supabase,
      claimed,
      "reauth",
      `Your ${slot.platform} account isn't connected — reconnect to publish.`
    );
    return "parked";
  }

  let draft: Draft;
  let assets: CreativeAsset[];
  try {
    ({ draft, assets } = await resolveDraft(supabase, box, claimed));
  } catch (error) {
    // Resolution failure is usually transient infrastructure, but a
    // permanently missing package would otherwise wake the box forever —
    // same capped policy as adapter retries.
    if (claimed.attempt + 1 >= MAX_RETRY_ATTEMPTS) {
      await park(
        supabase,
        claimed,
        "fix-content",
        `Couldn't load this post's content after ${MAX_RETRY_ATTEMPTS} attempts.`
      );
      return "parked";
    }
    await backOff(
      supabase,
      claimed,
      retryDelaySeconds(claimed.attempt, 5 * 60),
      error instanceof Error ? error.message : String(error)
    );
    return "retried";
  }

  const problems = adapter.validate(draft);
  if (problems.length > 0) {
    await park(
      supabase,
      claimed,
      "fix-content",
      problems.map((problem) => problem.message).join(" ")
    );
    return "parked";
  }

  const ctx = makePublishCtx({
    userId: slot.user_id,
    accountRef: slot.account_ref,
    ...(typeof connection.data.external_account_id === "string"
      ? { connectedAccountId: connection.data.external_account_id }
      : {}),
    state: { ...claimed.publish_state },
    persistState: async (state) => {
      await supabase
        .from("content_slots")
        .update({ publish_state: state })
        .eq("id", slot.id);
    },
  });

  try {
    const published = await adapter.publish(ctx, draft);
    // CC7: the platform's id lands before the slot is marked done.
    const idWrite = await supabase
      .from("content_slots")
      .update({
        external_id: published.externalId,
        permalink: published.permalink ?? null,
      })
      .eq("id", slot.id);
    if (idWrite.error) {
      throw new Error(`external_id write failed: ${idWrite.error.message}`);
    }
    if (!(await finalizeAsPublished(supabase, slot.id))) {
      // Left 'publishing' with external_id set: the stale-claim resume
      // finalizes it without re-posting.
      return "skipped";
    }
    // Publish confirmed: the delivery capability has served its purpose.
    for (const asset of assets) {
      await revokeDeliveries(supabase, slot.user_id, asset.id).catch(
        () => undefined
      );
    }
    return "published";
  } catch (error) {
    const verdict = verdictFor(adapter, error);
    if (verdict.kind === "retry") {
      if (claimed.attempt + 1 >= MAX_RETRY_ATTEMPTS) {
        await park(
          supabase,
          claimed,
          "fix-content",
          `Publishing kept failing after ${MAX_RETRY_ATTEMPTS} attempts.`
        );
        return "parked";
      }
      await backOff(
        supabase,
        claimed,
        retryDelaySeconds(claimed.attempt, verdict.after),
        error instanceof PublishError ? error.message : String(error)
      );
      return "retried";
    }
    await park(supabase, claimed, verdict.kind, verdict.message);
    return "parked";
  }
}

/** Mark a slot done. Returns false when the write fails — the row stays
 * 'publishing' with its external_id, and the resume path finalizes it. */
async function finalizeAsPublished(
  supabase: SupabaseClient,
  slotId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("content_slots")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      last_verdict: null,
      error_message: null,
      publish_state: {},
    })
    .eq("id", slotId);
  if (error) {
    console.error(
      JSON.stringify({
        msg: "slot finalize failed",
        slot_id: slotId,
        error: error.message,
      })
    );
    return false;
  }
  return true;
}

async function resolveDraft(
  supabase: SupabaseClient,
  box: UserBox,
  slot: ContentSlot
): Promise<{ draft: Draft; assets: CreativeAsset[] }> {
  const pkg = await fetchPackage(supabase, box, slot.package_ref);
  const assets: CreativeAsset[] = [];
  const media: DraftMedia[] = [];
  for (const boxAssetId of pkg.media_asset_ids) {
    const asset = await ingestAsset(supabase, slot.user_id, box, boxAssetId);
    const delivery = await mintDelivery(supabase, asset, `slot:${slot.id}`);
    assets.push(asset);
    media.push({
      url: delivery.url,
      kind: VIDEO_EXTS.has(asset.ext) ? "video" : "image",
    });
  }
  const settings = (pkg.platform_settings[slot.platform] ?? {}) as {
    kind?: string;
    title?: string;
    link?: string;
  };
  const hashtags = pkg.hashtags.map((tag) => `#${tag}`).join(" ");
  const caption = [pkg.caption ?? "", hashtags]
    .filter((part) => part.length > 0)
    .join("\n\n");
  return {
    draft: {
      caption,
      media,
      ...(isDraftKind(settings.kind) ? { kind: settings.kind } : {}),
      ...(typeof settings.title === "string" ? { title: settings.title } : {}),
      ...(typeof settings.link === "string" ? { link: settings.link } : {}),
    },
    assets,
  };
}

function isDraftKind(value: string | undefined): value is DraftKind {
  return value === "feed" || value === "story" || value === "reel";
}

async function park(
  supabase: SupabaseClient,
  slot: ContentSlot,
  kind: "reauth" | "fix-content",
  message: string
): Promise<void> {
  await supabase
    .from("content_slots")
    .update({
      status: "parked",
      last_verdict: kind,
      error_message: message.slice(0, 500),
    })
    .eq("id", slot.id);
  await raiseVerdictDecision(
    supabase,
    slot.user_id,
    slot.platform,
    { kind, message },
    slot.id
  ).catch((error) => {
    console.error(
      JSON.stringify({
        msg: "decision raise failed",
        slot_id: slot.id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  });
}

async function backOff(
  supabase: SupabaseClient,
  slot: ContentSlot,
  afterSeconds: number,
  message: string
): Promise<void> {
  await supabase
    .from("content_slots")
    .update({
      status: "scheduled",
      scheduled_at: new Date(Date.now() + afterSeconds * 1000).toISOString(),
      attempt: slot.attempt + 1,
      last_verdict: "retry",
      error_message: message.slice(0, 500),
    })
    .eq("id", slot.id);
}
