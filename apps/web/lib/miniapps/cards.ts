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
import {
  claimCardSend,
  isCardKind,
  type CardClaim,
  type CardKind,
} from "./cardSends";
import { nestedPathFor } from "./nested";
import { getRegistryApp } from "./registry";
import { STORE_APP } from "./storeSession";
import { mintToken } from "./tokens";
import { warmStatusMirror } from "./onboardingMirror";
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
  create: { name: "Create", line: "Build a mini-app" },
  app: { name: "Your app", line: "Draft — preview & publish" },
};

/**
 * V11 §13.5: the Create kinds open the owner's Create surface (a store page,
 * not a mini-app), so their links are store handoffs that land on /create —
 * with the app preselected for an `app` card. Only the owner's store
 * session can render either page (CR13).
 */
const STORE_PAGE_KINDS: ReadonlySet<string> = new Set(["create", "app"]);

export function createSurfacePath(kind: string, resourceId: string): string {
  return kind === "app" && resourceId !== "default"
    ? `/create?app=${encodeURIComponent(resourceId)}`
    : "/create";
}

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
  if (STORE_PAGE_KINDS.has(appSlug)) {
    const next = createSurfacePath(appSlug, resourceId);
    return `${env.miniappOrigin()}/api/mini/session?t=${mintToken(userId, STORE_APP, "store", CARD_LINK_TTL_MINUTES, { via })}&next=${encodeURIComponent(next)}`;
  }
  // First-party apps live at mini.wzrd.tech/<slug> (MA0), published apps at
  // /<username>/<appname> (V11); legacy /mini/<slug> and flat slugs 301 there.
  return `${env.miniappOrigin()}${nestedPathFor(appSlug)}?t=${mintToken(userId, appSlug, resourceId, CARD_LINK_TTL_MINUTES, { via })}`;
}

/** Per-send copy override so a card bubble can carry its occasion (e.g. a
 * payment approval) — value-free metadata only, same rules as CARD_COPY. */
export interface CardLayoutOverride {
  caption?: string;
  subcaption?: string;
  summary?: string;
}

/**
 * Bubble copy for an `app` card: the owner's app name and where it stands.
 * Never a URL or a version's contents — the same value-free rule as
 * CARD_COPY. Unknown/foreign apps fall back to the generic kind copy.
 */
export async function appCardLayout(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<CardLayoutOverride> {
  const app = await getRegistryApp(supabase, slug).catch(() => null);
  if (!app || app.owner_user_id !== userId) return {};
  const line =
    app.status === "published"
      ? app.draft_version && app.draft_version !== app.bundle_version
        ? "Live — new draft staged"
        : "Live"
      : "Draft — preview & publish";
  return { caption: app.name, subcaption: line, summary: `${app.name} — ${line}` };
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
      {
        ...cardLayout(appSlug),
        ...(appSlug === "app" ? await appCardLayout(supabase, userId, resourceId) : {}),
        ...layout,
      }
    );
    await persistCardSession(
      supabase,
      userId,
      appSlug,
      resourceId,
      spaceId,
      message
    );
    // The onboarding card is usually opened within seconds of arriving, and
    // a cold mirror makes that first open pay for five Box reads. Warm it
    // now, off the send path.
    if (appSlug === "onboarding") warmStatusMirror(supabase, userId);
  } finally {
    // Best-effort: a teardown failure after a successful send must not
    // surface as a delivery failure (callers may retry on error).
    await sender.close().catch(() => undefined);
  }
}

/** Most cards one reply may fan out (the onboarding tour sends a few). */
const MAX_MARKED_CARDS = 4;

/** `[card: app <slug>]` carries a resource; every other marker is bare. */
export function parseCardMarker(
  marker: string
): { kind: CardKind; resourceId: string } | null {
  const [kind = "", resource] = marker.trim().toLowerCase().split(/\s+/, 2);
  if (!isCardKind(kind)) return null;
  if (kind === "app") {
    if (!resource || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(resource)) return null;
    return { kind, resourceId: resource };
  }
  return { kind, resourceId: "default" };
}

/**
 * An `app` card is one bubble per app: when the owner already has one for
 * this slug, refresh it in place instead of claiming a new send (V11 §13.5
 * "cards update in place"). A bubble the line no longer knows (its session
 * was dropped) is gone for good, so that case falls through to a fresh send
 * under the usual claim; a delivery failure surfaces as a thrown error, the
 * same as a failed send.
 */
export async function sendOrUpdateAppCard(
  supabase: SupabaseClient,
  owner: { userId: string; spaceId: string; phone: string },
  slug: string
): Promise<"updated" | "sent" | "cooldown"> {
  const existing = await readMiniAppCardSession(
    supabase,
    owner.userId,
    "app",
    slug
  ).catch(() => undefined);
  if (existing) {
    const outcome = await updateMiniAppCard(supabase, owner.userId, "app", slug);
    if (outcome === "updated") return "updated";
    if (outcome === "failed") throw new Error("app card update failed");
  }
  const claim = await claimCardSend(supabase, owner.userId, "app");
  if (!claim) return "cooldown";
  try {
    await sendMiniAppCard(supabase, owner.spaceId, owner.phone, owner.userId, "app", slug);
  } catch (error) {
    await claim.release().catch(() => undefined);
    throw error;
  }
  return "sent";
}

/**
 * Deliver the `[card: <kind>]` markers stripped from an agent reply, in
 * order, to the owner's thread. Same contract as POST /api/cards/<kind>:
 * unknown kinds are ignored, each kind is rate limited by claimCardSend
 * (a kind still in cooldown is skipped, never retried), and one failed send
 * never blocks the rest or the turn. Returns how many cards went out.
 */
export async function sendMarkedCards(
  supabase: SupabaseClient,
  owner: { userId: string; spaceId: string; phone: string },
  kinds: readonly string[]
): Promise<number> {
  let sent = 0;
  for (const marker of kinds.slice(0, MAX_MARKED_CARDS)) {
    const parsed = parseCardMarker(marker);
    if (!parsed) continue;
    const { kind, resourceId } = parsed;
    let claim: CardClaim | undefined;
    try {
      if (kind === "app") {
        if ((await sendOrUpdateAppCard(supabase, owner, resourceId)) === "cooldown") continue;
      } else {
        claim = await claimCardSend(supabase, owner.userId, kind);
        if (!claim) continue;
        await sendMiniAppCard(
          supabase,
          owner.spaceId,
          owner.phone,
          owner.userId,
          kind,
          resourceId
        );
      }
      sent += 1;
      console.log(
        JSON.stringify({ msg: "card sent", kind, user_id: owner.userId, via: "marker" })
      );
    } catch (error) {
      await claim?.release().catch(() => undefined);
      console.error(
        JSON.stringify({
          msg: "card send failed",
          kind,
          user_id: owner.userId,
          via: "marker",
          error: error instanceof Error ? error.message : "unknown error",
        })
      );
    }
  }
  return sent;
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
 * Outcome of an in-place card refresh: `stale` means there is no bubble to
 * edit any more (no session, or the line rejected the stored one and it was
 * dropped); `failed` means the bubble may still exist but this edit did not
 * reach it.
 */
export type CardUpdateOutcome = "updated" | "stale" | "failed";

/**
 * Refresh an existing card without claiming a new notification slot. A
 * missing or invalid session is not a new notification, so this never sends
 * a replacement card; callers decide what a `stale` outcome means for them.
 */
export async function updateMiniAppCard(
  supabase: SupabaseClient,
  userId: string,
  appSlug: CardKind,
  resourceId: string
): Promise<CardUpdateOutcome> {
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
    return "failed";
  }
  if (destinationError || !destination?.space_id || !destination.phone) return "failed";
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
    return "failed";
  }

  if (!session) {
    return "stale";
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
    return "failed";
  }
  try {
    const refreshed = await sender.editApp(
      spaceId,
      phone,
      session,
      () => mintSignedLink(userId, appSlug, resourceId, "card"),
      {
        ...cardLayout(appSlug),
        ...(appSlug === "app" ? await appCardLayout(supabase, userId, resourceId) : {}),
      }
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
      return "stale";
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
    return "updated";
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
      return "stale";
    }
    console.error(
      JSON.stringify({
        msg: "mini-app card update failed",
        user_id: userId,
        kind: appSlug,
        resource_id: resourceId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return "failed";
  } finally {
    await sender.close().catch(() => undefined);
  }
}
