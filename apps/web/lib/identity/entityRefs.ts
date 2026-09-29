/**
 * The @entity resolver (logos): a registered, per-user name -> a private
 * creative_assets image, usable inside /zap, /imagine and /animate the same
 * way @username pulls in twin references — parse -> authorize -> sign ->
 * inject -> rewrite -> record.
 *
 * Names are operator/user-registered entity_refs rows, not roster or
 * account lookups, so mention handling is validation-scoped: only names
 * that actually resolve leave the text. Inside the creative lanes this
 * attach runs BEFORE attachIdentityReferences — a registered entity name
 * shadows a same-named twin handle (registration is explicit intent), and
 * every unmatched @word falls through to the twin layer unchanged, where
 * unknown handles keep refusing. Bot mentions stay last, in ordinary chat.
 *
 * The slug grammar ([a-z0-9][a-z0-9-]{1,31}) shares the bot-name character
 * space; hyphenated names are invisible to the twin grammar ([a-z0-9_]).
 * Private assets surface only as short-TTL signed URLs minted at job time —
 * a signed URL never lands in user-visible or persisted text.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import type { MediaInput } from "../creative/gmi";
import type { CreativeCommandTurn } from "../creative/router";
import { signedIdentityUrl } from "./assets";
import type { ReferencePurpose } from "./resolve";
import type { ReferenceUseRow } from "./twin";

/** One registered name: 2-32 chars, lowercase alnum + interior hyphens. */
export const ENTITY_REF_NAME = /^[a-z0-9][a-z0-9-]{1,31}$/;

export type EntityRefKind = "logo";

export const isEntityRefName = (value: string): boolean =>
  ENTITY_REF_NAME.test(value);

/** A standalone @name: not part of an email, a path or another word. */
const ENTITY_MENTION =
  /(^|[^A-Za-z0-9_@/.])@([a-z0-9][a-z0-9-]{1,31})(?![A-Za-z0-9_-])/gi;

/** Unique candidate names in order of appearance, lowercased. */
export function parseEntityRefs(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(ENTITY_MENTION)) {
    const name = (match[2] ?? "").toLowerCase();
    if (ENTITY_REF_NAME.test(name) && !found.includes(name)) {
      found.push(name);
    }
  }
  return found;
}

export interface EntityRef {
  kind: string;
  name: string;
  label: string | null;
  asset: CreativeAsset;
}

interface EntityRefRow {
  name: string;
  kind: string;
  label: string | null;
  asset_id: string;
}

const REF_COLUMNS = "name, kind, label, asset_id";

const assetByIds = async (
  supabase: SupabaseClient,
  userId: string,
  assetIds: string[]
): Promise<Map<string, CreativeAsset>> => {
  const map = new Map<string, CreativeAsset>();
  if (assetIds.length === 0) return map;
  const { data } = await supabase
    .from("creative_assets")
    .select("id, user_id, box_asset_id, sha256, ext, kind, bytes, storage_key, created_at")
    .eq("user_id", userId)
    .in("id", assetIds);
  for (const row of (data ?? []) as CreativeAsset[]) map.set(row.id, row);
  return map;
};

/**
 * The caller's own registered ref, or null — unregistered and foreign rows
 * are indistinguishable (entity refs are per-user in v1).
 */
export async function resolveEntityRef(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<EntityRef | null> {
  const { data: row } = await supabase
    .from("entity_refs")
    .select(REF_COLUMNS)
    .eq("user_id", userId)
    .eq("kind", "logo")
    .eq("name", name.toLowerCase().trim())
    .maybeSingle();
  const ref = row as EntityRefRow | null;
  if (!ref) return null;
  const assets = await assetByIds(supabase, userId, [ref.asset_id]);
  const asset = assets.get(ref.asset_id);
  return asset ? { kind: ref.kind, name: ref.name, label: ref.label, asset } : null;
}

/** Every ref the owner registered (image assets joined for signing). */
export async function listEntityRefs(
  supabase: SupabaseClient,
  userId: string,
  kind?: EntityRefKind
): Promise<EntityRef[]> {
  let query = supabase
    .from("entity_refs")
    .select(REF_COLUMNS)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  if (kind) query = query.eq("kind", kind);
  const { data } = await query;
  const rows = (data ?? []) as EntityRefRow[];
  const assets = await assetByIds(
    supabase,
    userId,
    rows.map((row) => row.asset_id)
  );
  return rows
    .map((row) => ({
      kind: row.kind,
      name: row.name,
      label: row.label,
      asset: assets.get(row.asset_id),
    }))
    .filter((row): row is EntityRef => row.asset !== undefined);
}

/** What the panel/palette renders: ref metadata plus a signed thumbnail. */
export interface EntityRefView {
  name: string;
  kind: string;
  label: string | null;
  thumbUrl: string | null;
}

export async function entityRefViews(
  supabase: SupabaseClient,
  userId: string
): Promise<EntityRefView[]> {
  const refs = await listEntityRefs(supabase, userId);
  return Promise.all(
    refs.map(async (ref) => ({
      name: ref.name,
      kind: ref.kind,
      label: ref.label,
      thumbUrl: await signedIdentityUrl(supabase, ref.asset).catch(() => null),
    }))
  );
}

export type RegisterEntityRefResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export const ENTITY_REF_NAME_LINE =
  "Names are 2-32 characters: lowercase letters, digits and hyphens.";

/**
 * Register (or re-point) a name to one of the owner's image assets. The
 * same name under the same kind replaces the logo — the onboarding panel
 * relies on that as its "re-upload" path.
 */
export async function registerEntityRef(
  supabase: SupabaseClient,
  userId: string,
  options: { kind?: EntityRefKind; name: string; assetId: string; label?: string | null }
): Promise<RegisterEntityRefResult> {
  const name = options.name.trim().toLowerCase();
  if (!ENTITY_REF_NAME.test(name)) {
    return { ok: false, error: ENTITY_REF_NAME_LINE };
  }
  const { data: asset } = await supabase
    .from("creative_assets")
    .select("id, kind")
    .eq("id", options.assetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!asset || (asset as { kind?: unknown }).kind !== "image") {
    return { ok: false, error: "That asset isn't an image you own." };
  }
  const label = options.label?.trim() ? options.label.trim() : null;
  const { error } = await supabase.from("entity_refs").upsert(
    {
      user_id: userId,
      kind: options.kind ?? "logo",
      name,
      asset_id: options.assetId,
      label,
    },
    { onConflict: "user_id,kind,name" }
  );
  if (error) {
    return { ok: false, error: "Couldn't save the reference — try again." };
  }
  return { ok: true, name };
}

export async function deleteEntityRef(
  supabase: SupabaseClient,
  userId: string,
  kind: EntityRefKind,
  name: string
): Promise<boolean> {
  const { error } = await supabase
    .from("entity_refs")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("name", name);
  return !error;
}

export interface AttachedEntityReferences {
  turn: CreativeCommandTurn;
  uses: ReferenceUseRow[];
  /** Names that resolved to registered refs, in order. */
  resolved: string[];
  /** First problem — a registered ref whose asset couldn't be signed. */
  problem?: string | undefined;
}

const purposeForMode = (mode: CreativeCommandTurn["mode"]): ReferencePurpose =>
  mode === "imagine" ? "image" : "video";

/**
 * Attach every registered @name in a creative turn as a reference image.
 * The mention is rewritten to "the <name> logo in Image N" (N = the image's
 * position among the turn's image inputs), matching the reference-to-video
 * addressing scheme. Unregistered names stay literal — the twin layer owns
 * refusal for handle-shaped mentions. A registered ref that can't be
 * signed stops the turn: never silently render without the named asset.
 */
export async function attachEntityReferences(
  supabase: SupabaseClient,
  callerUserId: string,
  turn: CreativeCommandTurn
): Promise<AttachedEntityReferences> {
  const names = parseEntityRefs(turn.cleanedText);
  if (names.length === 0) return { turn, uses: [], resolved: [] };
  const purpose = purposeForMode(turn.mode);
  const mediaInputs: MediaInput[] = [...turn.mediaInputs];
  const uses: ReferenceUseRow[] = [];
  const resolved: string[] = [];
  let cleanedText = turn.cleanedText;
  let text = turn.text;
  for (const name of names) {
    const ref = await resolveEntityRef(supabase, callerUserId, name);
    if (!ref) continue;
    const url = await signedIdentityUrl(supabase, ref.asset).catch(() => null);
    if (!url) {
      return {
        turn,
        uses: [],
        resolved,
        problem: `we couldn't load @${name} — try again in a moment.`,
      };
    }
    mediaInputs.push({ kind: "image", url, entityRef: true });
    const index = mediaInputs.filter((media) => media.kind === "image").length;
    const replacement = `the ${name} ${ref.kind} in Image ${index}`;
    const pattern = new RegExp(`@${name}(?![A-Za-z0-9_-])`, "gi");
    cleanedText = cleanedText.replace(pattern, replacement);
    text = text.replace(pattern, replacement);
    uses.push({
      ownerUserId: callerUserId,
      assetId: ref.asset.id,
      role: ref.kind,
      purpose,
    });
    resolved.push(name);
  }
  return {
    turn: { ...turn, cleanedText, text, mediaInputs },
    uses,
    resolved,
  };
}
