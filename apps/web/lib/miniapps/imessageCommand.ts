import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { cardLayout, mintSignedLink, persistCardSession } from "./cards";
import { isCardKind } from "./cardSends";
import { getRegistryApp } from "./registry";
import { env } from "../env";

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

/**
 * A public GitHub repository URL at the head of a `/create` prompt
 * (V12 §8.1): `https://github.com/<owner>/<repo>[/tree/<branch>]`, optionally
 * followed by a trailing slash. The match must end at whitespace or the end
 * of the text so a URL glued to prose is not split in half.
 */
const GITHUB_URL_RE =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/tree\/([^\s/]+(?:\/[^\s/]+)*))?\/?(?=\s|$)/;

/**
 * V12 §8.1 `/create <text>`: the text may span lines. A bare `/create` (no
 * text) returns null so the existing card path (`parseMiniAppCommand`)
 * keeps opening the Create surface. A leading GitHub URL is lifted into
 * `url`; whatever follows it is the prompt (possibly empty).
 */
export function parseCreateCommand(
  input: string
): { prompt: string; url: string | null } | null {
  const match = /^\/create\s+([\s\S]+)$/i.exec(input.trim());
  const text = match?.[1]?.trim() ?? "";
  if (!text) return null;
  const url = GITHUB_URL_RE.exec(text);
  if (!url) return { prompt: text, url: null };
  return {
    prompt: text.slice(url[0].length).trim(),
    url: url[0].replace(/\/$/, ""),
  };
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

  // V11 §5.2 `/create`: the Create surface is a store page, not a registry
  // app — owner-only like every card, no cooldown (the owner asked for it).
  if (slug === "create") {
    if (job.senderTier !== 0) {
      await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE);
      return true;
    }
    await sendCard(supabase, sender, job, "create");
    return true;
  }

  let app;
  try {
    app = await getRegistryApp(supabase, slug);
  } catch (error) {
    throw new MiniAppRegistryLookupError(
      error instanceof Error ? error.message : "mini-app registry lookup failed"
    );
  }
  if (!app || app.status !== "published") return false;
  // The registry row is shipped ahead of activation so migration order cannot
  // make the connector unavailable. Do not issue a signed Muse card until its
  // control-plane feature flag is on.
  if (app.slug === "muse" && !env.museEnabled()) return false;
  if (job.senderTier !== 0) {
    await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE);
    return true;
  }

  await sendCard(supabase, sender, job, app.slug);
  return true;
}

/**
 * Full mini-app card (same bubble as agent-initiated cards): tapping it
 * opens the full-screen mini-app sheet. A bare richlink renders as a flat
 * "Tap to Load Preview" bubble, so it is only the fallback path.
 */
async function sendCard(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: { spaceId: string; userId: string; phone: string },
  slug: string
): Promise<void> {
  try {
    const message = await sender.sendApp(
      job.spaceId,
      job.phone,
      () => mintSignedLink(job.userId, slug, "default", "card"),
      cardLayout(slug)
    );
    if (isCardKind(slug)) {
      await persistCardSession(
        supabase,
        job.userId,
        slug,
        "default",
        job.spaceId,
        message
      );
    }
  } catch {
    const url = mintSignedLink(job.userId, slug, "default", "card");
    try {
      await sender.sendRichLink(job.spaceId, job.phone, url);
    } catch {
      await sender.sendText(job.spaceId, job.phone, url);
    }
  }
}
