/**
 * Public profile metadata for /@username. Read-only from the public page;
 * rows hold user-published identity metadata only (bio, links, handles) —
 * never box internals or agent memory.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileLink {
  label: string;
  url: string;
}

export interface PublicProfile {
  bio: string | null;
  links: ProfileLink[];
  instagram: string | null;
  tiktok: string | null;
}

const HANDLE_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

function normalizeLinks(raw: unknown): ProfileLink[] {
  if (!Array.isArray(raw)) return [];
  const links: ProfileLink[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { label, url } = entry as { label?: unknown; url?: unknown };
    if (typeof label !== "string" || typeof url !== "string") continue;
    // Only https destinations ever render on the public page.
    if (!/^https:\/\//i.test(url)) continue;
    links.push({ label: label.slice(0, 80), url });
  }
  return links.slice(0, 20);
}

const normalizeHandle = (raw: unknown): string | null =>
  typeof raw === "string" && HANDLE_PATTERN.test(raw.replace(/^@/, ""))
    ? raw.replace(/^@/, "")
    : null;

export async function getPublicProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PublicProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("bio, links, instagram, tiktok")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    bio: typeof data.bio === "string" ? data.bio.slice(0, 500) : null,
    links: normalizeLinks(data.links),
    instagram: normalizeHandle(data.instagram),
    tiktok: normalizeHandle(data.tiktok),
  };
}
