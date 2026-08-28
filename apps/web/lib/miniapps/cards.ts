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
import type { Message } from "spectrum-ts";

/** Card links stay tappable for a day — cards linger in the transcript. */
export const CARD_LINK_TTL_MINUTES = 24 * 60;

/**
 * Inline mini-UI: the card bubble is a static layout preview (never
 * `live` — see lib/spectrum/sender.ts), so the bubble itself is the
 * mini-UI and tapping it expands into the full-screen mini-app. Per-kind
 * copy makes the bubble informative instead of a bare "Tap to open".
 */
const CARD_COPY: Partial<Record<string, { name: string; line: string }>> = {
  home: { name: "Home", line: "Every app, one tap away" },
  onboarding: { name: "Onboarding", line: "Set up your agent" },
  calendar: { name: "Calendar", line: "Your schedule" },
  todo: { name: "To-Do", line: "Your tasks" },
  kanban: { name: "Kanban", line: "Your board" },
  inbox: { name: "Inbox", line: "Your agent's email" },
  vault: { name: "Vault", line: "Keys & logins" },
  connect: { name: "Connect", line: "Link your accounts" },
  pay: { name: "Pay", line: "Money & payments" },
  shop: { name: "Shop", line: "Your storefront" },
  crm: { name: "CRM", line: "People & follow-ups" },
  analytics: { name: "Analytics", line: "Your numbers" },
  ads: { name: "Ads", line: "Campaigns" },
  video: { name: "Video", line: "Video studio" },
  image: { name: "Image", line: "Image studio" },
  computer: { name: "Computer", line: "Your agent's screen" },
  browser: { name: "Browser", line: "Your agent's browser" },
  settings: { name: "Settings", line: "Preferences" },
  persona: { name: "Persona", line: "A living map of your context" },
  feedback: { name: "Feedback", line: "Report a bug or ask for a feature" },
};

export function cardLayout(appSlug: string): {
  caption: string;
  subcaption: string;
  trailingCaption: string;
  trailingSubcaption: string;
  summary: string;
} {
  const copy = CARD_COPY[appSlug] ?? {
    name: appSlug.charAt(0).toUpperCase() + appSlug.slice(1),
    line: "Your mini-app",
  };
  return {
    caption: copy.name,
    subcaption: copy.line,
    trailingCaption: "WZRD",
    trailingSubcaption: "Tap to open",
    summary: `${copy.name} — ${copy.line}`,
  };
}

/**
 * `via` marks the surface the link opens in: `"card"` for a Messages webview
 * (lite renders — no camera, no video), undefined for a real browser window.
 * Links minted for /home's launcher must not claim the card surface.
 */
export function mintSignedLink(
  userId: string,
  appSlug: string,
  resourceId: string,
  via?: "card" | undefined
): string {
  // Apps live at mini.wzrd.tech/<slug> (MA0); legacy /mini/<slug> 301s there.
  return `${env.miniappOrigin()}/${appSlug}?t=${mintToken(userId, appSlug, resourceId, CARD_LINK_TTL_MINUTES, { via })}`;
}

/** Per-send copy override so a card bubble can carry its occasion (e.g. a
 * payment approval) — value-free metadata only, same rules as CARD_COPY. */
export interface CardLayoutOverride {
  caption?: string;
  subcaption?: string;
  summary?: string;
}

export async function sendMiniAppCard(
  supabase: SupabaseClient,
  spaceId: string,
  phone: string,
  userId: string,
  appSlug: CardKind,
  resourceId: string,
  layout?: CardLayoutOverride
): Promise<void> {
  const sender = await createSpectrumSender();
  try {
    const message = await sender.sendApp(
      spaceId,
      phone,
      () => mintSignedLink(userId, appSlug, resourceId, "card"),
      { ...cardLayout(appSlug), ...layout }
    );
    await persistCardSession(
      supabase,
      userId,
      appSlug,
      resourceId,
      spaceId,
      message
    );
  } finally {
    // Best-effort: a teardown failure after a successful send must not
    // surface as a delivery failure (callers may retry on error).
    await sender.close().catch(() => undefined);
  }
}

/** Persist the card session returned by a send so later updates can edit
 * the same bubble in place. Best-effort: persistence failures are logged
 * and never surface as delivery failures. */
export async function persistCardSession(
  supabase: SupabaseClient,
  userId: string,
  appSlug: CardKind,
  resourceId: string,
  spaceId: string,
  message: Message | undefined
): Promise<void> {
  const session = parseMiniAppCardSession(
    message && "miniAppCardSession" in message
      ? message.miniAppCardSession
      : undefined
  );
  if (!session) return;
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
    const refreshed = await sender.editApp(
      spaceId,
      phone,
      session,
      () => mintSignedLink(userId, appSlug, resourceId, "card"),
      cardLayout(appSlug)
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
