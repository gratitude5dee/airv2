/**
 * Postgres read-path cache of the box-side onboarding status documents.
 * Production timing showed each Box file read costs 0.5-1s, and the
 * onboarding render did five of them — the mirror lets a normal GET render
 * without touching the Box at all.
 *
 * C4 posture: metadata only. Step statuses, upload counts, flags, and
 * timestamps are mirrored; the Link pairing `phrase` and `verification_url`
 * never are — those transient pairing values stay box-side and the link
 * slide fetches them live while pairing is in progress. The Box documents
 * remain the source of truth: rows here refresh on every control-plane
 * write and lazily (stale-while-revalidate) on render, and mirror writes
 * are best-effort — a failed write never fails the request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { StartLimitError } from "../orchestrator/boxes";
import {
  defaultOnboardingState,
  normalizeOnboardingState,
  readOnboardingState,
  type OnboardingState,
} from "./onboarding";
import {
  normalizeIngestStatus,
  readIngestStatus,
  type IngestStatus,
} from "../imessage/ingest";
import {
  normalizeImportStatus,
  readImportStatus,
  type ImportStatus,
} from "../context/importer";
import {
  normalizeBrowserProfileStatus,
  readBrowserProfileStatus,
  type BrowserProfileStatus,
} from "../context/browser-profile";
import { readLinkAuthDoc, type LinkAuthDoc } from "../payments/linkAuth";

const TABLE = "onboarding_status_mirror";

/** A mirror older than this triggers a background refresh on render. */
export const MIRROR_STALE_MS = 60_000;

/**
 * The safe subset of the Link pairing doc — never the phrase or URL.
 * `pairing` records that a phrase/URL exists box-side so the link slide
 * knows to fetch the live doc.
 */
export interface LinkAuthMeta {
  installed: boolean;
  authenticated: boolean;
  pairing: boolean;
  updated_at: string | null;
}

export function toLinkMeta(doc: LinkAuthDoc | LinkAuthMeta): LinkAuthMeta {
  const source = doc as Partial<LinkAuthDoc & LinkAuthMeta>;
  return {
    installed: source.installed !== false,
    authenticated: source.authenticated === true,
    pairing:
      source.pairing === true ||
      typeof source.phrase === "string" ||
      typeof source.verification_url === "string",
    updated_at: typeof source.updated_at === "string" ? source.updated_at : null,
  };
}

function normalizeLinkMeta(raw: unknown): LinkAuthMeta | null {
  if (typeof raw !== "object" || raw === null) return null;
  return toLinkMeta(raw as LinkAuthMeta);
}

export interface OnboardingStatusMirror {
  state: OnboardingState | null;
  ingest: IngestStatus | null;
  imports: ImportStatus | null;
  browserProfile: BrowserProfileStatus | null;
  link: LinkAuthMeta | null;
  refreshedAt: string | null;
}

export async function readStatusMirror(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingStatusMirror | null> {
  const { data } = await supabase
    .from(TABLE)
    .select("state, ingest, imports, browser_profile, link, refreshed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    state: data.state == null ? null : normalizeOnboardingState(data.state),
    ingest: data.ingest == null ? null : normalizeIngestStatus(data.ingest),
    imports:
      data.imports == null ? null : normalizeImportStatus(data.imports),
    browserProfile:
      data.browser_profile == null
        ? null
        : normalizeBrowserProfileStatus(data.browser_profile),
    link: normalizeLinkMeta(data.link),
    refreshedAt:
      typeof data.refreshed_at === "string" ? data.refreshed_at : null,
  };
}

export interface MirrorPatch {
  state?: OnboardingState;
  ingest?: IngestStatus | null;
  imports?: ImportStatus | null;
  browserProfile?: BrowserProfileStatus | null;
  /** Accepts the full doc; only the safe meta subset is persisted. */
  link?: LinkAuthDoc | LinkAuthMeta | null;
}

/** Upsert the given columns. Best-effort: logs and swallows failures. */
export async function writeStatusMirror(
  supabase: SupabaseClient,
  userId: string,
  patch: MirrorPatch
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    refreshed_at: new Date().toISOString(),
  };
  if (patch.state !== undefined) row["state"] = patch.state;
  if (patch.ingest !== undefined) row["ingest"] = patch.ingest;
  if (patch.imports !== undefined) row["imports"] = patch.imports;
  if (patch.browserProfile !== undefined) {
    row["browser_profile"] = patch.browserProfile;
  }
  if (patch.link !== undefined) {
    row["link"] = patch.link === null ? null : toLinkMeta(patch.link);
  }
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "onboarding mirror write failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
}

export interface LiveOnboardingStatus {
  state: OnboardingState;
  ingest: IngestStatus | null;
  imports: ImportStatus | null;
  browserProfile: BrowserProfileStatus | null;
  /** Full doc, including transient pairing values — in-memory only. */
  link: LinkAuthDoc | null;
  boxBusy: boolean;
}

/**
 * Read all five status documents from the Box in parallel and refresh the
 * mirror row (skipped while the box is still starting so a good mirror is
 * never overwritten with defaults). Returns the live documents.
 */
export async function refreshStatusMirror(
  supabase: SupabaseClient,
  userId: string
): Promise<LiveOnboardingStatus> {
  let boxBusy = false;
  const swallow =
    <T,>(fallback: T) =>
    (error: unknown): T => {
      if (error instanceof StartLimitError) boxBusy = true;
      return fallback;
    };
  const [state, ingest, imports, browserProfile, link] = await Promise.all([
    readOnboardingState(supabase, userId).catch((error) => {
      if (!(error instanceof StartLimitError)) throw error;
      boxBusy = true;
      return defaultOnboardingState();
    }),
    readIngestStatus(supabase, userId).catch(swallow<IngestStatus | null>(null)),
    readImportStatus(supabase, userId).catch(swallow<ImportStatus | null>(null)),
    readBrowserProfileStatus(supabase, userId).catch(
      swallow<BrowserProfileStatus | null>(null)
    ),
    readLinkAuthDoc(supabase, userId).catch(swallow<LinkAuthDoc | null>(null)),
  ]);
  if (!boxBusy) {
    await writeStatusMirror(supabase, userId, {
      state,
      ingest,
      imports,
      browserProfile,
      link,
    });
  }
  return { state, ingest, imports, browserProfile, link, boxBusy };
}
