/**
 * Mini-app cards on iMessage (M7.5). The signed URL is minted inside the
 * `app()` thunk so no live URL is ever stored (C15); cards render live and
 * are edited in place on update.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { UnsupportedError } from "spectrum-ts";
import { env } from "../env";
import {
  createSpectrumSender,
  type SpectrumSender,
} from "../spectrum/sender";
import {
  deleteMiniAppCardSession,
  parseMiniAppCardSession,
  readMiniAppCardSession,
  upsertMiniAppCardSession,
} from "./cardSessions";
import type { MiniAppCardSession } from "./cardSessions";
import type { CardKind } from "./cardSends";
import { mintToken } from "./tokens";

/** Card links stay tappable for a day — cards linger in the transcript. */
export const CARD_LINK_TTL_MINUTES = 24 * 60;

export function mintSignedLink(
  userId: string,
  appSlug: string,
  resourceId: string
): string {
  // Apps live at mini.wzrd.tech/<slug> (MA0); legacy /mini/<slug> 301s there.
  return `${env.miniappOrigin()}/${appSlug}?t=${mintToken(userId, appSlug, resourceId, CARD_LINK_TTL_MINUTES)}`;
}

export async function sendMiniAppCard(
  supabase: SupabaseClient,
  spaceId: string,
  phone: string,
  userId: string,
  appSlug: CardKind,
  resourceId: string
): Promise<void> {
  const sender = await createSpectrumSender();
  try {
    const message = await sender.sendApp(spaceId, phone, () =>
      mintSignedLink(userId, appSlug, resourceId)
    );
    const session = parseMiniAppCardSession(
      message && "miniAppCardSession" in message
        ? message.miniAppCardSession
        : undefined
    );
    if (session) {
      try {
        await upsertMiniAppCardSession(
          supabase,
          userId,
          appSlug,
          resourceId,
          spaceId,
          session
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "mini-app card session persistence failed",
            user_id: userId,
            kind: appSlug,
            resource_id: resourceId,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
      }
    }
  } finally {
    // Best-effort: a teardown failure after a successful send must not
    // surface as a delivery failure (callers may retry on error).
    await sender.close().catch(() => undefined);
  }
}

/**
 * Refresh an existing card without claiming a new notification slot. A
 * missing or invalid session is not a new notification, so this never sends
 * a replacement card.
 */
export async function updateMiniAppCard(
  supabase: SupabaseClient,
  userId: string,
  appSlug: CardKind,
  resourceId: string
): Promise<void> {
  let destination:
    | { space_id?: unknown; phone?: unknown }
    | null
    | undefined;
  let destinationError: { message: string } | null = null;
  try {
    const result = await supabase
      .from("imessage_destinations")
      .select("space_id, phone")
      .eq("user_id", userId)
      .maybeSingle();
    destination = result.data;
    destinationError = result.error;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "mini-app card destination lookup failed",
        user_id: userId,
        kind: appSlug,
        resource_id: resourceId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return;
  }
  if (destinationError || !destination?.space_id || !destination.phone) return;
  const spaceId = String(destination.space_id);
  const phone = String(destination.phone);

  let session: MiniAppCardSession | undefined;
  try {
    session = await readMiniAppCardSession(
      supabase,
      userId,
      appSlug,
      resourceId
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "mini-app card session lookup failed",
        user_id: userId,
        kind: appSlug,
        resource_id: resourceId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }

  if (!session) {
    return;
  }

  let sender: SpectrumSender;
  try {
    sender = await createSpectrumSender();
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "mini-app card sender creation failed",
        user_id: userId,
        kind: appSlug,
        resource_id: resourceId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return;
  }
  try {
    const refreshed = await sender.editApp(spaceId, phone, session, () =>
      mintSignedLink(userId, appSlug, resourceId)
    );
    if (!refreshed) {
      await deleteMiniAppCardSession(
        supabase,
        userId,
        appSlug,
        resourceId
      ).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            msg: "mini-app card session deletion failed",
            user_id: userId,
            kind: appSlug,
            resource_id: resourceId,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
      });
      return;
    }
    try {
      await upsertMiniAppCardSession(
        supabase,
        userId,
        appSlug,
        resourceId,
        spaceId,
        refreshed
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "mini-app card session persistence failed",
          user_id: userId,
          kind: appSlug,
          resource_id: resourceId,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
    }
  } catch (error) {
    if (error instanceof UnsupportedError) {
      await deleteMiniAppCardSession(
        supabase,
        userId,
        appSlug,
        resourceId
      ).catch((deleteError: unknown) => {
        console.error(
          JSON.stringify({
            msg: "mini-app card session deletion failed",
            user_id: userId,
            kind: appSlug,
            resource_id: resourceId,
            error: deleteError instanceof Error ? deleteError.message : "unknown",
          })
        );
      });
    } else {
      console.error(
        JSON.stringify({
          msg: "mini-app card update failed",
          user_id: userId,
          kind: appSlug,
          resource_id: resourceId,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
    }
  } finally {
    await sender.close().catch(() => undefined);
  }
}
