import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { cardLayout, mintSignedLink, persistCardSession } from "./cards";
import { isCardKind } from "./cardSends";
import { getRegistryApp } from "./registry";

const ALIASES: Readonly<Record<string, string>> = {
  "image-editor": "image",
  "video-editor": "video",
  "to-do": "todo",
  people: "crm",
  secrets: "vault",
  storefront: "shop",
  tasks: "todo",
};

/** Sent instead of a card when a non-owner sender would have received one. */
export const OWNER_ONLY_CARD_LINE = "only the owner can open mini-apps.";

export class MiniAppRegistryLookupError extends Error {
  override name = "MiniAppRegistryLookupError";
}

export function parseMiniAppCommand(input: string): string | null {
  const match = /^\/([a-z0-9][a-z0-9_-]{0,63})$/i.exec(input.trim());
  if (!match?.[1]) return null;
  const requested = match[1].toLowerCase();
  return ALIASES[requested] ?? requested;
}

export async function maybeSendMiniAppLink(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: {
    spaceId: string;
    userId: string;
    phone: string;
    senderTier: number | null;
  },
  input: string
): Promise<boolean> {
  const slug = parseMiniAppCommand(input);
  if (!slug) return false;

  let app;
  try {
    app = await getRegistryApp(supabase, slug);
  } catch (error) {
    throw new MiniAppRegistryLookupError(
      error instanceof Error ? error.message : "mini-app registry lookup failed"
    );
  }
  if (!app || app.status !== "published") return false;
  if (job.senderTier !== 0) {
    await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE);
    return true;
  }

  // Full mini-app card (same bubble as agent-initiated cards): tapping it
  // opens the full-screen mini-app sheet. A bare richlink renders as a flat
  // "Tap to Load Preview" bubble, so it is only the fallback path.
  try {
    const message = await sender.sendApp(
      job.spaceId,
      job.phone,
      () => mintSignedLink(job.userId, app.slug, "default", "card"),
      cardLayout(app.slug)
    );
    if (isCardKind(app.slug)) {
      await persistCardSession(
        supabase,
        job.userId,
        app.slug,
        "default",
        job.spaceId,
        message
      );
    }
  } catch {
    const url = mintSignedLink(job.userId, app.slug, "default", "card");
    try {
      await sender.sendRichLink(job.spaceId, job.phone, url);
    } catch {
      await sender.sendText(job.spaceId, job.phone, url);
    }
  }
  return true;
}
