/**
 * The @username identity resolver (onboarding.md §3.1, §11). Turns a handle
 * typed inside /zap, /imagine, /animate or /twin into the authorized twin
 * profile and the reference assets the caller may use for that purpose:
 *
 *   @username → users.id → digital_twins (sharing, voice/avatar state)
 *             → identity_assets filtered by caller + purpose
 *             → short-TTL signed URLs minted here, at job time
 *
 * Authorization is decided here, server-side, once per turn:
 *   owner            every approved asset; voice only ever for the owner
 *   other + public   profile image + character sheet, image/video only
 *   other + private  indistinguishable from an unknown name
 * A resolved reference is injected into the creative turn as an ordinary
 * image input ("Image N") and the mention in the prompt becomes "the person
 * in Image N" — a private URL never appears in client-visible text, and the
 * job records which assets it used (identity_reference_uses).
 *
 * The handle grammar ([a-z0-9_]{2,24}) is disjoint from bot names
 * (hyphens), and the creative lanes run before bot-mention delegation in
 * both dispatchers, so a twin mention never reaches lib/bots/mentions.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaInput } from "../creative/gmi";
import type { CreativeCommandTurn } from "../creative/router";
import { USERNAME_PATTERN } from "../settings/account";
import {
  listIdentityAssets,
  signedIdentityUrl,
  type IdentityAssetView,
  type IdentityRole,
} from "./assets";
import { getDigitalTwin, type DigitalTwin } from "./twinRow";
import type { ReferenceUseRow } from "./twin";

/** A standalone @handle: not part of an email, a path or another word. */
const MENTION = /(^|[^A-Za-z0-9_@/.])@([a-z0-9_]{2,24})(?![A-Za-z0-9_-])/gi;

/** Unique handles in order of appearance, lowercased. */
export function parseIdentityMentions(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(MENTION)) {
    const handle = (match[2] ?? "").toLowerCase();
    if (USERNAME_PATTERN.test(handle) && !found.includes(handle)) {
      found.push(handle);
    }
  }
  return found;
}

export type ReferencePurpose = "image" | "video" | "speech";

export interface ResolvedTwin {
  userId: string;
  username: string;
  isOwner: boolean;
  twin: DigitalTwin | null;
  /** Owner-only derived contact sheet of their selected source photos. */
  referenceSheet: IdentityAssetView | null;
  profileImage: IdentityAssetView | null;
  characterSheet: IdentityAssetView | null;
  alternates: IdentityAssetView[];
  selfies: IdentityAssetView[];
  referenceVideos: IdentityAssetView[];
  voiceReady: boolean;
}

export type ResolveFailure = "not_found" | "forbidden" | "incomplete";

export type ResolveResult =
  | { ok: true; twin: ResolvedTwin }
  | { ok: false; reason: ResolveFailure; line: string };

export const unknownTwinLine = (handle: string): string =>
  `@${handle} isn't a twin you can use.`;
export const incompleteTwinLine = (handle: string): string =>
  `@${handle} has no approved profile image yet — finish the Photo Booth in onboarding.`;

const ready = (entries: IdentityAssetView[], role: IdentityRole): IdentityAssetView[] =>
  entries.filter((entry) => entry.role === role && entry.status === "ready");

/**
 * Resolve one handle for the caller. `purpose` narrows what counts as
 * usable: image/video need at least one approved image; speech needs the
 * owner's ready voice clone as well.
 */
export async function resolveIdentityReference(
  supabase: SupabaseClient,
  callerUserId: string,
  rawHandle: string,
  purpose: ReferencePurpose
): Promise<ResolveResult> {
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();
  if (!USERNAME_PATTERN.test(handle)) {
    return { ok: false, reason: "not_found", line: unknownTwinLine(handle) };
  }
  const { data: user } = await supabase
    .from("users")
    .select("id, username, status")
    .eq("username", handle)
    .maybeSingle();
  const owner = user as { id?: unknown; username?: unknown; status?: unknown } | null;
  if (!owner || typeof owner.id !== "string") {
    return { ok: false, reason: "not_found", line: unknownTwinLine(handle) };
  }
  const isOwner = owner.id === callerUserId;
  if (!isOwner && owner.status !== "active") {
    return { ok: false, reason: "not_found", line: unknownTwinLine(handle) };
  }
  const twin = await getDigitalTwin(supabase, owner.id).catch(() => null);
  if (!isOwner) {
    // A private twin must look exactly like an unknown name.
    if (twin?.sharing !== "public") {
      return { ok: false, reason: "not_found", line: unknownTwinLine(handle) };
    }
    if (purpose === "speech") {
      return {
        ok: false,
        reason: "forbidden",
        line: `only @${handle} can speak as their own twin.`,
      };
    }
  }
  const entries = await listIdentityAssets(supabase, owner.id).catch(
    () => [] as IdentityAssetView[]
  );
  // This is a derived, private contact sheet. It is never populated for a
  // non-owner, even when the twin is public.
  const referenceSheet = isOwner ? ready(entries, "reference_sheet")[0] ?? null : null;
  const profileImage = ready(entries, "profile_image")[0] ?? null;
  const characterSheet = ready(entries, "character_sheet")[0] ?? null;
  const resolved: ResolvedTwin = {
    userId: owner.id,
    username: typeof owner.username === "string" ? owner.username : handle,
    isOwner,
    twin,
    referenceSheet,
    profileImage,
    characterSheet,
    alternates: isOwner ? ready(entries, "alt_image") : [],
    selfies: isOwner ? ready(entries, "selfie") : [],
    referenceVideos: isOwner ? ready(entries, "reference_video") : [],
    voiceReady:
      isOwner && twin?.voice_status === "ready" && Boolean(twin.voice_id),
  };
  const anchor =
    referenceSheet ??
    profileImage ??
    characterSheet ??
    (isOwner ? resolved.selfies[0] : undefined);
  if (!anchor) {
    return { ok: false, reason: "incomplete", line: incompleteTwinLine(handle) };
  }
  return { ok: true, twin: resolved };
}

/** The images a resolved twin contributes to a generation, best first. */
export function referenceImagesOf(twin: ResolvedTwin, max = 2): IdentityAssetView[] {
  const ordered = [
    twin.referenceSheet,
    twin.profileImage,
    twin.characterSheet,
    ...twin.alternates,
    ...twin.selfies,
  ].filter((entry): entry is IdentityAssetView => entry !== null);
  const unique: IdentityAssetView[] = [];
  for (const entry of ordered) {
    if (!unique.some((seen) => seen.asset_id === entry.asset_id)) unique.push(entry);
    if (unique.length >= max) break;
  }
  return unique;
}

export interface AttachedReferences {
  turn: CreativeCommandTurn;
  uses: ReferenceUseRow[];
  /** Handles that resolved, in order. */
  resolved: string[];
  /** First problem, if any handle could not be used — the caller refuses. */
  problem?: string | undefined;
}

const purposeForMode = (mode: CreativeCommandTurn["mode"]): ReferencePurpose =>
  mode === "imagine" ? "image" : "video";

/**
 * Attach every @handle in a creative turn as reference images. The mention
 * is rewritten to "the person in Image N" (N = the profile image's position
 * among the turn's image inputs) so the provider prompt and any echoed text
 * stay free of URLs. An unusable handle stops the turn before any provider
 * call — never silently render without the person the user named.
 */
export async function attachIdentityReferences(
  supabase: SupabaseClient,
  callerUserId: string,
  turn: CreativeCommandTurn
): Promise<AttachedReferences> {
  const handles = parseIdentityMentions(turn.cleanedText);
  if (handles.length === 0) return { turn, uses: [], resolved: [] };
  const purpose = purposeForMode(turn.mode);
  const mediaInputs: MediaInput[] = [...turn.mediaInputs];
  const uses: ReferenceUseRow[] = [];
  const resolved: string[] = [];
  let cleanedText = turn.cleanedText;
  let text = turn.text;
  for (const handle of handles) {
    const result = await resolveIdentityReference(supabase, callerUserId, handle, purpose);
    if (!result.ok) {
      return { turn, uses: [], resolved, problem: result.line };
    }
    const images = referenceImagesOf(result.twin);
    let anchorIndex: number | null = null;
    for (const image of images) {
      const url = await signedIdentityUrl(supabase, image.asset).catch(() => null);
      if (!url) continue;
      mediaInputs.push({
        kind: "image",
        url,
        ...(image.role === "reference_sheet" ? { identityReference: true } : {}),
      });
      const index = mediaInputs.filter((media) => media.kind === "image").length;
      anchorIndex ??= index;
      uses.push({
        ownerUserId: result.twin.userId,
        assetId: image.asset_id,
        role: image.role,
        purpose,
      });
    }
    if (anchorIndex === null) {
      return { turn, uses: [], resolved, problem: incompleteTwinLine(handle) };
    }
    const replacement = `the person in Image ${anchorIndex}`;
    const pattern = new RegExp(`@${handle}(?![A-Za-z0-9_-])`, "gi");
    cleanedText = cleanedText.replace(pattern, replacement);
    text = text.replace(pattern, replacement);
    resolved.push(result.twin.username);
  }
  return {
    turn: { ...turn, cleanedText, text, mediaInputs },
    uses,
    resolved,
  };
}
