import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { mintSignedLink } from "./cards";
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
    await sender.sendText(
      job.spaceId,
      job.phone,
      "only the owner can open mini-apps."
    );
    return true;
  }

  const url = mintSignedLink(job.userId, app.slug, "default");
  try {
    await sender.sendRichLink(job.spaceId, job.phone, url);
  } catch {
    await sender.sendText(job.spaceId, job.phone, url);
  }
  return true;
}
