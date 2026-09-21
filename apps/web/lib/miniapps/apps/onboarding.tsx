/**
 * Onboarding mini-app (goal.md §MA5 #1) — the front-door experience. Six
 * guided, resumable steps; each writes real state through the existing code
 * paths (username/email via lib/settings/account, Composio Connect Links via
 * lib/connectors/manage, managers via lib/vault/managers, vault items via
 * the vault CLI, first exchange via Hermes MAIN_SESSION). Progress persists
 * box-side (C4, lib/miniapps/onboarding.ts); every step is skippable and
 * re-enterable. The Onairos step (§MA9.2) reports status via ./onairos.ts
 * over lib/onairos/sync.ts and stays skippable when no key is configured;
 * the Composio integrations step follows it — Onairos ingests context,
 * connections let the agent act across the user's apps.
 * Owner-only: no guest actions (MA4).
 */
import { after, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { applyBatch, VaultCliError } from "@/lib/vault/client";
import {
  enableManager,
  listManagers,
  ManagerInputError,
  type ManagerStatus,
} from "@/lib/vault/managers";
import {
  isSpeedTier,
  MODEL_FAMILY_LABELS,
  clearGmiModel,
  setGmiModel,
  setModelFamily,
  setSpeedTier,
  setUsername,
  SPEED_TIERS,
} from "@/lib/settings/account";
import {
  DEFAULT_MODEL_FAMILY,
  GMI_MODELS,
  isGmiModel,
  isModelFamily,
  requiresConsent,
  type ModelFamily,
} from "@/lib/entitlements/models";
import { getMerchant, startOnboarding, type Merchant } from "@/lib/commerce/merchants";
import {
  buildIngestCommand as buildIngestCommandForTicket,
  mintIngestTicket,
  readIngestStatus,
  type IngestStatus,
} from "@/lib/imessage/ingest";
import {
  readBoxResolutionView,
  ResolutionInputError,
  saveResolutions,
  type ResolutionView,
} from "@/lib/imessage/archiveResolutions";
import { StateBusyError } from "../stateLease";
import {
  DictionaryStartError,
  importedFileCount,
  mintImportTicket,
  readImportStatus,
  startDictionaryRun,
  type ImportStatus,
} from "@/lib/context/importer";
import {
  disableBrowserProfile,
  mintBrowserProfileTicket,
  type BrowserProfileStatus,
} from "@/lib/context/browser-profile";
import { env } from "@/lib/env";
import { sendMiniAppCard, updateMiniAppCard } from "@/lib/miniapps/cards";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";
import { ComposioApiError } from "@/lib/composio/client";
import {
  beginConnect,
  syncConnections,
  TOOLKIT_SLUG_PATTERN,
  type ConnectionRow,
} from "@/lib/connectors/manage";
import { createRun, MAIN_SESSION } from "@/lib/hermes/client";
import {
  isOnboardingStep,
  markOnboardingStep,
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStepId,
} from "../onboarding";
import {
  MIRROR_STALE_MS,
  readStatusMirror,
  refreshStatusMirror,
  refreshStatusMirrorIfAwake,
  writeStatusMirror,
} from "../onboardingMirror";
import {
  deleteIdentityAsset,
  getAvatarAssetId,
  isIdentityRole,
  isVaultRole,
  listIdentityAssets,
  listIdentityMediaRoles,
  listIdentityMediaViews,
  mediaKindForRole,
  reorderIdentityAsset,
  setAvatarAssetId,
  signedIdentityUrl,
  uploadIdentityImage,
  uploadIdentityMedia,
  type IdentityMediaView,
  type IdentityRole,
} from "@/lib/identity/assets";
import {
  clearIdentityReferences,
  listIdentityReferenceAssetIds,
  MAX_IDENTITY_REFERENCES,
  MIN_IDENTITY_REFERENCES,
  replaceIdentityReferences,
} from "@/lib/identity/references";
import {
  CONSENT_COPY,
  CONSENT_LINES,
  CONSENT_POLICY_VERSION,
  CONSENT_SCOPES,
  consentFor,
  grantConsent,
  isConsentScope,
  listConsents,
  revokeConsent,
  type ConsentScope,
  type TwinConsent,
} from "@/lib/identity/consent";
import {
  approveProfileImageDraft,
  DESCRIPTION_MAX_CHARS,
  discardCharacterSheetDraft,
  discardProfileImageDraft,
  generateAltImage,
  generateCharacterSheet,
  generateProfileImage,
  saveCharacterSheetDraft,
  STYLE_MAX_CHARS,
} from "@/lib/identity/generate";
import { heygenAvailable } from "@/lib/identity/heygen";
import {
  createTwinVideo,
  createUserHeygenAvatar,
  disableVideoAvatar,
  enableVideoAvatar,
  getDigitalTwin,
  setTwinSharing,
  twinAvatarAvailable,
  twinSpeechAvailable,
  uploadTwinConsent,
  type DigitalTwin,
} from "@/lib/identity/twin";
import { elevenlabsAvailable } from "@/lib/identity/voice";
import {
  createUserVoiceClone,
  revokeUserVoiceClone,
} from "@/lib/identity/voiceClone";
import { ASSETS_BUCKET, DELIVERY_TTL_SECONDS } from "@/lib/assets/keys";
import {
  checkLinkAuth,
  defaultLinkAuthDoc,
  readLinkAuthDoc,
  safeVerificationUrl,
  startLinkAuth,
  type LinkAuthDoc,
} from "@/lib/payments/linkAuth";
import {
  COMPUTE_ENVIRONMENTS,
  ENVIRONMENT_PROFILES,
  isComputeEnvironment,
  toComputeEnvironment,
  type ComputeEnvironment,
} from "@/lib/compute/environments";
import {
  ReplaceInProgressError,
  SwitchSetupError,
  replaceBox,
  switchEnvironment,
} from "@/lib/provisioning/provision";
import { onairosStatusFromRows, type OnairosStatus } from "./onairos";
import {
  relayToOnairos,
  setSpectrumFlow,
  spectrumFlowActive,
} from "@/lib/onairos/spectrum";
import { OnairosError } from "@/lib/onairos/context";
import { syncOnairos } from "@/lib/onairos/sync";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { externalOrigin } from "../gates";
import { mintToken } from "../tokens";
import { baseHeaders, esc, forbidden, withBaseHeaders } from "../html";
import { WORDMARK_IMG } from "../shell";
import { isHandheld } from "../surface";
import { serveIdentityThumb, thumbHref } from "../identityThumb";
import {
  DEFAULT_THEME,
  isThemeId,
  theme,
  themeCsp,
  tokenBlock,
  type Theme,
} from "../themes";
import { timedFetch, timedPart, timedParts } from "../timing";
import { userProfile } from "../themeContext";
import type { MiniAppContext, MiniAppModule } from "./types";

/**
 * The deck: a welcome intro plus six grouped slides. The step IDs above stay
 * the state model — agent-side tools and effectiveStatus() keep reading them
 * individually — while a slide concatenates the bodies of the sub-steps it
 * owns, so the counter reads "N / 06" instead of one page per step.
 *
 * A section key is either a step ID, or one of the two composites that split
 * or merge step bodies for presentation only: `computer` renders the
 * environment/username/email trio as one card, and `browser` renders the
 * browser-profile half of the `import` step as its own numbered card.
 */
export type SlideSectionKey =
  | OnboardingStepId
  | "computer"
  | "browser"
  | "booth_photo"
  | "sheet"
  | "twin_create"
  | "twin_summary";

export interface SlideSection {
  key: SlideSectionKey;
  /** Sub-heading above the card; null renders the body bare. */
  label: string | null;
  /** Pager pane this section lives on; sections without one stack. */
  pane?: string;
}

export interface OnboardingSlide {
  id: string;
  title: string;
  kicker: string;
  sections: readonly SlideSection[];
  /** Two-column on wide viewports (the Computer slide's model card). */
  split?: boolean;
}

/** Which steps a section's body reads and writes. */
const SECTION_STEPS: Record<SlideSectionKey, readonly OnboardingStepId[]> = {
  welcome: ["welcome"],
  computer: ["environment", "username", "email"],
  environment: ["environment"],
  username: ["username"],
  email: ["email"],
  model: ["model"],
  consent: ["consent"],
  selfies: ["selfies"],
  booth_photo: ["selfies"],
  sheet: ["selfies"],
  voice: ["voice"],
  twin: ["twin"],
  twin_create: ["twin"],
  avatar: ["avatar"],
  twin_summary: ["agent"],
  imessage: ["imessage"],
  browser: ["import"],
  import: ["import"],
  onairos: ["onairos"],
  connect: ["connect"],
  secrets: ["secrets"],
  stripe: ["stripe"],
  link: ["link"],
  agent: ["agent"],
  walkthrough: ["walkthrough"],
};

// Titles and kickers live on the slide now — the deck is the display unit.
export const SLIDE_GROUPS: readonly [OnboardingSlide, ...OnboardingSlide[]] = [
  {
    id: "welcome",
    title: "welcome to air",
    kicker: "Intro",
    sections: [{ key: "welcome", label: null }],
  },
  {
    id: "computer",
    title: "Your agent's computer",
    kicker: "Computer",
    split: true,
    sections: [
      { key: "computer", label: "Pick a machine" },
      { key: "model", label: "Choose model" },
    ],
  },
  {
    id: "booth",
    title: "Your digital twin",
    kicker: "Digital Twin",
    // Six stepper panels — the deck renders them as a one-at-a-time
    // wizard with green-check progress; state lives on the five step IDs
    // (consent/selfies/voice/twin/avatar) each panel reads and writes.
    sections: [
      { key: "consent", label: "Consent & privacy" },
      { key: "booth_photo", label: "Reference media" },
      { key: "sheet", label: "Generated identity" },
      { key: "voice", label: "Voice" },
      { key: "twin_create", label: "Video avatar" },
      { key: "avatar", label: "Representing image" },
    ],
  },
  {
    id: "context",
    title: "Context retrieval",
    kicker: "Context Retrieval",
    sections: [
      { key: "imessage", label: "Step 1 — iMessage history" },
      { key: "browser", label: "Step 2 — Browser profile" },
      { key: "import", label: "Step 3 — AI context" },
    ],
  },
  {
    id: "personality",
    title: "Personality engine",
    kicker: "Personality Engine",
    sections: [{ key: "onairos", label: null }],
  },
  {
    id: "apps",
    title: "Connect your apps",
    kicker: "Connect your Apps",
    sections: [
      { key: "connect", label: "Your apps" },
      { key: "secrets", label: "Secrets" },
      { key: "stripe", label: "Get paid — create your store" },
      { key: "link", label: "Get paid — Connect Link" },
    ],
  },
  {
    id: "start",
    title: "Get started",
    kicker: "Get started",
    sections: [
      { key: "twin_summary", label: "Your digital twin" },
      { key: "agent", label: "Try a prompt" },
      { key: "walkthrough", label: "Your launcher" },
    ],
  },
];

/**
 * Where the deck opens when nothing names a step. Setup is a story with a
 * beginning: a tap on the Onboarding card lands on the welcome slide, not
 * wherever the state file happens to leave off (and never on the last slide,
 * which is what a fully done/skipped state file used to resolve to).
 */
export const ENTRY_SLIDE: OnboardingSlide = SLIDE_GROUPS[0];
export const ENTRY_STEP: OnboardingStepId = "welcome";

/** Every step a slide owns, in section order and without duplicates. */
export function slideSteps(slide: OnboardingSlide): OnboardingStepId[] {
  const steps: OnboardingStepId[] = [];
  for (const section of slide.sections) {
    for (const step of SECTION_STEPS[section.key]) {
      if (!steps.includes(step)) steps.push(step);
    }
  }
  return steps;
}

/** Deep links stay step-scoped (`?step=selfies`) — resolve to their slide. */
export function slideForStep(step: OnboardingStepId): OnboardingSlide {
  return (
    SLIDE_GROUPS.find((slide) => slideSteps(slide).includes(step)) ??
    SLIDE_GROUPS[0]
  );
}

export function slideById(id: string): OnboardingSlide | null {
  return SLIDE_GROUPS.find((slide) => slide.id === id) ?? null;
}

/** Guided, read-only first workflows — fixed prompts, never client text. */
const WALKTHROUGH_WORKFLOWS: Array<[string, string, string]> = [
  [
    "summarize_24h",
    "Summarize messages (24h)",
    "Summarize the messages I received in the last 24 hours across my channels. Read-only — don't send or change anything.",
  ],
  [
    "followup_digest",
    "Follow-up digest",
    "Using my iMessage history and connected email, list the people I should follow up with this week and why. Read-only — don't send or change anything.",
  ],
  [
    "whats_possible",
    "What can you do?",
    "Walk me through what you can do with my current connections, context, and apps — and suggest one workflow to try next.",
  ],
];

/**
 * Get started: fixed sample prompts to paste into iMessage. The first three
 * mirror WALKTHROUGH_WORKFLOWS, so they can also be run right here; the last
 * two are copy-only. Fixed text, never client input.
 */
const SAMPLE_PROMPTS: Array<{
  label: string;
  prompt: string;
  workflow: string | null;
}> = [
  ...WALKTHROUGH_WORKFLOWS.map(([workflow, label, prompt]) => ({
    label,
    prompt,
    workflow,
  })),
  {
    label: "Prep my day",
    prompt:
      "Look at my calendar for today and tell me what to prepare for each thing on it. Read-only — don't send or change anything.",
    workflow: null,
  },
  {
    label: "Learn my voice",
    prompt:
      "Read back what you know about how I write — tone, length, the words I actually use — and where you're still guessing.",
    workflow: null,
  },
];

/** Onboarding offers the golden-path action toolkits; the Connect app has all. */
const ONBOARDING_TOOLKITS: Array<[string, string]> = [
  ["gmail", "Gmail"],
  ["outlook", "Outlook"],
  ["googlecalendar", "Google Calendar"],
  ["notion", "Notion"],
  ["slack", "Slack"],
  ["github", "GitHub"],
  ["googledrive", "Google Drive"],
  ["linear", "Linear"],
  ["twitter", "X (Twitter)"],
  ["discord", "Discord"],
];

export interface OnboardingSnapshot {
  state: OnboardingState;
  /** The environment the user's compute currently runs (boxes.environment). */
  environment: ComputeEnvironment;
  username: string | null;
  address: string | null;
  /** Domain the agent's mailbox is provisioned on (AGENT_EMAIL_DOMAIN). */
  mailboxDomain: string;
  identityMedia: IdentityMediaView[];
  /** Ordered photos selected by the owner for their private reference set. */
  identityReferenceAssetIds: string[];
  avatarAssetId: string | null;
  twin: DigitalTwin | null;
  /** Legacy HeyGen talking-head path (GMI queue) is configured. */
  twinAvailable: boolean;
  /** Live consent grants (likeness / voice / video_avatar). */
  consents: TwinConsent[];
  /** ElevenLabs is configured — the voice step can clone. */
  voiceAvailable: boolean;
  /** fal is configured — the video avatar can render. */
  avatarAvailable: boolean;
  /** Both providers are configured — `/twin say` works end to end. */
  speechAvailable: boolean;
  /** Signed URL of the video-avatar preview, on slides that show it. */
  twinPreviewUrl: string | null;
  connections: ConnectionRow[];
  managers: ManagerStatus[];
  vaultItemCount: number;
  onairos: OnairosStatus;
  speedTier: string | null;
  modelFamily: ModelFamily;
  gmiModel: string | null;
  merchant: Merchant | null;
  link: LinkAuthDoc | null;
  pluginSessions: number;
  ingest: IngestStatus | null;
  ingestCommand: string | null;
  imports: ImportStatus | null;
  importCommand: string | null;
  browserProfile: BrowserProfileStatus | null;
  browserProfileCommand: string | null;
  boxBusy: boolean;
  /** Provider box id when boxes.state says the computer is up (ready/idle),
   * so live reads can address it without resuming it; null otherwise. */
  awakeBoxId: string | null;
  /** A pairing phrase/URL exists box-side but isn't in `link` yet. */
  linkPairing: boolean;
  /** Legacy thread labels awaiting the owner's decision. Content: read live
   * from the Box for the iMessage slide only, never mirrored to Postgres. */
  resolutions: ResolutionView | null;
  /**
   * Which optional parts this snapshot actually read. A slide-scoped load
   * skips the ones only that slide renders; `hydrateSlide` tops them up
   * once the active slide is known. Absent means "everything".
   */
  loaded?: SnapshotParts;
}

interface SnapshotParts {
  /** identityMedia carries signed thumbnail URLs, not just roles. */
  identityUrls: boolean;
  twin: boolean;
  consents: boolean;
  managers: boolean;
  merchant: boolean;
}

/** What a render needs beyond the always-loaded parts. */
type SnapshotScope = OnboardingSlide | "status";

export async function loadOnboardingSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingSnapshot> {
  return loadSnapshot(supabase, userId);
}

/**
 * The onboarding snapshot. `slide` is the deck page about to render: fetches
 * whose only other consumer is the deck's dot/lock status are then skipped
 * whenever the mirror already records that step as resolved, so opening the
 * welcome slide no longer pays for the photo-booth's and the app slide's
 * data. Omit it (loadOnboardingSnapshot) for the complete snapshot.
 */
async function loadSnapshot(
  supabase: SupabaseClient,
  userId: string,
  scope?: SnapshotScope
): Promise<OnboardingSnapshot> {
  const rendering = (id: string): boolean =>
    scope === undefined || (scope !== "status" && scope.id === id);

  return timedParts("onboarding", "snapshot", async (parts) => {
    // The mirror decides what else is worth fetching, so it leads; every
    // always-needed read runs alongside it rather than behind it.
    const mirrorRead = timedPart(parts, "mirror", () =>
      readStatusMirror(supabase, userId).catch(() => null)
    );
    const always = Promise.all([
      timedPart(parts, "user", () => userProfile(supabase, userId)),
      timedPart(parts, "address", () =>
        supabase
          .from("agent_addresses")
          .select("address")
          .eq("user_id", userId)
          .eq("is_primary", true)
          .is("retired_at", null)
          .maybeSingle()
      ),
      // `provider` comes back so the Onairos step reads its status from
      // these rows instead of querying the same table a second time.
      timedPart(parts, "connections", () =>
        supabase
          .from("connections")
          .select("provider, toolkit, status, connected_at")
          .eq("user_id", userId)
      ),
      timedPart(parts, "vault_count", () =>
        supabase
          .from("vault_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null)
      ),
      timedPart(parts, "entitlement", () =>
        supabase
          .from("entitlements")
          .select("speed_tier, model_family, gmi_model")
          .eq("user_id", userId)
          .maybeSingle()
      ),
      timedPart(parts, "plugin_count", () =>
        supabase
          .from("plugin_tokens")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("revoked_at", null)
      ),
      // Signed thumbnail URLs are only looked at on the booth slide and the
      // twin summary; every other slide needs the roles alone (selfie
      // present? avatar set?).
      timedPart(parts, "identity_media", () =>
        rendering("booth") || rendering("start")
          ? listIdentityMediaViews(supabase, userId)
          : listIdentityMediaRoles(supabase, userId)
      ),
      timedPart(parts, "identity_references", () =>
        listIdentityReferenceAssetIds(supabase, userId).catch(() => [] as string[])
      ),
      timedPart(parts, "box", () =>
        supabase
          .from("boxes")
          .select("provider_box_id, environment, state")
          .eq("user_id", userId)
          .maybeSingle()
      ),
    ]);

    // Mirror hit: render from Postgres metadata alone — no Box round trips.
    // The link meta carries no phrase/verification_url; the link slide
    // fetches the live doc separately while pairing. Miss (or the box is
    // mid-start): read the Box documents live and backfill the row.
    const mirror = await mirrorRead;
    let state: OnboardingState;
    let ingest: IngestStatus | null;
    let imports: ImportStatus | null;
    let browserProfile: BrowserProfileStatus | null;
    let link: LinkAuthDoc | null;
    let linkPairing = false;
    let boxBusy = false;
    let readLive = false;
    // A row written only by a step-mark (state present, docs never refreshed)
    // still counts as a hit; a row with no state yet does not.
    if (mirror?.state) {
      state = mirror.state;
      ingest = mirror.ingest;
      imports = mirror.imports;
      browserProfile = mirror.browserProfile;
      link = mirror.link
        ? {
            ...defaultLinkAuthDoc(),
            installed: mirror.link.installed,
            session_authenticated: mirror.link.session_authenticated,
            agent_payment_grant: mirror.link.agent_payment_grant,
            authenticated: mirror.link.authenticated,
            updated_at: mirror.link.updated_at,
          }
        : null;
      linkPairing = mirror.link?.pairing === true;
      const age = mirror.refreshedAt
        ? Date.now() - Date.parse(mirror.refreshedAt)
        : Number.POSITIVE_INFINITY;
      if (!(age < MIRROR_STALE_MS)) {
        try {
          after(() =>
            refreshStatusMirrorIfAwake(supabase, userId).catch(() => undefined)
          );
        } catch {
          // outside a request scope — skip the background refresh
        }
      }
    } else {
      const live = await timedFetch("onboarding", "mirror_backfill", () =>
        refreshStatusMirror(supabase, userId)
      );
      ({ state, ingest, imports, browserProfile, link, boxBusy } = live);
      linkPairing = link?.phrase != null || link?.verification_url != null;
      readLive = !boxBusy;
    }

    // A step the state file already resolves needs no live evidence:
    // effectiveStatus returns the recorded value without reading these.
    const open = (step: OnboardingStepId): boolean =>
      state.steps[step] !== "done" && state.steps[step] !== "skipped";
    const identityNeeded =
      rendering("booth") ||
      rendering("start") ||
      open("twin") ||
      open("avatar") ||
      open("voice");
    const consentsNeeded =
      rendering("booth") || rendering("start") || open("consent");
    const managersNeeded = rendering("apps") || open("secrets");
    const merchantNeeded = rendering("apps") || open("stripe");
    const [twin, avatarAssetId, consents, managers, merchant] = await Promise.all([
      identityNeeded
        ? timedPart(parts, "twin", () =>
            getDigitalTwin(supabase, userId).catch(() => null)
          )
        : null,
      identityNeeded
        ? timedPart(parts, "avatar", () =>
            getAvatarAssetId(supabase, userId).catch(() => null)
          )
        : null,
      consentsNeeded
        ? timedPart(parts, "consents", () =>
            listConsents(supabase, userId).catch(() => [] as TwinConsent[])
          )
        : ([] as TwinConsent[]),
      managersNeeded
        ? timedPart(parts, "managers", () =>
            listManagers(supabase, userId).catch(() => [] as ManagerStatus[])
          )
        : ([] as ManagerStatus[]),
      merchantNeeded
        ? timedPart(parts, "merchant", () =>
            getMerchant(supabase, userId).catch(() => null)
          )
        : null,
    ]);

    const [
      user,
      { data: addressRow },
      { data: connectionRows },
      { count },
      { data: entitlement },
      { count: pluginCount },
      identityMedia,
      identityReferenceAssetIds,
      { data: boxRow },
    ] = await always;
    const connections = (connectionRows ?? []) as Array<
      ConnectionRow & { provider?: string | null }
    >;

    return {
      state,
      environment: toComputeEnvironment(boxRow?.environment),
      username: user.username,
      address: (addressRow?.address as string | null) ?? null,
      mailboxDomain: env.agentEmailDomain(),
      identityMedia,
      identityReferenceAssetIds,
      avatarAssetId,
      twin,
      twinAvailable: env.gmiCloudApiKey() !== null,
      consents,
      voiceAvailable: elevenlabsAvailable(),
      avatarAvailable: twinAvatarAvailable(),
      speechAvailable: twinSpeechAvailable(),
      twinPreviewUrl: null,
      connections,
      managers,
      vaultItemCount: count ?? 0,
      onairos: onairosStatusFromRows(connections),
      speedTier: (entitlement?.speed_tier as string | null) ?? null,
      modelFamily: isModelFamily(String(entitlement?.model_family ?? ""))
        ? (entitlement?.model_family as ModelFamily)
        : DEFAULT_MODEL_FAMILY,
      gmiModel: (entitlement?.gmi_model as string | null) ?? null,
      merchant,
      link,
      pluginSessions: pluginCount ?? 0,
      ingest,
      ingestCommand: buildIngestCommand(userId, ingest),
      imports,
      importCommand: buildImportCommand(userId),
      browserProfile,
      browserProfileCommand: buildBrowserProfileCommand(userId),
      boxBusy,
      awakeBoxId:
        typeof boxRow?.provider_box_id === "string" &&
        (readLive || boxRow.state === "ready" || boxRow.state === "idle")
          ? boxRow.provider_box_id
          : null,
      linkPairing,
      resolutions: null,
      loaded: {
        identityUrls: rendering("booth") || rendering("start"),
        twin: identityNeeded,
        consents: consentsNeeded,
        managers: managersNeeded,
        merchant: merchantNeeded,
      },
    };
  });
}

/** Signed URL of the twin's video-avatar preview asset, if one exists. */
async function twinPreviewUrl(
  supabase: SupabaseClient,
  userId: string,
  twin: DigitalTwin | null
): Promise<string | null> {
  const assetId = twin?.avatar_preview_asset_id;
  if (!assetId || twin.avatar_status !== "ready") return null;
  const { data } = await supabase
    .from("creative_assets")
    .select("storage_key")
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  const key = (data as { storage_key?: unknown } | null)?.storage_key;
  if (typeof key !== "string") return null;
  const signed = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(key, DELIVERY_TTL_SECONDS);
  return signed.data?.signedUrl ?? null;
}

/**
 * Top up a scoped snapshot for the slide that turned out to be active — the
 * deck opens on the first unfinished step, which is only known once the
 * status parts are in hand.
 */
async function hydrateSlide(
  supabase: SupabaseClient,
  userId: string,
  snapshot: OnboardingSnapshot,
  slide: OnboardingSlide
): Promise<void> {
  const loaded = snapshot.loaded;
  if (!loaded) return;
  const jobs: Array<Promise<unknown>> = [];
  if (slide.id === "booth" || slide.id === "start") {
    if (!loaded.identityUrls) {
      loaded.identityUrls = true;
      jobs.push(
        listIdentityMediaViews(supabase, userId)
          .then((views) => {
            snapshot.identityMedia = views;
          })
          .catch(() => undefined)
      );
    }
    if (!loaded.twin) {
      loaded.twin = true;
      jobs.push(
        getDigitalTwin(supabase, userId)
          .then((twin) => {
            snapshot.twin = twin;
          })
          .catch(() => undefined),
        getAvatarAssetId(supabase, userId)
          .then((assetId) => {
            snapshot.avatarAssetId = assetId;
          })
          .catch(() => undefined)
      );
    }
    if (!loaded.consents) {
      loaded.consents = true;
      jobs.push(
        listConsents(supabase, userId)
          .then((consents) => {
            snapshot.consents = consents;
          })
          .catch(() => undefined)
      );
    }
  }
  if (slide.id === "apps") {
    if (!loaded.managers) {
      loaded.managers = true;
      jobs.push(
        listManagers(supabase, userId)
          .then((managers) => {
            snapshot.managers = managers;
          })
          .catch(() => undefined)
      );
    }
    if (!loaded.merchant) {
      loaded.merchant = true;
      jobs.push(
        getMerchant(supabase, userId)
          .then((merchant) => {
            snapshot.merchant = merchant;
          })
          .catch(() => undefined)
      );
    }
  }
  if (jobs.length > 0) {
    await timedFetch("onboarding", "slide_hydrate", () => Promise.all(jobs));
  }
  // The preview needs the twin row, so it follows the hydrate above.
  if (slide.id === "booth" || slide.id === "start") {
    snapshot.twinPreviewUrl = await twinPreviewUrl(
      supabase,
      userId,
      snapshot.twin
    ).catch(() => null);
  }
}

/**
 * Where a render with no `?step=` lands.
 *  - "entry": a fresh open (a card tap, the Home launcher). The deck always
 *    opens on its first slide — a finished account used to resolve through
 *    firstOpenStep() to `walkthrough`, dropping the owner straight onto the
 *    last slide with no sense of where setup begins.
 *  - "next": the redirect that follows an action, which does want the next
 *    thing left to do.
 */
type RenderEntry = "entry" | "next";

/**
 * The snapshot a render works from: scoped to the requested step when the
 * URL names one, then topped up for the slide the deck actually opens on.
 */
async function snapshotForRender(
  supabase: SupabaseClient,
  userId: string,
  requested: OnboardingStepId | null,
  entry: RenderEntry = "next"
): Promise<{ snapshot: OnboardingSnapshot; active: OnboardingStepId }> {
  const snapshot = await loadSnapshot(
    supabase,
    userId,
    requested ? slideForStep(requested) : entry === "entry" ? ENTRY_SLIDE : "status"
  );
  const active =
    requested ?? (entry === "entry" ? ENTRY_STEP : firstOpenStep(snapshot));
  await hydrateSlide(supabase, userId, snapshot, slideForStep(active));
  return { snapshot, active };
}

/** The one-command packager shown on the import step — owner-only page,
 * ticket is short-TTL and scoped to the agent-context endpoint. */
function buildImportCommand(userId: string): string | null {
  try {
    const origin = env.appOrigin();
    const ticket = mintImportTicket(userId);
    return `curl -fsSL ${origin}/agent-context-import.sh -o /tmp/air-import.sh && AIR_IMPORT_ENDPOINT=${origin}/api/me/agent-context bash /tmp/air-import.sh ${ticket}`;
  } catch {
    return null;
  }
}

/** The one-command profile snapshot shown on the import step — owner-only
 * page, ticket is short-TTL and scoped to the browser-profile endpoint. */
function buildBrowserProfileCommand(userId: string): string | null {
  try {
    const origin = env.appOrigin();
    const ticket = mintBrowserProfileTicket(userId);
    return `curl -fsSL ${origin}/browser-profile-import.sh -o /tmp/air-browser-import.sh && AIR_BROWSER_ENDPOINT=${origin}/api/me/browser-profile bash /tmp/air-browser-import.sh ${ticket}`;
  } catch {
    return null;
  }
}

/** The upload command shown on the iMessage step — owner-only page, ticket
 * is short-TTL and scoped to the ingest endpoint. */
function buildIngestCommand(userId: string, ingest: IngestStatus | null): string | null {
  try {
    return buildIngestCommandForTicket(mintIngestTicket(userId), ingest?.cursor ?? null);
  } catch {
    return null;
  }
}

/** A step counts done when its real state exists, however it was written. */
export function effectiveStatus(
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId
): "todo" | "done" | "skipped" {
  const recorded = snapshot.state.steps[step];
  if (recorded === "done" || recorded === "skipped") return recorded;
  switch (step) {
    case "welcome":
      // The intro is done once the owner taps Continue — or, for state files
      // written before the welcome step existed, once any real step has
      // progress: a mid-flow owner never gets bounced back to the intro.
      return ONBOARDING_STEPS.some(
        (other) => other !== "welcome" && snapshot.state.steps[other] !== "todo"
      )
        ? "done"
        : "todo";
    case "environment":
      // boxes.environment has a default, so its presence proves nothing —
      // only an explicit choice (recorded above) counts, mirroring "model".
      return "todo";
    case "username":
      return snapshot.username ? "done" : "todo";
    case "email":
      return snapshot.address ? "done" : "todo";
    case "model":
      // entitlements.speed_tier has a NOT NULL default, so its presence
      // proves nothing — only an explicit choice (recorded above) counts.
      return "todo";
    case "consent":
      // Granted → done. Accounts that set up before the consent step existed
      // (progress recorded on any later step) read as skipped, never bounced.
      return hasScope(snapshot, "likeness")
        ? "done"
        : legacyProgressAfter(snapshot, "consent")
          ? "skipped"
          : "todo";
    case "selfies":
      return snapshot.identityMedia.some(isVaultMedia) ? "done" : "todo";
    case "voice":
      return snapshot.twin?.voice_status === "ready"
        ? "done"
        : legacyProgressAfter(snapshot, "voice")
          ? "skipped"
          : "todo";
    case "twin":
      return snapshot.twin?.avatar_status === "ready" ||
        (snapshot.twin && snapshot.twin.status !== "avatar_only")
        ? "done"
        : "todo";
    case "avatar":
      return snapshot.avatarAssetId ? "done" : "todo";
    case "connect":
      return snapshot.connections.some((c) => c.status === "active")
        ? "done"
        : "todo";
    case "imessage":
      return snapshot.ingest && snapshot.ingest.chunks > 0 ? "done" : "todo";
    case "onairos":
      return snapshot.onairos.connected ? "done" : "todo";
    case "secrets":
      return snapshot.vaultItemCount > 0 ||
        snapshot.managers.some((m) => m.enabled)
        ? "done"
        : "todo";
    case "stripe":
      return snapshot.merchant?.charges_enabled ? "done" : "todo";
    case "link":
      return snapshot.link?.authenticated ? "done" : "todo";
    case "agent":
      return "todo";
    case "walkthrough":
      return "todo";
    case "import":
      return snapshot.imports?.dictionary_built_at ? "done" : "todo";
  }
}

/**
 * "Pick up where you left off" for the welcome slide. Empty for an account
 * with no progress (the Continue button is the only way on) and for one that
 * has nothing open left — there is nothing to resume to.
 */
function resumeLink(snapshot: OnboardingSnapshot): string {
  const started = ONBOARDING_STEPS.some(
    (step) => snapshot.state.steps[step] !== "todo"
  );
  if (!started) return "";
  const next = firstOpenStep(snapshot);
  if (next === "welcome") return "";
  const slide = slideForStep(next);
  if (slideLocked(snapshot, slide)) return "";
  const open = ONBOARDING_STEPS.some(
    (step) => effectiveStatus(snapshot, step) === "todo" && step !== "welcome"
  );
  const target = open ? next : "walkthrough";
  const label = open ? "Pick up where you left off" : "Jump to Get started";
  return `<a class="resume" href="?step=${esc(target)}">${label} → ${esc(slideForStep(target).kicker)}</a>`;
}

function firstOpenStep(snapshot: OnboardingSnapshot): OnboardingStepId {
  for (const step of ONBOARDING_STEPS) {
    if (effectiveStatus(snapshot, step) === "todo") return step;
  }
  return "walkthrough";
}

/** A live consent grant for the scope. */
const hasScope = (snapshot: OnboardingSnapshot, scope: ConsentScope): boolean =>
  consentFor(snapshot.consents, scope) !== null;

/**
 * True when any step after `step` already has recorded progress — the sign
 * of a state file written before `step` existed. Such accounts treat the
 * new step as skipped so the deck never reopens on it.
 */
function legacyProgressAfter(
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId
): boolean {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS.slice(index + 1).some(
    (later) => snapshot.state.steps[later] !== "todo"
  );
}

/** Slide-level status for the deck dots: done once no sub-step is open. */
function slideStatus(
  snapshot: OnboardingSnapshot,
  slide: OnboardingSlide
): "todo" | "done" | "skipped" {
  const statuses = slideSteps(slide).map((step) =>
    effectiveStatus(snapshot, step)
  );
  if (statuses.every((status) => status === "skipped")) return "skipped";
  return statuses.every((status) => status !== "todo") ? "done" : "todo";
}

/**
 * Every slide is skippable by swiping on, except that everything past the
 * Computer slide stays locked until a username exists — the agent's mailbox
 * is provisioned from it and later steps assume the @name.
 */
function slideLocked(
  snapshot: OnboardingSnapshot,
  slide: OnboardingSlide
): boolean {
  // An existing username unlocks regardless of the recorded step status —
  // accounts that skipped the step but have a provisioned @name aren't gated.
  if (snapshot.username) return false;
  if (effectiveStatus(snapshot, "username") === "done") return false;
  const gate = SLIDE_GROUPS.findIndex((s) => s.id === "computer");
  return SLIDE_GROUPS.indexOf(slide) > gate;
}

/** Confirmed vault image references — drafts, clips, samples and the avatar
 * pointer excluded. */
const isVaultMedia = (m: IdentityMediaView): boolean =>
  isVaultRole(m.role) && m.status === "ready";

/** Same-origin booth mount (script-src 'self'); the plain upload forms
 * below it stay the lite/Messages and no-camera path. The bundle is loaded
 * once per slide by renderOnboarding — a grouped slide can hold the photo,
 * the audio and the video booth. */
function boothMount(mode: "photo" | "video" | "audio"): string {
  return `<div class="identity-booth" data-mode="${mode}"></div>`;
}

/** Status pill: text + tone, never colour alone. */
function pill(text: string, tone: "ok" | "pending" | "failed" | "off" = "off"): string {
  return `<span class="pill ${tone}">${esc(text)}</span>`;
}

/** The consent gate shown on every twin panel until likeness is granted. */
function consentGate(snapshot: OnboardingSnapshot): string | null {
  if (hasScope(snapshot, "likeness")) return null;
  return `<div class="locknote" role="status"><strong>Consent first.</strong> Allow likeness generation on the <a href="?step=consent">Consent &amp; privacy</a> panel — nothing is uploaded or generated before that.</div>`;
}

const ROLE_LABELS: Record<IdentityRole, string> = {
  selfie: "photo",
  character_sheet: "character sheet",
  character_sheet_draft: "character sheet draft",
  avatar: "avatar",
  profile_image: "profile image",
  profile_image_draft: "profile image draft",
  alt_image: "alternate look",
  reference_sheet: "private reference sheet",
  reference_video: "reference video",
  voice_sample: "voice sample",
  consent_recording: "consent recording",
};

const SOURCE_LABELS: Record<IdentityMediaView["source"], string> = {
  upload: "uploaded",
  booth: "booth",
  generated: "generated",
};

/** One row of the media manager: preview, labels, reorder, delete. */
function mediaRow(m: IdentityMediaView, siblings: number, index: number): string {
  const label = ROLE_LABELS[m.role];
  const preview =
    m.kind === "image"
      ? `<img class="media-thumb" src="${esc(thumbHref(m.assetId, 64))}" width="64" height="64" loading="lazy" decoding="async" alt="${esc(label)} ${index + 1}">`
      : m.kind === "video"
        ? `<video class="media-thumb" src="${esc(m.url ?? "")}" muted playsinline preload="metadata" aria-label="${esc(label)} ${index + 1}"></video>`
        : `<audio class="media-audio" src="${esc(m.url ?? "")}" controls preload="none" aria-label="${esc(label)} ${index + 1}"></audio>`;
  const status =
    m.status === "processing"
      ? pill("processing", "pending")
      : m.status === "failed"
        ? pill("failed", "failed")
        : "";
  const move = (direction: "up" | "down", disabled: boolean): string =>
    `<form method="post" class="inline"><input type="hidden" name="action" value="move_media"><input type="hidden" name="asset_id" value="${esc(m.assetId)}"><input type="hidden" name="role" value="${esc(m.role)}"><input type="hidden" name="direction" value="${direction}"><button class="ghost icon" aria-label="Move ${esc(label)} ${index + 1} ${direction}"${disabled ? " disabled" : ""}>${direction === "up" ? "↑" : "↓"}</button></form>`;
  const remove = `<form method="post" class="inline"><input type="hidden" name="action" value="delete_media"><input type="hidden" name="asset_id" value="${esc(m.assetId)}"><button class="ghost" aria-label="Delete ${esc(label)} ${index + 1}">Delete</button></form>`;
  return `<li class="media-row">${preview}<div class="media-meta"><span class="chip">${esc(label)}</span><span class="chip">${esc(SOURCE_LABELS[m.source])}</span>${status}</div><div class="media-actions">${move("up", index === 0)}${move("down", index === siblings - 1)}${remove}</div></li>`;
}

/** The media manager for one kind (images / clips / samples). */
function mediaList(items: IdentityMediaView[], empty: string): string {
  const shown = items.filter((m) => m.url);
  if (shown.length === 0) return `<p class="muted">${esc(empty)}</p>`;
  return `<ul class="media-list">${shown.map((m, i) => mediaRow(m, shown.length, i)).join("")}</ul>`;
}

/** Labels shown per save; the rest follow once these are decided. */
export const RESOLUTION_PAGE_SIZE = 100;
export const KEEP_OWN_THREAD = "Keep as its own thread";

/**
 * The owner's decision list for legacy chat labels the catalogue could not
 * settle. Labels and candidate IDs come straight from the Box for this
 * owner-session page; when the computer is asleep only the mirrored count
 * is known, so the section asks for a Refresh instead of waking it.
 */
function renderResolutions(snapshot: OnboardingSnapshot): string {
  const pending = snapshot.ingest?.pending_resolutions ?? 0;
  const view = snapshot.resolutions;
  if (!view) {
    if (pending <= 0) return "";
    return `<p><strong>${pending}</strong> earlier chat label${pending === 1 ? "" : "s"} need${pending === 1 ? "s" : ""} your decision before the upload can finish. Your agent's computer is asleep — tap Refresh status to wake it and load them.</p><form method="post" class="inline"><input type="hidden" name="action" value="refresh_ingest"><button class="ghost">Refresh status</button></form>`;
  }
  const remaining = view.unresolved.length;
  if (remaining === 0) {
    return `<p>All earlier chat labels are decided${view.resolutions.length ? ` (${view.resolutions.length} saved)` : ""}. Rerun the upload command below to finish.</p>`;
  }
  const shown = view.unresolved.slice(0, RESOLUTION_PAGE_SIZE);
  const rows = shown
    .map((entry, index) => {
      const options = entry.candidates
        .map((candidate) => `<option value="${esc(candidate)}">${esc(candidate)}</option>`)
        .join("");
      const keep = `<option value="">${entry.candidates.length ? KEEP_OWN_THREAD : `No match — ${KEEP_OWN_THREAD.toLowerCase()}`}</option>`;
      return `<div class="item"><span class="grow">${esc(entry.label)}</span><input type="hidden" name="label_${index}" value="${esc(entry.label)}"><select name="id_${index}">${options}${keep}</select></div>`;
    })
    .join("");
  const more = remaining > shown.length
    ? `<p class="muted">${remaining - shown.length} more follow once these are saved.</p>`
    : "";
  return `<p><strong>${remaining}</strong> earlier chat label${remaining === 1 ? "" : "s"} match${remaining === 1 ? "es" : ""} more than one conversation (or none). Pick the right conversation for each, or keep it as its own thread, then rerun the upload command.</p><form method="post" class="stack"><input type="hidden" name="action" value="resolve_threads">${rows}${more}<button>Save decisions</button></form>`;
}

/** Everything an iPhone camera roll can hand back; HEIC converts server-side. */
const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/heic,image/heif";

/** Inline, currentColor, no asset fetch — same posture as ENV_MARKS. */
const UPLOAD_ICONS: Record<"camera" | "library" | "video" | "audio", string> = {
  camera:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-2h8.4l1.1 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  library:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m6 16 3.6-4.2 2.8 3 2.3-2.6L18.5 16"/><circle cx="9" cy="9.4" r="1.4"/></svg>',
  video:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12.5" height="12" rx="2"/><path d="m16.5 11 4.5-3v8l-4.5-3Z"/></svg>',
  audio:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 12a6.5 6.5 0 0 0 13 0"/><path d="M12 18.5V21"/></svg>',
};

/**
 * One upload affordance: a full-width tile the whole of which is the file
 * picker's label, so the tap target is the card and not a 90px-wide
 * platform button labelled "Choose File" that says nothing about what it
 * wants. The input stays a plain `<input type=file>` inside a plain
 * multipart form — the tile is presentation, the upload path is unchanged.
 *
 * With the tap-feedback bundle loaded the picker submits on selection (one
 * tap end to end); the fallback button below it is what runs without JS,
 * and is hidden once the bundle marks the document.
 */
function uploadTile(options: {
  id: string;
  action: string;
  icon: keyof typeof UPLOAD_ICONS;
  title: string;
  hint: string;
  accept: string;
  submit: string;
  capture?: "user" | "environment";
  role?: string;
}): string {
  const capture = options.capture ? ` capture="${options.capture}"` : "";
  const roleField = options.role
    ? `<input type="hidden" name="role" value="${esc(options.role)}">`
    : "";
  return `<form method="post" enctype="multipart/form-data" class="uploader-form"><input type="hidden" name="action" value="${esc(options.action)}">${roleField}<label class="uploader" for="${esc(options.id)}"><span class="uploader-icon" aria-hidden="true">${UPLOAD_ICONS[options.icon]}</span><span class="uploader-copy"><strong>${esc(options.title)}</strong><span class="uploader-hint">${esc(options.hint)}</span></span><input id="${esc(options.id)}" type="file" name="file" accept="${esc(options.accept)}"${capture} data-autosubmit></label><button class="ghost uploader-fallback">${esc(options.submit)}</button></form>`;
}

function skipForm(step: OnboardingStepId, label = "Skip for now"): string {
  // Skipping is always allowed and never the recommended move: it reads as a
  // quiet link beside the step's real action, not as a second solid button.
  return `<form method="post" class="inline"><input type="hidden" name="action" value="skip"><input type="hidden" name="step" value="${esc(step)}"><button class="quiet">${esc(label)}</button></form>`;
}

function doneForm(step: OnboardingStepId, label: string): string {
  return `<form method="post" class="inline"><input type="hidden" name="action" value="mark_done"><input type="hidden" name="step" value="${esc(step)}"><button>${esc(label)}</button></form>`;
}

/** Card marks for the compute row — inline, currentColor, no asset fetch. */
const ENV_MARKS: Record<ComputeEnvironment, string> = {
  ubuntu: `<svg class="envmark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="3.6" r="2"/><circle cx="4.7" cy="16.2" r="2"/><circle cx="19.3" cy="16.2" r="2"/></svg>`,
  omarchy: `<svg class="envmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3.5 20.5h17L12 3Z"/><path d="M12 11 8.2 20.5h7.6L12 11Z"/></svg>`,
  macos: `<svg class="envmark" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="4.5" width="18.4" height="12" rx="2"/><path d="M1.5 20h21"/></svg>`,
};

/** Horizontal compute cards — one row, logo + name + one-line blurb. */
function environmentCards(snapshot: OnboardingSnapshot): string {
  const cards = COMPUTE_ENVIRONMENTS.map((environment) => {
    const profile = ENVIRONMENT_PROFILES[environment];
    const current = environment === snapshot.environment;
    const name = `<span class="envname">${esc(profile.label)}${current ? '<span class="envtag">Current</span>' : ""}${profile.comingSoon && !current ? '<span class="envtag soon">Soon</span>' : ""}</span>`;
    const inner = `${ENV_MARKS[environment]}${name}<span class="envblurb">${esc(profile.blurb)}</span>`;
    if (profile.comingSoon && !current) {
      return `<div class="envcard off" aria-disabled="true">${inner}</div>`;
    }
    return `<form method="post" class="envform"><input type="hidden" name="action" value="set_environment"><input type="hidden" name="environment" value="${esc(environment)}"><button class="envcard${current ? " current" : ""}">${inner}</button></form>`;
  }).join("");
  return `<div class="envgrid">${cards}</div>`;
}

/**
 * Computer card: machine, username, and the mailbox that follows it. The
 * address is `<username>@<AGENT_EMAIL_DOMAIN>` (lib/provisioning/email.ts),
 * so "editing the mailbox" is the same write as changing the username — the
 * field posts set_username and the inbox is re-provisioned behind it.
 */
function computerBody(snapshot: OnboardingSnapshot): string {
  const domain =
    snapshot.address?.split("@")[1] ?? snapshot.mailboxDomain;
  const mailbox = snapshot.address
    ? `<div class="mailbox"><span class="chip">Mailbox</span><strong>${esc(snapshot.address)}</strong></div><p class="muted">Your agent reads and drafts here; sending always waits for your approval. Edit the address below — the old one keeps routing forever.</p>`
    : `<p class="muted">Lowercase letters, digits, underscore — 2–24 characters. Your agent's mailbox is provisioned from it automatically.</p>`;
  const form = `<form method="post" class="row mailform"><input type="hidden" name="action" value="set_username"><input type="text" name="username" value="${esc(snapshot.username ?? "")}" placeholder="username" maxlength="24" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="done"><span class="suffix">@${esc(domain)}</span><button>${snapshot.address ? "Update" : "Save"}</button></form>`;
  const gateNote = snapshot.username
    ? ""
    : '<p class="muted">Pick a username to unlock the rest — it provisions your agent\u2019s mailbox. Everything after this is skippable.</p>';
  return `<p class="muted">Your agent gets its own computer. Pick where it lives — you can switch later, but its files start fresh on the new machine.</p>${environmentCards(snapshot)}${mailbox}${form}${gateNote}`;
}

/** The families offered during onboarding; Settings has the full menu. */
const ONBOARDING_FAMILIES: readonly ModelFamily[] = [
  "openai",
  "anthropic",
  "minimax-m3",
  "minimax-m2.7",
  "gmi",
];

function modelBody(snapshot: OnboardingSnapshot): string {
  const families = ONBOARDING_FAMILIES.map(
    (family) =>
      `<form method="post" class="famform"><input type="hidden" name="action" value="set_model_family"><input type="hidden" name="model_family" value="${esc(family)}"><button${family === snapshot.modelFamily ? "" : ' class="ghost"'}>${esc(MODEL_FAMILY_LABELS[family])}</button></form>`
  ).join("");
  const tiers = SPEED_TIERS.map(
    (tier) =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="set_speed"><input type="hidden" name="speed_tier" value="${esc(tier)}"><button${tier === snapshot.speedTier ? "" : ' class="ghost"'}>${esc(tier)}</button></form>`
  ).join("");
  // With GMI Cloud the tier pick IS the model pick (fast → GLM-5.3 Flash,
  // balanced → Luna, deep → Astra); the pin row lets a new owner choose one
  // model across tiers instead. Subagent runs always stay on GLM-5.3 Flash.
  const gmiPins =
    snapshot.modelFamily === "gmi"
      ? `<p class="muted">GMI Cloud model — or leave unpinned and let the tier choose:</p><div class="famgrid">${GMI_MODELS.map(
          (model) =>
            `<form method="post" class="famform"><input type="hidden" name="action" value="set_gmi_model"><input type="hidden" name="gmi_model" value="${esc(model.slug)}"><button${model.slug === snapshot.gmiModel ? "" : ' class="ghost"'}>${esc(model.label)}</button></form>`
        ).join("")}${snapshot.gmiModel ? `<form method="post" class="famform"><input type="hidden" name="action" value="clear_gmi_model"><button class="ghost">Follow speed tier</button></form>` : ""}</div>`
      : "";
  return `<p class="muted">Pick the family your agent thinks with.</p><div class="famgrid">${families}</div><p class="muted">(you can select others in settings later)</p>${gmiPins}<p class="muted">Thinking speed — faster answers or deeper reasoning:</p><div class="row">${tiers}</div><div class="row actions">${skipForm("model")}</div>`;
}

/** Messages app glyph — green tile with a white speech bubble. */
const IMESSAGE_ICON = `<svg class="oa-appicon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="oa-imsg-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ff283"/><stop offset="1" stop-color="#1fc84d"/></linearGradient></defs><rect width="24" height="24" rx="5.6" fill="url(#oa-imsg-g)"/><path fill="#fff" d="M12 5.2c-4.3 0-7.6 2.7-7.6 6.1 0 1.9 1.1 3.6 2.8 4.7-.1.9-.5 1.9-1.3 2.7 1.4-.2 2.7-.8 3.7-1.6.8.2 1.6.3 2.4.3 4.3 0 7.6-2.7 7.6-6.1S16.3 5.2 12 5.2Z"/></svg>`;

/** Speech-bubble tail hanging off the bubble's bottom-left corner. */
const BUBBLE_TAIL = `<svg class="oa-tail" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M14 0C14 6.5 9.5 12.5 1 15.6c6.5.6 12-2.2 15-6.6V0Z"/></svg>`;

/**
 * Personality engine (Onairos) step: a status well, the native sign-in well,
 * the iMessage alternative as a chat-bubble button, and one actions row —
 * Continue (primary, once connected) or Skip, plus Refresh for card sessions
 * that finished a Google sign-in in the real browser. The key only ever
 * renders on the owner's own authenticated slide (never in a public bundle),
 * the SDK handoff posts back as a regular form (action=onairos_handoff), and
 * a connected account keeps the flow mounted so more sources can be added.
 */
function onairosBody(
  snapshot: OnboardingSnapshot,
  browserSignin: string | null
): string {
  if (!snapshot.onairos.available) {
    return `<div class="oa-status"><span class="oa-dot"></span><span class="chip">Not configured</span><p>Onairos personal context isn't configured on this deployment — connect it later from Settings once it is. Nothing here blocks the rest of setup.</p></div><div class="row actions">${skipForm("onairos", "Skip — not configured")}</div>`;
  }
  const connected = snapshot.onairos.connected;
  const apiKey = env.onairosApiKey() ?? "";
  const googleClientId = env.onairosGoogleClientId();
  const googleAttr = googleClientId
    ? ` data-google-client-id="${esc(googleClientId)}"`
    : "";
  const status = connected
    ? `<div class="oa-status on"><span class="oa-dot"></span><span class="chip">Connected</span><p>Your imported context lives on your computer. Re-sync or disconnect any time from Settings.</p></div>`
    : `<div class="oa-status"><span class="oa-dot"></span><span class="chip">Not connected</span><p>Import your personal context from the platforms you already use. What you approve lives on your computer — never on the platform.</p></div>`;
  // Google blocks OAuth inside embedded webviews (disallowed_useragent),
  // so a card-opened Messages sheet offers a signed jump into the real
  // browser where the Google path works.
  const browserNote = browserSignin
    ? `<p class="oa-note">Signing in with Google? Google blocks it inside Messages — <a href="${esc(browserSignin)}" target="_blank" rel="noopener">open this step in your browser</a>, finish there, then tap Refresh here.</p>`
    : "";
  const refresh = browserSignin
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="noop"><button class="ghost">Refresh</button></form>`
    : "";
  const label = connected ? "Add more sources" : "Sign in with Onairos";
  const hint = connected
    ? "Open Onairos again to connect other platforms — each new connection re-imports your context."
    : "The consent flow opens right here — approve what to share and your context imports in one step.";
  const connect = `<div class="oa-connect"><span class="chip">${label}</span><p class="muted">${hint}</p><div id="onairos-connect" class="oa-mount" data-api-key="${esc(apiKey)}"${googleAttr}><p class="muted">Loading Onairos sign-in…</p></div>${browserNote}</div><script src="/creator-os/onairos-connect.js" defer></script>`;
  const imessage = `<div class="oa-alt"><span class="chip">Or connect via iMessage</span><form method="post" class="inline"><input type="hidden" name="action" value="connect_onairos"><button class="oa-bubble"><span>Connect via iMessage</span>${IMESSAGE_ICON}${BUBBLE_TAIL}</button></form><p class="muted">Onairos asks for your account email, a verification code, and your YES right in your iMessage thread.</p></div>`;
  const primary = connected
    ? doneForm("onairos", "Continue")
    : skipForm("onairos");
  return `${status}${connect}${imessage}<div class="row actions">${primary}${refresh}</div>`;
}

function stepBody(
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId,
  browserSignin: string | null,
  lite = false
): string {
  if (step === "welcome") {
    // The deck always opens here, so a returning owner needs one tap back to
    // wherever they stopped — the entry slide is a starting line, not a wall.
    const resume = resumeLink(snapshot);
    // The same cinematic welcome is available in the Messages mini-app.
    // The renderer disables only its WebGL blast there; the film, controls,
    // and ordinary flash fallback remain safe on the constrained surface.
    return `<div class="cine" data-intro data-noswipe><div class="cine-stage"><span class="wzrd-glow" aria-hidden="true"></span><img class="cine-mark" src="/creator-os/wzrd-wordmark-640.png" width="640" height="158" decoding="async" alt="WZRD.tech"><button type="button" class="cine-cta">Begin</button>${resume ? `<div class="cine-resume">${resume}</div>` : ""}</div><div class="cine-blast" aria-hidden="true"></div><video class="cine-film" playsinline muted preload="metadata" aria-label="air introduction film"><source src="/creator-os/airintrofin.mp4" type="video/mp4"></video><button type="button" class="cine-sound" hidden>Sound on</button><div class="cine-done">${doneForm("welcome", "Continue")}</div></div>`;
  }
  if (step === "environment") {
    return `<p class="muted">Your agent gets its own computer. Pick where it lives — you can switch later, but its files start fresh on the new machine.</p>${environmentCards(snapshot)}`;
  }
  if (step === "username") {
    return computerBody(snapshot);
  }
  if (step === "email") {
    const line = snapshot.address
      ? `<p>Your agent reads and drafts at <strong>${esc(snapshot.address)}</strong>. Sending always waits for your approval.</p>`
      : `<p class="muted">Your agent's inbox is provisioned automatically when you set a username — no extra step.</p>`;
    return `${line}<div class="row actions">${snapshot.address ? doneForm("email", "Looks good") : ""}${skipForm("email")}</div>`;
  }
  if (step === "model") {
    return modelBody(snapshot);
  }
  if (step === "consent") {
    return consentBody(snapshot);
  }
  if (step === "selfies") {
    return `${mediaBody(snapshot, lite)}${generatedBody(snapshot)}`;
  }
  if (step === "voice") {
    return voiceBody(snapshot, lite);
  }
  if (step === "twin") {
    return videoAvatarBody(snapshot, lite);
  }
  if (step === "avatar") {
    // First option: train a reusable avatar from an identity image (when
    // configured). Fallback: pick a photo directly — renders go straight
    // through with the raw image.
    const trainedBlock = heygenAvailable()
      ? snapshot.twin?.provider_avatar_id
        ? `<p>Trained avatar ready — videos render with it.</p>`
        : snapshot.identityMedia.some(isVaultMedia)
          ? `<form method="post" class="inline"><input type="hidden" name="action" value="create_heygen_avatar"><button>Train an avatar</button></form><p class="muted">Recommended — trains a reusable avatar from your newest identity image.</p>`
          : `<p class="muted">Add a photo in the booth above to train an avatar.</p>`
      : "";
    const choices = snapshot.identityMedia
      .filter((m) => isVaultMedia(m) && m.url)
      .map(
        (m) =>
          `<form method="post" class="idpick"><input type="hidden" name="action" value="set_avatar"><input type="hidden" name="asset_id" value="${esc(m.assetId)}"><img class="idthumb" src="${esc(thumbHref(m.assetId, 96))}" width="96" height="96" loading="lazy" decoding="async" alt="${esc(ROLE_LABELS[m.role])}"><span class="chip">${esc(ROLE_LABELS[m.role])}</span><button${m.assetId === snapshot.avatarAssetId ? "" : ' class="ghost"'}>${m.assetId === snapshot.avatarAssetId ? "Current avatar" : "Use as avatar"}</button></form>`
      )
      .join("");
    const gallery = choices
      ? `<div class="idgrid">${choices}</div>`
      : `<p class="muted">No identity images yet — add photos or generate a profile image on the <a href="?step=selfies">reference media panel</a>.</p>`;
    const generate = snapshot.username
      ? `<form method="post" class="inline"><input type="hidden" name="action" value="generate_alt_image"><button class="ghost">Generate a new look</button></form>`
      : "";
    return `<p class="muted">Optional — pick the image that represents @${esc(snapshot.username ?? "you")} on your public card and in chat. Your approved profile image is the usual choice.</p>${trainedBlock}${gallery}<div class="row actions">${generate}${skipForm("avatar")}</div>`;
  }
  if (step === "connect") {
    // Same webview constraint as the Onairos slide: Google refuses OAuth
    // inside Messages, so a card session gets a jump into the real browser.
    const connectBrowserLine = browserSignin
      ? `<p class="muted">Google blocks sign-in inside Messages — <a href="${esc(browserSignin)}" target="_blank" rel="noopener">open this step in your browser</a>, connect there, then come back and tap Refresh status.</p>`
      : "";
    const byToolkit = new Map(snapshot.connections.map((c) => [c.toolkit, c]));
    const rows = ONBOARDING_TOOLKITS.map(([slug, label]) => {
      const status = byToolkit.get(slug)?.status ?? null;
      const chip =
        status === "active"
          ? '<span class="chip">connected</span>'
          : status === "pending"
            ? '<span class="chip">pending — finish sign-in, then refresh</span>'
            : "";
      const button =
        status === "active"
          ? ""
          : `<form method="post" class="inline" target="_top"><input type="hidden" name="action" value="connect"><input type="hidden" name="toolkit" value="${esc(slug)}"><button>Connect</button></form>`;
      return `<div class="item"><span class="grow">${esc(label)}</span>${chip}${button}</div>`;
    }).join("");
    return `<p class="muted">Onairos imported your context — these connections let your agent take actions in your apps, always with your approval. Sign-in happens with each app directly; the platform never sees your passwords or tokens. The Connect app has the full catalog.</p>${connectBrowserLine}${rows}<p class="muted">Apple Calendar connects via an ICS subscription in the Calendar app — there is no OAuth for it here.</p><div class="row actions"><form method="post" class="inline"><input type="hidden" name="action" value="refresh_connections"><button class="ghost">Refresh status</button></form>${skipForm("connect")}</div>`;
  }
  if (step === "imessage") {
    const ingest = snapshot.ingest;
    const statusLine =
      ingest && ingest.chunks > 0
        ? `<p>Ingested <strong>${ingest.messages.toLocaleString("en-US")}</strong> messages${ingest.last_upload_at ? ` (last upload ${esc(ingest.last_upload_at.slice(0, 10))})` : ""} — they live on your agent's computer, never on the platform.</p>`
        : `<p class="muted">Your iMessage history lives only on your Mac. Run one command there to copy the last 365 days to your agent's computer as personal context. Add a different number of days after the upload ticket to change the window.</p>`;
    const pluginLine =
      snapshot.pluginSessions > 0
        ? `<p class="muted">WZRD ChatGPT/Claude plugin: ${snapshot.pluginSessions} active session${snapshot.pluginSessions === 1 ? "" : "s"}.</p>`
        : `<p class="muted">Also available: the WZRD plugin for ChatGPT/Claude — start sign-in from the tool, then approve its code in Settings.</p>`;
    const command = snapshot.ingestCommand
      ? `<details><summary>Get the one-time upload command</summary><p class="muted">Run in Terminal on your Mac (needs Full Disk Access; link valid ~30 minutes):</p><pre>${esc(snapshot.ingestCommand)}</pre><form method="post" class="inline"><input type="hidden" name="action" value="refresh_ingest"><button class="ghost">Refresh status</button></form></details>`
      : "";
    return `${statusLine}${renderResolutions(snapshot)}${command}${pluginLine}<div class="row actions">${skipForm("imessage")}</div>`;
  }
  if (step === "onairos") {
    return onairosBody(snapshot, browserSignin);
  }
  if (step === "secrets") {
    const managerLines = snapshot.managers
      .filter((m) => m.manager !== "command")
      .map(
        (m) =>
          `<div class="muted">${esc(m.manager === "bitwarden" ? "Bitwarden" : "1Password")}: ${esc(m.enabled ? m.status : "off")}</div>`
      )
      .join("");
    const settled =
      snapshot.vaultItemCount > 0 || snapshot.managers.some((m) => m.enabled);
    return `<p class="muted">Your agent fills secrets only with your approval. Use the built-in vault, or bring your own manager.</p>${managerLines}<details><summary>Add a first login (built-in vault)</summary><form method="post" class="stack"><input type="hidden" name="action" value="add_login"><input type="text" name="name" placeholder="e.g. &quot;Gmail&quot;" maxlength="120"><input type="text" name="username" placeholder="Username" maxlength="200"><input type="password" name="password" placeholder="Password" maxlength="500" autocomplete="off"><button>Save to vault</button></form></details><details><summary>Bring your own manager</summary><form method="post" class="stack"><input type="hidden" name="action" value="enable_manager"><select name="manager"><option value="bitwarden">Bitwarden (machine-account token)</option><option value="onepassword">1Password (service-account token)</option></select><input type="password" name="token" placeholder="Access token" maxlength="512" autocomplete="off"><button>Enable</button></form><p class="muted">The token goes straight to your agent's computer — it is never stored on the platform or shown again.</p><p class="muted">Connect 1Password and you can also turn on "Allow agent sign-in" per site in the Browser tab — your agent then fills those 1Password logins straight into its own browser. Credentials never appear in chat.</p></details><div class="row actions">${settled ? doneForm("secrets", "Done with secrets") : ""}${skipForm("secrets")}</div>`;
  }
  if (step === "stripe") {
    const merchant = snapshot.merchant;
    const connectForm = (label: string): string =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="connect_stripe"><button>${esc(label)}</button></form>`;
    const status = !merchant
      ? `<p class="muted">Create your store: connect your own Stripe account so you can sell through your storefront — funds settle directly to you; the platform never holds your money. You can do this now or later.</p><div class="row actions">${connectForm("Create your store")}${skipForm("stripe", "Later")}</div>`
      : merchant.charges_enabled
        ? `<p>Your store is live — charges enabled. Manage it from the Shop app.</p><div class="row actions">${skipForm("stripe", "Continue")}</div>`
        : `<p>Stripe onboarding in progress.</p><div class="row actions">${connectForm("Resume onboarding")}${skipForm("stripe", "Later")}</div>`;
    return status;
  }
  if (step === "link") {
    const link = snapshot.link;
    const intro = `<p class="muted">Link is Stripe's wallet. Pair it once and your agent can request one-time-use payment credentials for purchases — every spend still comes back to you as a one-tap approval sheet, and your real card details are never shared.</p>`;
    if (link?.authenticated) {
      return `${intro}<p>Link connected — your agent can request payment credentials, and each spend still needs your one-tap approval.</p><div class="row actions">${skipForm("link", "Continue")}</div>`;
    }
    if (link && !link.installed) {
      return `${intro}<p class="muted">The Link CLI isn't on your agent's computer yet — it arrives with the next computer update. Skip for now and connect later from here.</p><div class="row actions">${skipForm("link", "Skip — not ready yet")}</div>`;
    }
    const connectForm = (label: string, ghost = false): string =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="link_connect"><button${ghost ? ' class="ghost"' : ""}>${esc(label)}</button></form>`;
    const checkForm = `<form method="post" class="inline"><input type="hidden" name="action" value="link_check"><button>I approved — check status</button></form>`;
    const pendingUrl = safeVerificationUrl(link?.verification_url ?? null);
    if (pendingUrl) {
      // One tap to link.com (primary CTA), phrase shown big for the match
      // check there, then a single confirm tap back here.
      const phrase = link?.phrase
        ? `<div class="linkphrase">${esc(link.phrase)}</div><p class="muted">Link shows this phrase — confirm it matches.</p>`
        : "";
      return `${intro}<a class="linkcta" href="${esc(pendingUrl)}" target="_blank" rel="noopener">Approve at link.com →</a>${phrase}<p class="muted">Opens in your browser — log in with the email on your Link wallet. The code expires after a few minutes.</p><div class="row actions">${checkForm}${connectForm("Start over", true)}${skipForm("link", "Later")}</div>`;
    }
    if (link?.session_authenticated) {
      return `${intro}<p class="muted">Link is signed in, but the agent-payment permission is missing or could not be verified. Update permissions before your agent can request a one-time payment credential.</p><div class="row actions">${connectForm("Update Link permissions")}${skipForm("link", "Later")}</div>`;
    }
    return `${intro}<div class="row actions">${connectForm("Connect Link")}${skipForm("link", "Later")}</div>`;
  }
  if (step === "import") {
    const imports = snapshot.imports;
    const files = imports ? importedFileCount(imports) : 0;
    const built = Boolean(imports?.dictionary_built_at);
    const building = Boolean(
      imports?.dictionary_started_at && !imports.dictionary_built_at
    );
    const perSource = imports
      ? (
          [
            ["Hermes profile", imports.sources.hermes.files],
            ["Codex", imports.sources.codex.files],
            ["Claude", imports.sources.claude.files],
          ] as Array<[string, number]>
        )
          .map(
            ([label, count]) =>
              `<div class="item"><span class="grow">${esc(label)}</span><span class="chip">${count > 0 ? `${count.toLocaleString("en-US")} files` : "not imported"}</span></div>`
          )
          .join("")
      : "";
    const statusLine = built
      ? `<p>Your personal dictionary is ready — <strong>Dictionary.MD</strong> lives on your agent's computer and now personalizes every conversation.</p>`
      : building
        ? `<p>Your ingestion agent is reading everything you imported and distilling <strong>Dictionary.MD</strong> — tap Refresh in a minute.</p>`
        : files > 0
          ? `<p>Imported <strong>${files.toLocaleString("en-US")}</strong> files — build your dictionary below, or run the command again to add more.</p>`
          : `<p class="muted">Already use Hermes, Codex, or Claude Code? One command imports all of it — your profile, sessions, and instructions — straight to your agent's computer, never to the platform. It then builds a personal <strong>Dictionary.MD</strong> from everything, so your agent starts out already knowing you.</p>`;
    const command = snapshot.importCommand
      ? `<details${files > 0 || built ? "" : " open"}><summary>Get the one-click import command</summary><p class="muted">Run in Terminal on the machine where your agents live (link valid ~30 minutes; secrets are excluded and credentials redacted before upload):</p><pre>${esc(snapshot.importCommand)}</pre></details>`
      : "";
    const buildForm =
      files > 0 && !building
        ? `<form method="post" class="inline"><input type="hidden" name="action" value="build_dictionary"><button>${built ? "Rebuild dictionary" : "Build my dictionary"}</button></form>`
        : "";
    const refreshForm = `<form method="post" class="inline"><input type="hidden" name="action" value="refresh_import"><button class="ghost">Refresh status</button></form>`;
    return `${statusLine}${perSource}${command}<div class="row actions">${buildForm}${refreshForm}${skipForm("import")}</div>`;
  }
  if (step === "walkthrough") {
    const tour = `<p>Home is your launcher — here's the clickthrough:</p><ul><li><strong>Home grid</strong> — every app as a one-tap tile: calendar, vault, pay, shop, inbox, persona, and more.</li><li><strong>Chat</strong> — one conversation with your agent, same on iMessage and the web.</li><li><strong>Needs you</strong> — every action with side effects (emails, payments, publishes) waits for your approval.</li><li><strong>Settings</strong> — username, speed, memory, context, plugin sessions.</li></ul><p class="muted">Finish setup and the Home app arrives as your next message — tap it and try each tile.</p>`;
    const buttons = WALKTHROUGH_WORKFLOWS.map(
      ([id, label]) =>
        `<form method="post" class="inline"><input type="hidden" name="action" value="run_workflow"><input type="hidden" name="workflow" value="${esc(id)}"><button class="ghost">${esc(label)}</button></form>`
    ).join("");
    return `${tour}<p class="muted">Try a first workflow — all read-only; your agent replies in chat:</p><div class="row">${buttons}</div><div class="row actions">${doneForm("walkthrough", "Finish setup")}</div>`;
  }
  // agent
  const prompts = SAMPLE_PROMPTS.map((sample) => {
    const run = sample.workflow
      ? `<form method="post" class="inline"><input type="hidden" name="action" value="run_workflow"><input type="hidden" name="workflow" value="${esc(sample.workflow)}"><button class="ghost">Run here</button></form>`
      : "";
    // data-prompt is read by /creator-os/prompt-copy.js; without it the
    // buttons stay inert and the prompt text is still selectable.
    const copy = `<button class="ghost" type="button" data-copy>Copy</button><button class="ghost" type="button" data-copy data-close>Copy &amp; close</button>`;
    return `<div class="prompt" data-prompt="${esc(sample.prompt)}"><strong>${esc(sample.label)}</strong><span class="muted">${esc(sample.prompt)}</span><div class="row">${copy}${run}</div></div>`;
  }).join("");
  return `<p class="muted">Copy a prompt, close this, and paste it to your agent in iMessage — same conversation everywhere.</p><div class="prompts">${prompts}</div><details><summary>Or type your own</summary><form method="post" class="row"><input type="hidden" name="action" value="ask_agent"><input type="text" name="text" placeholder="e.g. What can you do for me?" maxlength="4000" enterkeyhint="send"><button>Send</button></form></details><div class="row actions">${skipForm("agent")}</div>`;
}

/** Browser-profile half of the `import` step, rendered as its own card. */
function browserBody(snapshot: OnboardingSnapshot): string {
  const browser = snapshot.browserProfile;
  const status = browser?.enabled
    ? `<div class="item"><span class="grow">Real profile browsing</span><span class="chip">on · ${esc(browser.browser ?? "browser")} · ${browser.files} files</span></div><p class="muted">Your agent browses with your logins and cookies. Run the command again after new sign-ins to re-sync; turning it off deletes the snapshot from your agent's computer.</p>`
    : `<div class="item"><span class="grow">Real profile browsing</span><span class="chip">off</span></div><p class="muted">By default the agent browses in a clean, throwaway profile — logged into nothing. Turn this on to let it browse as you: one command copies your default browser's <strong>active</strong> profile (cookies, saved logins, preferences — never your other profiles) straight to your agent's computer. Only enable it when you want the agent acting as you.</p>`;
  const command = snapshot.browserProfileCommand
    ? `<details><summary>${browser?.enabled ? "Re-sync my browser profile" : "Turn on real profile browsing"}</summary><p class="muted">Run in Terminal on the machine where you browse (Chrome, Edge, Brave, or Chromium; link valid ~30 minutes; on Windows fully quit the browser first):</p><pre>${esc(snapshot.browserProfileCommand)}</pre></details>`
    : "";
  const disable = browser?.enabled
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="disable_browser_profile"><button class="ghost">Turn off &amp; delete snapshot</button></form>`
    : "";
  return `${status}${command}${disable ? `<div class="row actions">${disable}</div>` : ""}`;
}

/**
 * Digital-twin wizard panels — the slide's six stepper steps. Each reads
 * and writes one of the five step IDs (consent/selfies/voice/twin/avatar);
 * the consent gate on every panel after the first is server-enforced too.
 */
function consentBody(snapshot: OnboardingSnapshot): string {
  const name = snapshot.username ?? "you";
  const facts = `<ul class="facts"><li><strong>You add</strong> photos, an optional short video, optional voice samples. They stay in your private vault; only short-lived links ever leave, and only to render.</li><li><strong>Your agent makes</strong> a character sheet and a profile image of @${esc(name)}, optional alternate looks, an optional voice clone, an optional talking video avatar.</li><li><strong>Who processes it</strong> OpenAI GPT Image 2 via GMI Cloud (images) · ElevenLabs (voice clone and speech) · fal.ai / MiniMax (video) · HeyGen only if you train a legacy avatar.</li><li><strong>How long it stays</strong> until you delete it — here, or from Settings. Deleting the voice clone removes it at ElevenLabs too.</li><li><strong>Your controls</strong> delete any file, revoke any consent below at any time, export everything from Settings.</li></ul>`;
  const pending = CONSENT_SCOPES.filter((scope) => !hasScope(snapshot, scope));
  const rows = CONSENT_SCOPES.map((scope) => {
    const copy = CONSENT_COPY[scope];
    const grant = consentFor(snapshot.consents, scope);
    const required = scope === "likeness";
    if (grant) {
      return `<div class="consent-row granted"><span class="pill ok">granted</span><span class="consent-text"><strong>${esc(copy.title)}</strong>${esc(copy.statement)}<span class="muted small">Granted ${esc(grant.granted_at.slice(0, 10))} · policy ${esc(grant.policy_version)}</span></span></div>`;
    }
    return `<label class="consent-row"><input type="checkbox" name="scope" value="${scope}"${required ? " required" : ""}><span class="consent-text"><strong>${esc(copy.title)}${required ? ' <span class="chip">required for the twin</span>' : ' <span class="chip">optional</span>'}</strong>${esc(copy.statement)}<span class="muted small">${esc(copy.detail)}</span></span></label>`;
  }).join("");
  const grantForm =
    pending.length > 0
      ? `<form method="post" class="stack consent-form"><input type="hidden" name="action" value="grant_consent"><fieldset class="consent-set"><legend class="subhead">What you allow</legend>${rows}</fieldset><p class="muted small">Only you can consent for yourself — these boxes are about your own face and voice, never someone else's. Policy ${esc(CONSENT_POLICY_VERSION)}.</p><button>Save my choices</button></form>`
      : `<div class="consent-set" aria-label="What you allow">${rows}</div>`;
  const revokes = CONSENT_SCOPES.filter((scope) => hasScope(snapshot, scope))
    .map(
      (scope) =>
        `<form method="post" class="inline"><input type="hidden" name="action" value="revoke_consent"><input type="hidden" name="scope" value="${scope}"><button class="ghost">Revoke ${esc(CONSENT_COPY[scope].title.toLowerCase())}</button></form>`
    )
    .join("");
  return `<p class="muted">Before anything is uploaded or generated, here is exactly what happens with your face and voice.</p>${facts}${grantForm}<div class="row actions">${revokes}${skipForm("consent", "Skip the twin for now")}</div>`;
}

function mediaBody(snapshot: OnboardingSnapshot, lite: boolean): string {
  const gate = consentGate(snapshot);
  const name = snapshot.username ?? "username";
  const photos = snapshot.identityMedia.filter(
    (m) => m.role === "selfie" && m.status === "ready" && m.url
  );
  const videos = snapshot.identityMedia.filter((m) => m.role === "reference_video");
  const selected = new Set(snapshot.identityReferenceAssetIds);
  const selectedCount = snapshot.identityReferenceAssetIds.length;
  // The live booth is an enhancement. Both native iPhone paths remain in
  // the document at all times, including when getUserMedia is unavailable.
  const booth = gate || lite ? "" : boothMount("photo");
  const photoUpload = gate
    ? ""
    : `<div class="native-capture" aria-label="Native photo capture">${uploadTile(
        {
          id: "twin-photo-camera",
          action: "upload_selfie",
          icon: "camera",
          title: "Take a photo",
          hint: "Opens the front camera",
          accept: PHOTO_ACCEPT,
          capture: "user",
          submit: "Save photo",
        }
      )}${uploadTile({
        id: "twin-photo-library",
        action: "upload_selfie",
        icon: "library",
        title: "Choose from Photos",
        hint: "Pick one from your library",
        accept: PHOTO_ACCEPT,
        submit: "Upload selected photo",
      })}<p class="muted small">PNG, JPEG, WebP or HEIC, 8 MB max. iPhone HEIC photos convert automatically.</p></div>`;
  const referenceGallery = photos.length === 0
    ? `<p class="muted">Recent photos appear here after you take or upload them.</p>`
    : `<form method="post" class="reference-gallery"><input type="hidden" name="action" value="set_identity_references"><fieldset><legend class="subhead">Choose ${MIN_IDENTITY_REFERENCES}–${MAX_IDENTITY_REFERENCES} photos for @${esc(name)}</legend><p class="muted">This private set creates your character sheet and anchors your own @${esc(name)} image requests. Other people only receive approved generated assets.</p><div class="reference-grid">${photos.map((photo, index) => `<label class="reference-card${selected.has(photo.assetId) ? " selected" : ""}"><input type="checkbox" name="asset_id" value="${esc(photo.assetId)}"${selected.has(photo.assetId) ? " checked" : ""}><img src="${esc(thumbHref(photo.assetId, 240))}" loading="lazy" decoding="async" alt="Recent photo ${index + 1}"><span class="reference-check" aria-hidden="true">✓</span><span class="reference-label">${esc(photo.source === "booth" ? "Booth photo" : "Uploaded photo")}</span></label>`).join("")}</div></fieldset><div class="row"><button>Use selected photos${selectedCount > 0 ? ` (${selectedCount})` : ""}</button></div></form>`;
  const videoUpload = gate
    ? ""
    : `<details><summary>Add a reference video (optional)</summary>${uploadTile(
        {
          id: "twin-video",
          action: "upload_media",
          role: "reference_video",
          icon: "video",
          title: "Add a reference video",
          hint: "Record or pick a clip",
          accept: "video/mp4,video/webm",
          capture: "user",
          submit: "Upload video",
        }
      )}<p class="muted small">MP4 or WebM, 50 MB max, 5–30 seconds. Talk or turn your head slowly — motion references help video generation.</p></details>`;
  return `${gate ?? ""}<p class="muted">Photos anchor @${esc(name)}'s identity for everything generated later. They live privately in your vault; you can delete them any time.</p><h3 class="subhead">Take or add a photo</h3>${booth}${photoUpload}<h3 class="subhead">Recent photos</h3>${referenceGallery}<details><summary>Manage saved photos</summary>${mediaList(photos, "No photos yet — step into the booth or upload one.")}</details><h3 class="subhead">Video</h3>${videoUpload}${mediaList(videos, "No reference video — optional.")}<p class="muted small">Voice samples live on the <a href="?step=voice">Voice</a> panel.</p><div class="row actions">${skipForm("selfies")}</div>`;
}

function generatedBody(snapshot: OnboardingSnapshot): string {
  if (!snapshot.username) {
    return `<p class="muted">Set a <a href="?step=username">username</a> first — the character sheet is bound to your @name.</p>`;
  }
  const gate = consentGate(snapshot);
  const name = snapshot.username;
  const photos = snapshot.identityMedia.filter((m) => m.role === "selfie" && m.status === "ready");
  const selectedCount = snapshot.identityReferenceAssetIds.length;
  const sheet = snapshot.identityMedia.find((m) => m.role === "character_sheet");
  const sheetDraft = snapshot.identityMedia.find((m) => m.role === "character_sheet_draft");
  const profile = snapshot.identityMedia.find((m) => m.role === "profile_image");
  const profileDraft = snapshot.identityMedia.find((m) => m.role === "profile_image_draft");
  const alternates = snapshot.identityMedia.filter((m) => m.role === "alt_image");
  const preview = (m: IdentityMediaView | undefined, alt: string): string =>
    m?.url ? `<img class="sheetpreview" src="${esc(m.url)}" loading="lazy" decoding="async" alt="${esc(alt)}">` : "";
  const reviewSheet = sheetDraft
    ? `<div class="sheetcard"><h3 class="subhead">Character sheet — review</h3>${preview(sheetDraft, "character sheet draft")}<p class="muted">Save it to your vault or discard it. Nothing is reused until you save.</p><div class="row"><form method="post" class="inline"><input type="hidden" name="action" value="save_character_sheet"><input type="hidden" name="asset_id" value="${esc(sheetDraft.assetId)}"><button>Save to vault</button></form><form method="post" class="inline"><input type="hidden" name="action" value="discard_character_sheet"><input type="hidden" name="asset_id" value="${esc(sheetDraft.assetId)}"><button class="ghost">Discard</button></form></div></div>`
    : "";
  const sheetCard = sheetDraft || gate
    ? ""
    : `<div class="sheetcard"><h3 class="subhead">Character sheet ${sheet ? pill("saved", "ok") : ""}</h3>${preview(sheet, "character sheet")}<p class="muted">A multi-view grid that keeps every later image consistent. It uses the ${selectedCount > 0 ? `${selectedCount} private photo${selectedCount === 1 ? "" : "s"} chosen in Reference media` : "photo set you choose in Reference media"}.</p><div class="row"><form method="post" class="inline"><input type="hidden" name="action" value="generate_character_sheet"><button${selectedCount > 0 ? "" : " disabled"}>${sheet ? "Regenerate from selected photos" : "Generate from selected photos"}</button></form></div>${selectedCount === 0 && photos.length > 0 ? `<p class="muted small">Choose 1–6 photos in <a href="?step=selfies">Reference media</a> first.</p>` : ""}<details><summary>Or describe an original agent</summary><form method="post" class="stack"><input type="hidden" name="action" value="generate_character_sheet"><label for="twin-description">Describe the agent's look</label><textarea id="twin-description" name="description" rows="3" maxlength="${DESCRIPTION_MAX_CHARS}" placeholder="e.g. a warm, curious guide in their thirties, silver-rimmed glasses, short dark curls, olive linen shirt"></textarea><button>Generate from description</button></form><p class="muted small">Describe an original character, not a real person.</p></details></div>`;
  const reviewProfile = profileDraft
    ? `<div class="sheetcard"><h3 class="subhead">Profile image — approve</h3>${preview(profileDraft, "profile image draft")}<p class="muted">This becomes @${esc(name)}'s face in /zap and /twin. Approve it or discard and try another style.</p><div class="row"><form method="post" class="inline"><input type="hidden" name="action" value="approve_profile_image"><input type="hidden" name="asset_id" value="${esc(profileDraft.assetId)}"><button>Approve</button></form><form method="post" class="inline"><input type="hidden" name="action" value="discard_profile_image"><input type="hidden" name="asset_id" value="${esc(profileDraft.assetId)}"><button class="ghost">Discard</button></form></div></div>`
    : "";
  const canProfile = Boolean(sheet || photos.length > 0);
  const profileCard = profileDraft || gate
    ? ""
    : `<div class="sheetcard"><h3 class="subhead">Profile image ${profile ? pill("approved", "ok") : ""}</h3>${preview(profile, "approved profile image")}<p class="muted">One reusable high-quality portrait, derived from your sheet or best photo. Renders at high quality on OpenAI GPT Image 2 and counts toward today's creative limit.</p><form method="post" class="stack"><input type="hidden" name="action" value="generate_profile_image"><label for="twin-style">Style (optional)</label><input id="twin-style" type="text" name="style" maxlength="${STYLE_MAX_CHARS}" placeholder="e.g. futuristic editorial, warm film grain"><button${canProfile ? "" : ' class="ghost"'}>${profile ? "Generate a new profile image" : "Generate profile image"}</button></form></div>`;
  const altCard = !profile || gate
    ? ""
    : `<div class="sheetcard"><h3 class="subhead">Alternate looks ${alternates.length > 0 ? pill(`${alternates.length} saved`, "ok") : ""}</h3><p class="muted">Extra outfits or settings, same person. They join your vault straight away.</p><form method="post" class="stack"><input type="hidden" name="action" value="generate_alt_image"><label for="twin-alt-style">Describe the look</label><input id="twin-alt-style" type="text" name="style" maxlength="${STYLE_MAX_CHARS}" placeholder="e.g. on stage under blue light, black turtleneck"><button class="ghost">Add an alternate look</button></form></div>`;
  return `${gate ?? ""}${reviewSheet}${reviewProfile}${sheetCard}${profileCard}${altCard}`;
}

function voiceBody(snapshot: OnboardingSnapshot, lite: boolean): string {
  if (!snapshot.voiceAvailable) {
    return `<p class="muted">Voice cloning isn't configured on this deployment — nothing here blocks the rest of setup.</p><div class="row actions">${skipForm("voice", "Skip — not configured")}</div>`;
  }
  const gate = consentGate(snapshot);
  const voiceConsent = hasScope(snapshot, "voice");
  const samples = snapshot.identityMedia.filter((m) => m.role === "voice_sample");
  const twin = snapshot.twin;
  const status = twin?.voice_status ?? "none";
  const optIn = !gate && !voiceConsent
    ? `<div class="locknote" role="status"><strong>Voice is opt-in.</strong> Tick “Voice clone” on the <a href="?step=consent">Consent &amp; privacy</a> panel to record samples and clone your voice.</div>`
    : "";
  const canCollect = !gate && voiceConsent;
  const booth = canCollect && !lite ? boothMount("audio") : "";
  const upload = canCollect
    ? `<details${lite ? " open" : ""}><summary>Upload a recording</summary>${uploadTile(
        {
          id: "twin-audio",
          action: "upload_media",
          role: "voice_sample",
          icon: "audio",
          title: "Upload a recording",
          hint: "MP3, M4A, WAV or OGG",
          accept:
            "audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.m4a,.mp3,.wav",
          submit: "Upload sample",
        }
      )}<p class="muted small">25 MB max. One to three clean clips, 30 seconds or more in total, in a quiet room, reading naturally.</p></details>`
    : "";
  const statusPill =
    status === "ready"
      ? pill("voice clone ready", "ok")
      : status === "pending"
        ? pill("awaiting verification at ElevenLabs", "pending")
        : status === "failed"
          ? pill("last attempt failed", "failed")
          : status === "revoked"
            ? pill("clone deleted", "off")
            : pill("no voice clone", "off");
  const error = twin?.voice_error && status === "failed"
    ? `<p class="muted">${esc(twin.voice_error)}</p>`
    : "";
  const cloneButton = canCollect && samples.length > 0 && status !== "ready"
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="create_voice_clone"><button>${status === "failed" ? "Retry voice clone" : "Create voice clone"}</button></form>`
    : "";
  const deleteButton = twin?.voice_id
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="delete_voice_clone"><button class="ghost">Delete voice clone</button></form>`
    : "";
  const cloneCard = `<div class="sheetcard"><h3 class="subhead">Voice clone ${statusPill}</h3><p class="muted">An ElevenLabs Instant Voice Clone made only from the samples above, only when you tap the button. It speaks for @${esc(snapshot.username ?? "you")} in /twin say. The voice id is stored server-side and never shown.</p>${error}<div class="row">${cloneButton}${deleteButton}</div></div>`;
  return `${gate ?? ""}${optIn}<p class="muted">Optional — give your twin your voice. Samples stay in your private vault until you delete them.</p><h3 class="subhead">Samples</h3>${booth}${upload}${mediaList(samples, "No voice samples yet.")}${cloneCard}<div class="row actions">${skipForm("voice")}</div>`;
}

function videoAvatarBody(snapshot: OnboardingSnapshot, lite: boolean): string {
  if (!snapshot.avatarAvailable && !snapshot.twinAvailable) {
    return `<p class="muted">Digital twin video isn't configured on this deployment — set it up later from Settings once it is. Nothing here blocks the rest of setup.</p><div class="row actions">${skipForm("twin", "Skip — not configured")}</div>`;
  }
  const gate = consentGate(snapshot);
  const twin = snapshot.twin;
  const name = snapshot.username ?? "you";
  const avatarConsent = hasScope(snapshot, "video_avatar");
  const profile = snapshot.identityMedia.find((m) => m.role === "profile_image");
  const voiceReady = twin?.voice_status === "ready";
  const sample = snapshot.identityMedia.some((m) => m.role === "voice_sample");
  const status = twin?.avatar_status ?? "off";
  const optIn = !gate && !avatarConsent
    ? `<div class="locknote" role="status"><strong>Video avatar is opt-in.</strong> Tick “Video avatar” on the <a href="?step=consent">Consent &amp; privacy</a> panel to render one.</div>`
    : "";
  const check = (ok: boolean, label: string, fix: string): string =>
    `<li>${ok ? pill("ready", "ok") : pill("missing", "off")} ${esc(label)}${ok ? "" : ` — ${fix}`}</li>`;
  const requirements = `<ul class="facts"><li class="muted small">What the avatar needs:</li>${check(Boolean(profile), "an approved profile image", '<a href="?step=selfies">generate one</a>')}${check(voiceReady || sample, "a voice", voiceReady ? "" : '<a href="?step=voice">clone your voice or add a sample</a>')}</ul>`;
  const statusPill =
    status === "ready"
      ? pill("video avatar ready", "ok")
      : status === "pending"
        ? pill("rendering", "pending")
        : status === "failed"
          ? pill("render failed", "failed")
          : pill("off", "off");
  const error = status === "failed" && twin?.avatar_error
    ? `<p class="muted">${esc(twin.avatar_error)}</p>`
    : "";
  const preview = snapshot.twinPreviewUrl
    ? `<video class="twin-preview" src="${esc(snapshot.twinPreviewUrl)}" controls playsinline preload="metadata" aria-label="video avatar preview"></video>`
    : "";
  const canEnable = snapshot.avatarAvailable && !gate && avatarConsent && Boolean(profile) && (voiceReady || sample) && status !== "pending";
  const enable = canEnable
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="enable_video_avatar"><button>${status === "failed" ? "Retry render" : status === "ready" ? "Re-render preview" : "Enable video avatar"}</button></form>`
    : "";
  const refresh = status === "pending"
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="refresh_twin"><button class="ghost">Refresh status</button></form>`
    : "";
  const disable = status !== "off"
    ? `<form method="post" class="inline"><input type="hidden" name="action" value="disable_video_avatar"><button class="ghost">Turn off</button></form>`
    : "";
  const avatarCard = snapshot.avatarAvailable
    ? `<div class="sheetcard"><h3 class="subhead">Video avatar ${statusPill}</h3><p class="muted">A talking video of @${esc(name)}: your approved profile image lip-synced to your voice on fal.ai (MiniMax H3 Max). Enabling it renders a short preview; /twin say then speaks any line you give it. Every video is labelled as synthetic.</p>${requirements}${error}${preview}<div class="row">${enable}${refresh}${disable}</div></div>`
    : "";
  // Legacy talking-head path (HeyGen through the GMI queue) stays reachable
  // for accounts that trained a look there; its consent recording is the
  // spoken attestation kept alongside the checkbox grant.
  const legacy = snapshot.twinAvailable
    ? `<details class="legacy"><summary>More options — recorded consent and trained avatar</summary>${twin?.consent_video_key ? `<p>Consent recording on file.</p>` : `${lite || gate ? "" : boothMount("video")}<p class="muted">Record or upload a short video of yourself saying you consent to a digital twin of your likeness.</p><form method="post" enctype="multipart/form-data" class="row"><input type="hidden" name="action" value="upload_consent"><label class="sr-only" for="twin-consent-video">Consent recording</label><input id="twin-consent-video" type="file" name="file" accept="video/mp4,video/webm" capture="user"><button>Upload consent</button></form>`}<form method="post" class="stack"><input type="hidden" name="action" value="create_twin"><label for="twin-legacy-script">Talking-head line (legacy renderer)</label><input id="twin-legacy-script" type="text" name="script" placeholder="What should @${esc(name)} say? (a sentence or two)" maxlength="500"><button class="ghost">Create talking-head video</button></form>${twin && twin.status !== "avatar_only" ? `<p class="muted">Legacy twin status: <strong>${esc(twin.status)}</strong>.</p>` : ""}</details>`
    : "";
  return `${gate ?? ""}${optIn}<p class="muted">Optional — a high-quality video avatar for @${esc(name)}.</p>${avatarCard}${legacy}<div class="row actions">${skipForm("twin")}</div>`;
}

function twinSummaryBody(snapshot: OnboardingSnapshot): string {
  if (!snapshot.username) {
    return `<p class="muted">Pick a <a href="?step=username">username</a> to build your digital twin — everything below is bound to your @name.</p>`;
  }
  const name = snapshot.username;
  const twin = snapshot.twin;
  const profile = snapshot.identityMedia.find((m) => m.role === "profile_image");
  const sheet = snapshot.identityMedia.find((m) => m.role === "character_sheet");
  const photos = snapshot.identityMedia.filter((m) => m.role === "selfie").length;
  const videos = snapshot.identityMedia.filter((m) => m.role === "reference_video").length;
  const samples = snapshot.identityMedia.filter((m) => m.role === "voice_sample").length;
  const alternates = snapshot.identityMedia.filter((m) => m.role === "alt_image").length;
  const hero = profile?.url
    ? `<img class="twin-hero-img" src="${esc(thumbHref(profile.assetId, 96))}" width="88" height="88" loading="lazy" decoding="async" alt="@${esc(name)} profile image">`
    : `<span class="twin-hero-img placeholder" aria-hidden="true">@</span>`;
  const counts = [
    `${photos} photo${photos === 1 ? "" : "s"}`,
    `${videos} video${videos === 1 ? "" : "s"}`,
    `${samples} voice sample${samples === 1 ? "" : "s"}`,
    ...(alternates > 0 ? [`${alternates} alternate look${alternates === 1 ? "" : "s"}`] : []),
  ].join(" · ");
  const rows = [
    ["Character sheet", sheet ? pill("saved", "ok") : pill("none", "off")],
    ["Profile image", profile ? pill("approved", "ok") : pill("none", "off")],
    [
      "Voice",
      twin?.voice_status === "ready"
        ? pill("cloned", "ok")
        : twin?.voice_status === "pending"
          ? pill("pending", "pending")
          : pill("none", "off"),
    ],
    [
      "Video avatar",
      twin?.avatar_status === "ready"
        ? pill("ready", "ok")
        : twin?.avatar_status === "pending"
          ? pill("rendering", "pending")
          : pill("off", "off"),
    ],
  ]
    .map(([label, value]) => `<li><span class="grow">${esc(label ?? "")}</span>${value ?? ""}</li>`)
    .join("");
  const preview = snapshot.twinPreviewUrl
    ? `<video class="twin-preview" src="${esc(snapshot.twinPreviewUrl)}" controls playsinline preload="metadata" aria-label="video avatar preview"></video>`
    : "";
  const sharing = twin?.sharing === "public";
  const privacy = `<div class="row"><form method="post" class="inline"><input type="hidden" name="action" value="set_sharing"><input type="hidden" name="sharing" value="${sharing ? "private" : "public"}"><button class="ghost">${sharing ? "Make @" + esc(name) + " private" : "Allow others to reference @" + esc(name)}</button></form><a class="navlink" href="?step=consent">Manage consent</a><a class="navlink" href="?step=selfies">Manage media</a></div><p class="muted small">${sharing ? "Public: other people's /zap can use your profile image and character sheet. Your voice is never shared." : "Private: only you can reference @" + esc(name) + "."}</p>`;
  const examples = [
    `/zap Create a cinematic portrait using @${name}`,
    `/zap Make a short product video starring @${name}`,
    `/twin say Welcome to AirV2`,
    `/twin Create a profile image in a futuristic editorial style`,
  ]
    .map(
      (prompt) =>
        `<div class="prompt" data-prompt="${esc(prompt)}"><code>${esc(prompt)}</code><div class="row"><button class="ghost" type="button" data-copy>Copy</button></div></div>`
    )
    .join("");
  return `<div class="twin-summary"><div class="twin-hero">${hero}<div><strong>@${esc(name)}</strong><p class="muted">${esc(counts)}</p></div></div><ul class="facts status">${rows}</ul>${preview}<h3 class="subhead">Privacy</h3>${privacy}<h3 class="subhead">Use it</h3><p class="muted">In iMessage or the web chat, <strong>/zap</strong> makes any video and can star @${esc(name)}; <strong>/twin</strong> speaks or poses as your twin.</p><div class="prompts">${examples}</div><p class="muted small">Voice and video made from your twin are synthetic — say so when you share them.</p></div>`;
}

/**
 * Whether a stepper panel's own stage is genuinely complete — drives the
 * green checks on the in-slide stepper. Booth panels check the artifact each
 * stage produces; generic sections fall back to their steps' statuses.
 */
function sectionDone(
  snapshot: OnboardingSnapshot,
  key: SlideSectionKey
): boolean {
  const hasVaultMedia = snapshot.identityMedia.some(isVaultMedia);
  const hasProfileImage = snapshot.identityMedia.some(
    (m) => m.role === "profile_image"
  );
  if (key === "consent") return hasScope(snapshot, "likeness");
  if (key === "booth_photo") return hasVaultMedia;
  if (key === "sheet" || key === "twin_summary") return hasProfileImage;
  if (key === "voice") return snapshot.twin?.voice_status === "ready";
  if (key === "twin_create")
    return Boolean(
      snapshot.twin?.avatar_status === "ready" ||
        (snapshot.twin && snapshot.twin.status !== "avatar_only")
    );
  if (key === "avatar")
    return Boolean(
      snapshot.avatarAssetId || snapshot.twin?.provider_avatar_id
    );
  return SECTION_STEPS[key].every(
    (step) => effectiveStatus(snapshot, step) === "done"
  );
}

/** Renders one slide section — a step body, or a composite of several. */
function sectionBody(
  snapshot: OnboardingSnapshot,
  key: SlideSectionKey,
  browserSignin: string | null,
  lite: boolean
): string {
  if (key === "computer") return computerBody(snapshot);
  if (key === "browser") return browserBody(snapshot);
  if (key === "booth_photo") return mediaBody(snapshot, lite);
  if (key === "sheet") return generatedBody(snapshot);
  if (key === "twin_create") return videoAvatarBody(snapshot, lite);
  if (key === "twin_summary") return twinSummaryBody(snapshot);
  return stepBody(snapshot, key, browserSignin, lite);
}

/**
 * Slide-deck shell — one slide per step, painted from theme tokens
 * (../themes.ts, documented in docs/design.md). Everything visual comes from
 * `var(--token)`, so a future Settings theme selector swaps the look without
 * touching this markup. The CSP is derived from the active theme and only
 * widens for what that theme's own first-party assets need; publisher apps
 * keep the strict script-free shell in ../html.
 */
function slides(
  current: Theme,
  body: string,
  nativeOnairos = false,
  identityMedia = false,
  booth = false,
  prompts = false,
  intro = false,
  swipe = false
): NextResponse {
  const headers = baseHeaders();
  // The Onairos slide runs the vendor SDK bundle (served same-origin) which
  // talks to the Onairos API and inlines its icons as data: URLs — widen
  // only there, only by what the SDK needs.
  let csp = themeCsp(current);
  // Every non-cinematic slide ships the same-origin tap-feedback bundle, so
  // script-src is part of the baseline rather than something each widening
  // below has to remember to add.
  if (!csp.includes("script-src")) csp += "; script-src 'self'";
  // The deck's own rules (buttons, panels, the stepper, uploaders — Stage 3)
  // load from /creator-os/onboarding.css, a cached same-origin stylesheet,
  // rather than shipping inline on every no-store render. 'unsafe-inline'
  // alone does not cover a <link rel="stylesheet">.
  csp = csp.replace("style-src 'unsafe-inline'", "style-src 'unsafe-inline' 'self'");
  if (nativeOnairos) {
    if (!csp.includes("script-src")) csp += "; script-src 'self'";
    // The SDK loads Google Identity Services for its Google sign-in path
    // (allowances per https://developers.google.com/identity/gsi/web/guides/csp).
    csp = csp.replace(
      "script-src 'self'",
      "script-src 'self' https://accounts.google.com/gsi/client"
    );
    csp = csp.replace(
      "style-src 'unsafe-inline' 'self'",
      "style-src 'unsafe-inline' 'self' https://accounts.google.com/gsi/style"
    );
    if (!csp.includes("img-src 'self' data:")) {
      csp = csp.replace("img-src 'self'", "img-src 'self' data:");
    }
    // 'self' covers the same-origin Onairos relay (/api/mini/onairos) the
    // SDK bundle is built against; the direct hosts stay for popup flows.
    csp +=
      "; connect-src 'self' https://api2.onairos.uk https://api.onairos.uk https://accounts.google.com/gsi/";
    csp += "; frame-src https://accounts.google.com/gsi/";
  }
  if (identityMedia) {
    // Identity slides preview private assets via short-TTL signed storage
    // URLs (https:) — the mediaShellHtml pattern from apps/video.tsx.
    csp = csp.replace("img-src 'self'", "img-src 'self' https:");
    csp += "; media-src https:";
  }
  if (booth) {
    // The photo booth is a same-origin bundle: camera frames render from
    // in-memory blob: URLs and finalization posts back via fetch — widen
    // only by what that first-party code needs.
    if (!csp.includes("script-src")) csp += "; script-src 'self'";
    csp = csp.replace(/img-src ([^;]+)/, "img-src $1 blob:");
    csp = csp.includes("media-src")
      ? csp.replace(/media-src ([^;]+)/, "media-src $1 blob:")
      : csp + "; media-src blob:";
    csp += "; connect-src 'self'";
  }
  if (prompts) {
    // Get started ships a same-origin bundle whose only powers are the
    // clipboard and window.close() — no network, no other origins.
    if (!csp.includes("script-src")) csp += "; script-src 'self'";
  }
  if (swipe) {
    // Every full (non-lite) slide ships the same-origin swipe-navigation
    // bundle — its only power is location.assign to server-rendered hrefs.
    if (!csp.includes("script-src")) csp += "; script-src 'self'";
  }
  if (intro) {
    // The welcome film is a first-party file under /creator-os, and the
    // cinematic intro ships a same-origin bundle regardless of the theme.
    csp = csp.includes("media-src")
      ? csp.replace(/media-src ([^;]+)/, "media-src $1 'self'")
      : csp + "; media-src 'self'";
    if (!csp.includes("script-src")) csp += "; script-src 'self'";
  }
  // Chrome enforces form-action on the redirect that follows a form POST, so
  // the Composio connect and Stripe onboarding redirects to their hosted
  // pages must be allowed here.
  headers["Content-Security-Policy"] =
    `${csp}; form-action 'self' https://*.composio.dev https://connect.stripe.com https://*.stripe.com; frame-ancestors 'self' ${env.appOrigin()}`;
  return new NextResponse(body, {
    status: 200,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}


/**
 * Messages-extension webviews run under a tight memory/GPU budget — iOS
 * kills the extension (“Unable to Load App”, frozen snapshot) when a page is
 * too heavy. Card-opened sessions therefore render without the shader
 * backdrop, grain, blur, and slide animation.
 */
const LITE_CSS = `
.logo-pill,.counter,.panel,.navlink{backdrop-filter:none;-webkit-backdrop-filter:none}
html{background-attachment:scroll}
main.slide,main.slide .kicker,main.slide h1,main.slide .panel{animation:none}
`;

const STEPPER_CHECK =
  '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
  '<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * A multi-section slide as a stepper, rendered by the server: numbered
 * indicators joined by connectors, a green check on the stages the snapshot
 * reports done, exactly one panel, and Previous/Continue.
 *
 * Only the open panel is in the document. The five it leaves out are the
 * point: the booth's panels carry signed photo, character-sheet and avatar
 * previews, and shipping all of them on one render is what pushes an
 * embedded webview past its memory budget. Every control is a link or a
 * form, so this needs no JavaScript at all.
 */
interface StepperTarget {
  href: string | null;
  label: string;
}

/**
 * Where a stepped slide's Previous and Continue go. The ends of the stepper
 * hand off to the deck: the first panel's Previous steps back a slide, the
 * last panel's Continue steps forward a slide. A swipe reads the same pair,
 * so the gesture moves through the stages rather than jumping the slide and
 * skipping them.
 */
function stepperTargets(
  slide: OnboardingSlide,
  activeSection: number,
  panelHref: (section: SlideSection) => string,
  slideNav: { prev: string | null; next: string | null }
): { back: StepperTarget; forward: StepperTarget } {
  const index = stepperIndex(slide, activeSection);
  const previous = slide.sections[index - 1];
  const next = slide.sections[index + 1];
  return {
    back: previous
      ? { href: panelHref(previous), label: "Previous" }
      : { href: slideNav.prev, label: "Previous slide" },
    forward: next
      ? { href: panelHref(next), label: "Continue" }
      : { href: slideNav.next, label: "Next slide" },
  };
}

function stepperIndex(slide: OnboardingSlide, activeSection: number): number {
  return Math.min(slide.sections.length - 1, Math.max(0, activeSection));
}

function stepperHtml(
  snapshot: OnboardingSnapshot,
  slide: OnboardingSlide,
  activeSection: number,
  card: (section: SlideSection) => string,
  panelHref: (section: SlideSection) => string,
  slideNav: { prev: string | null; next: string | null }
): string {
  const index = stepperIndex(slide, activeSection);
  const head = slide.sections
    .map((section, i) => {
      const done = sectionDone(snapshot, section.key);
      const cls = ["stepper-ind", i === index ? "active" : "", done ? "complete" : ""]
        .filter(Boolean)
        .join(" ");
      const label = section.label ?? slide.title;
      const line =
        i === 0
          ? ""
          : `<span class="stepper-line${
              sectionDone(snapshot, slide.sections[i - 1]!.key) ? " complete" : ""
            }" aria-hidden="true"><i></i></span>`;
      const body = done ? STEPPER_CHECK : String(i + 1);
      const aria = i === index ? ' aria-current="step"' : "";
      return `${line}<a class="${cls}" href="${panelHref(section)}"${aria} aria-label="${esc(label)}" title="${esc(label)}">${body}</a>`;
    })
    .join("");
  const section = slide.sections[index]!;
  const targets = stepperTargets(slide, index, panelHref, slideNav);
  const back = targets.back.href
    ? `<a class="btn ghost" href="${targets.back.href}">${targets.back.label}</a>`
    : `<span class="btn ghost is-disabled" aria-disabled="true">Previous</span>`;
  const forward = targets.forward.href
    ? `<a class="btn" href="${targets.forward.href}">${targets.forward.label}</a>`
    : "";
  return `<nav class="stepper-head" aria-label="${esc(slide.title)} steps">${head}</nav>${card(
    section
  )}<div class="stepper-nav">${back}<span class="spacer"></span>${forward}</div>`;
}

export function renderOnboarding(
  current: Theme,
  snapshot: OnboardingSnapshot,
  active: OnboardingStepId,
  notice: string | null,
  lite = false,
  browserSignin: string | null = null,
  panel: string | null = null,
  fx = true
): string {
  // The deck navigates by slide; `active` stays a step ID so deep links,
  // agent-side tools, and post-action redirects keep addressing sub-steps.
  // Deep links into locked slides land on the Computer slide's username gate.
  const requestedSlide = slideForStep(active);
  const slide = slideLocked(snapshot, requestedSlide)
    ? SLIDE_GROUPS.find((s) => s.id === "computer") ?? requestedSlide
    : requestedSlide;
  const shownStep: OnboardingStepId =
    slide !== requestedSlide ? "username" : active;
  const index = SLIDE_GROUPS.indexOf(slide);
  const prev = index > 0 ? SLIDE_GROUPS[index - 1] : null;
  const nextSlide =
    index < SLIDE_GROUPS.length - 1 ? SLIDE_GROUPS[index + 1] : null;
  const next =
    nextSlide && slideLocked(snapshot, nextSlide) ? null : nextSlide;
  const pad = (n: number): string => String(n).padStart(2, "0");
  // The welcome intro is unnumbered — the counter reads N / 06 over the six
  // grouped slides, matching the "six short steps" welcome copy.
  const numbered = SLIDE_GROUPS.filter((s) => s.id !== "welcome");
  const number = numbered.indexOf(slide);
  const counter =
    number === -1 ? "Intro" : `${pad(number + 1)} / ${pad(numbered.length)}`;
  const kickerNumber = number === -1 ? "" : `${pad(number + 1)} / `;
  // Keep a non-default theme across slide navigation.
  const href = (target: OnboardingSlide): string => {
    const step = slideSteps(target)[0] ?? "welcome";
    return current.id === DEFAULT_THEME
      ? `?step=${esc(step)}`
      : `?step=${esc(step)}&amp;theme=${esc(current.id)}`;
  };
  // A stepper panel addresses itself by step *and* section key, so a slide
  // whose sections share a step still lands on the right one.
  const panelHref = (target: SlideSection): string => {
    const step = SECTION_STEPS[target.key][0] ?? "welcome";
    const theme =
      current.id === DEFAULT_THEME ? "" : `&amp;theme=${esc(current.id)}`;
    return `?step=${esc(step)}&amp;panel=${esc(target.key)}${theme}`;
  };
  // iPhone-style page dots: swipe (or tap a dot) to move between slides and
  // skip anything — except that slides past Computer stay locked until the
  // username (agent mailbox) exists.
  const dots = numbered.map((target, i) => {
    const status = slideStatus(snapshot, target);
    const cls = [
      target === slide ? "active" : "",
      status === "done" ? "done" : status === "skipped" ? "skipped" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const label = `aria-label="${pad(i + 1)} ${esc(target.title)}" title="${esc(target.title)}"`;
    if (slideLocked(snapshot, target)) {
      return `<span class="locked" ${label}></span>`;
    }
    return `<a href="${href(target)}"${cls ? ` class="${cls}"` : ""} ${label}></a>`;
  }).join("");
  const noticeHtml = notice
    ? `<div class="notice">${esc(notice)}</div>`
    : "";
  const busy = snapshot.boxBusy
    ? '<div class="notice">Your agent\'s computer is busy starting up — progress will save once it\'s awake.</div>'
    : "";
  const status = slideStatus(snapshot, slide);
  const statusTag =
    status === "done"
      ? " · done"
      : status === "skipped"
        ? " · skipped"
        : "";
  // Self-hosted and inline: no third-party stylesheet between the response
  // and first paint (the faces themselves load with font-display:swap).
  const fonts =
    current.fontFaces === null ? "" : `<style>${current.fontFaces}</style>`;
  // Each section is one card; a slide is the concatenation of the bodies of
  // the steps it owns, so every sub-step keeps its own forms and actions.
  const card = (section: SlideSection): string => {
    const heading = section.label
      ? `<h2 class="subhead">${esc(section.label)}</h2>`
      : "";
    const done = sectionDone(snapshot, section.key) ? " data-step-done" : "";
    const step = SECTION_STEPS[section.key][0] ?? "";
    const stepAttr = step ? ` data-step="${esc(step)}"` : "";
    const sectionAttr = ` data-section="${esc(section.key)}"`;
    return `<section class="panel"${done}${stepAttr}${sectionAttr}>${heading}${sectionBody(snapshot, section.key, browserSignin, lite)}</section>`;
  };
  // Sections that declare a pane render inside a scroll-snap pager — the
  // Photo Booth's photo/video two-part flow — with a segmented control on
  // top; anchors + CSS scroll-snap keep it working without JS, and lite
  // (Messages webview) renders stay a plain stack.
  const panes = lite
    ? []
    : [...new Set(slide.sections.map((s) => s.pane).filter(Boolean))] as string[];
  // A stacked multi-section slide (no pager, no split columns) renders as a
  // stepper: indicator circles, one panel, Previous/Continue. The panels it
  // is not showing are left out of the document rather than hidden with CSS
  // — the booth alone was shipping six panels and every signed photo,
  // character sheet and avatar frame in them on a single render, which is
  // what an embedded Messages webview runs out of memory on.
  const stepper =
    !slide.split && panes.length <= 1 && slide.sections.length > 1;
  // Every surface gets the cinematic welcome. The WebGL wordmark blast is
  // separately gated below, so the Messages mini-app keeps the film without
  // creating a GPU context.
  const cinematic = slide.id === "welcome";
  const allowBlast = cinematic && !lite && fx;
  const backdrop = current.backdrop;
  // The WebGL backdrop is decorative and expensive: a GPU context plus its
  // textures, on top of everything else the slide holds. It runs on desktop
  // browsers only — handhelds and Messages webviews keep the canvas
  // gradient, which is what the element falls back to anyway.
  const canShade = !lite && fx;
  const shader =
    !cinematic && backdrop.kind === "shader" && canShade
      ? `<script src="${esc(backdrop.script)}" defer></script>`
      : "";
  // The shader element paints itself; if fx.js or WebGL is unavailable it
  // stays an empty inert box and the canvas gradient carries the page.
  const backdropHtml =
    !cinematic && backdrop.kind === "shader" && canShade
      ? backdrop.element.replace("<wz-sky", '<wz-sky class="backdrop"')
      : "";
  const grain =
    !cinematic && backdrop.grain && canShade
      ? '<div class="grain" aria-hidden="true"></div>'
      : "";
  const scrim =
    !cinematic && current.tokens.scrim !== "none"
      ? '<div class="scrim" aria-hidden="true"></div>'
      : "";
  // A pending character-sheet draft pulls the booth to its review panel —
  // generate/confirm actions land back on ?step=selfies, which would
  // otherwise reopen the first panel and hide the Save/Discard controls.
  const draftPending =
    slide.id === "booth" &&
    shownStep === "selfies" &&
    snapshot.identityMedia.some(
      (m) => m.role === "character_sheet_draft" || m.role === "profile_image_draft"
    );
  // `?panel=` addresses a section directly — several sections can share one
  // step (the booth's Reference media and Generated identity are both
  // `selfies`), so the step alone cannot say which one is open. Forms carry
  // it for free: they post to the current URL, query string included.
  const requestedPanel =
    slide === requestedSlide && panel
      ? slide.sections.findIndex((s) => s.key === panel)
      : -1;
  const activeSection = draftPending
    ? slide.sections.findIndex((s) => s.key === "sheet")
    : requestedPanel >= 0
      ? requestedPanel
      : Math.max(
          0,
          slide.sections.findIndex((s) => SECTION_STEPS[s.key].includes(shownStep))
        );
  const sections =
    panes.length > 1
      ? (() => {
          const paneId = (pane: string): string =>
            `pane-${pane.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          const seg = panes
            .map(
              (pane, i) =>
                `<a href="#${paneId(pane)}"${i === 0 ? ' class="on"' : ""}>${esc(pane)}</a>`
            )
            .join("");
          const paged = panes
            .map(
              (pane) =>
                `<div class="pane" id="${paneId(pane)}">${slide.sections
                  .filter((s) => s.pane === pane)
                  .map(card)
                  .join("")}</div>`
            )
            .join("");
          const rest = slide.sections.filter((s) => !s.pane).map(card).join("");
          return `<div class="seg" role="tablist" aria-label="${esc(slide.title)} modes">${seg}</div><div class="pager">${paged}</div>${rest}`;
        })()
      : stepper
        ? stepperHtml(snapshot, slide, activeSection, card, panelHref, {
            prev: prev ? href(prev) : null,
            next: next ? href(next) : null,
          })
        : slide.sections.map(card).join("");
  // The stepper shows one panel, so the camera bundle follows the panel and
  // not the slide: it is 200 KB, and four of the booth's six stages mount no
  // booth at all.
  const boothPanel =
    slide.id === "booth" &&
    ["booth_photo", "voice", "twin_create"].includes(
      slide.sections[activeSection]?.key ?? ""
    );
  // Same-origin bundles, one per slide that needs one.
  const scripts = [
    !lite && boothPanel
      ? '<script src="/creator-os/identity-booth.js" defer></script>'
      : "",
    slide.id === "start"
      ? '<script src="/creator-os/prompt-copy.js" defer></script>'
      : "",
    // The deck swipes like an iPhone: a horizontal touch swipe anywhere on
    // the slide navigates back/forward (same-origin bundle, touch only).
    lite ? "" : '<script src="/creator-os/deck-swipe.js" defer></script>',
    // The cinematic welcome intro: press-and-hold escalation into the film,
    // then a programmatic submit of the hidden done-form.
    cinematic
      ? '<script src="/creator-os/intro-cinematic.js" defer></script>'
      : "",
    // Every control on a slide is a link or a form post, so a tap costs a
    // round trip before the screen changes. This marks the pressed control
    // busy and swallows the repeat tap that a silent wait invites.
    cinematic ? "" : '<script src="/creator-os/deck-pending.js" defer></script>',
    // The server's load line stops at the response. This reports what the
    // surface did with it — transfer, first paint, and how many bytes of
    // image the page went on to pull.
    '<script src="/creator-os/deck-timing.js" defer></script>',
  ].join("");
  if (cinematic) {
    const notices =
      busy || noticeHtml
        ? `<div class="cine-notices">${busy}${noticeHtml}</div>`
        : "";
    const intro = sectionBody(snapshot, "welcome", browserSignin, lite);
    return `<!doctype html><html lang="en" class="cine-page"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Onboarding — ${esc(slide.title)}</title>${fonts}<link rel="stylesheet" href="/creator-os/onboarding.css"><style>${tokenBlock(current.tokens)}</style></head><body class="cine-page" data-allow-blast="${allowBlast ? "true" : "false"}"${prev ? ` data-swipe-prev="${href(prev)}"` : ""}${next ? ` data-swipe-next="${href(next)}"` : ""}>${notices}${intro}${scripts}</body></html>`;
  }
  const deck = `<div class="deck${slide.split ? " split" : ""}"${stepper ? ` data-stepper data-stepper-active="${activeSection}"` : ""}>${sections}</div>${scripts}`;
  // A swipe follows the same pair of targets the visible Previous/Continue
  // do, so on a stepped slide it walks the stages instead of jumping the
  // whole slide and skipping them.
  const swipe = stepper
    ? (() => {
        const targets = stepperTargets(slide, activeSection, panelHref, {
          prev: prev ? href(prev) : null,
          next: next ? href(next) : null,
        });
        return { prev: targets.back.href, next: targets.forward.href };
      })()
    : { prev: prev ? href(prev) : null, next: next ? href(next) : null };
  const swipeAttrs = `${swipe.prev ? ` data-swipe-prev="${swipe.prev}"` : ""}${
    swipe.next ? ` data-swipe-next="${swipe.next}"` : ""
  }`;

  // A stepped slide already owns Previous/Continue. Its footer keeps the
  // deck dots — where you are across the six slides — and drops the
  // Back/Next links, which would otherwise stack a second, differently
  // scoped navigation under the stepper's own.
  const footer = stepper
    ? `<footer class="nav dots-only"><nav class="dots" aria-label="Slides">${dots}</nav></footer>`
    : `<footer class="nav">${prev ? `<a class="navlink" href="${href(prev)}">← Back</a>` : '<span class="navlink ghosted">← Back</span>'}<nav class="dots" aria-label="Slides">${dots}</nav>${next ? `<a class="navlink" href="${href(next)}">Next →</a>` : '<span class="navlink ghosted">Next →</span>'}</footer>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Onboarding — ${esc(slide.title)}</title>${fonts}<link rel="stylesheet" href="/creator-os/onboarding.css"><style>${tokenBlock(current.tokens)}${lite ? LITE_CSS : ""}</style>${shader}</head><body>${backdropHtml}${scrim}${grain}<div class="frame"${swipeAttrs}><header class="bar"><span class="logo-pill">${WORDMARK_IMG}</span><span class="counter">${counter}${esc(statusTag)}</span></header><main class="slide">${busy}${noticeHtml}<p class="kicker">${kickerNumber}${esc(slide.kicker)}</p><h1>${esc(slide.title)}</h1>${deck}</main>${footer}</div></body></html>`;
}

/** The step the URL asks for, if it names a real one. */
function requestedStep(ctx: MiniAppContext): OnboardingStepId | null {
  const requested = ctx.request.nextUrl.searchParams.get("step") ?? "";
  return isOnboardingStep(requested) ? requested : null;
}

/**
 * The stepper panel the URL asks for, if it names a real section. Forms post
 * to the current URL, so an action keeps the panel it was fired from without
 * every form having to carry it as a hidden field.
 */
/**
 * Whether this render may run the theme's WebGL backdrop. Desktop browsers
 * only — see isHandheld; an unknown agent counts as handheld.
 */
function allowsFx(ctx: MiniAppContext): boolean {
  return !isHandheld(ctx.request.headers.get("user-agent"));
}

function requestedPanelKey(ctx: MiniAppContext): string | null {
  const requested = ctx.request.nextUrl.searchParams.get("panel") ?? "";
  return requested in SECTION_STEPS ? requested : null;
}

/**
 * Theme selection. `?theme=` is the seam the Settings theme selector will
 * drive once the preference is stored; an unknown value falls back to the
 * default rather than reflecting query text into the document.
 */
function activeTheme(ctx: MiniAppContext): Theme {
  const requested = ctx.request.nextUrl.searchParams.get("theme") ?? "";
  return theme(isThemeId(requested) ? requested : DEFAULT_THEME);
}

/**
 * Signed jump into the real browser for the Onairos slide — Google refuses
 * OAuth inside embedded webviews (disallowed_useragent), so a card-opened
 * Messages sheet gets a link that finishes the sign-in in Safari. Multi-use
 * within its TTL, minted per render, never stored.
 */
function browserSigninHref(
  ctx: MiniAppContext,
  snapshot: OnboardingSnapshot,
  active: OnboardingStepId
): string | null {
  if (ctx.session.via !== "card") return null;
  if (
    slideForStep(active).id !== "apps" &&
    !rendersNativeOnairos(snapshot, active)
  ) {
    return null;
  }
  const token = mintToken(
    ctx.session.userId,
    "onboarding",
    ctx.session.resourceId,
    15
  );
  return `${env.appOrigin()}/mini/onboarding?t=${token}`;
}

/** Identity slides (and the twin summary on Get started) preview signed
 * private media — the CSP widens only for those renders. */
const rendersIdentityMedia = (step: OnboardingStepId): boolean =>
  slideForStep(step).id === "booth" || slideForStep(step).id === "start";

/** The selfies/twin slides mount the same-origin photo booth — never in
 * lite/Messages card sessions (tight memory/GPU budget, no camera UX). */
const rendersBooth = (step: OnboardingStepId, lite: boolean): boolean =>
  !lite && slideForStep(step).id === "booth";

/** The Onairos slide mounts the vendor SDK whenever the key is configured —
 * connected accounts keep it mounted to add more connectors — and the CSP
 * widens only for that render. */
function rendersNativeOnairos(
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId
): boolean {
  return slideForStep(step).id === "personality" && snapshot.onairos.available;
}

/** The Get started slide ships the same-origin clipboard/close bundle. */
const rendersPrompts = (step: OnboardingStepId): boolean =>
  slideForStep(step).id === "start";

/** The welcome slide plays the intro film from /creator-os on every surface. */
const rendersIntro = (step: OnboardingStepId): boolean =>
  slideForStep(step).id === "welcome";

/**
 * The link slide renders the transient pairing phrase and verification URL,
 * which are never mirrored to Postgres — fetch the live doc from the Box
 * only when that slide is about to render mid-pairing.
 */
async function withLiveLink(
  supabase: SupabaseClient,
  userId: string,
  snapshot: OnboardingSnapshot,
  active: OnboardingStepId
): Promise<void> {
  if (active !== "link" || snapshot.boxBusy) return;
  if (!snapshot.linkPairing || snapshot.link?.authenticated) return;
  if (snapshot.link?.phrase || snapshot.link?.verification_url) return;
  const live = await readLinkAuthDoc(supabase, userId).catch(() => null);
  if (live) {
    snapshot.link = live;
    await writeStatusMirror(supabase, userId, { link: live });
  }
}

/**
 * Legacy thread labels are message content: they render only on the owner's
 * iMessage slide, straight from the Box. The mirror carries just the count,
 * and a sleeping computer is never woken to fetch them.
 */
async function withLiveResolutions(
  snapshot: OnboardingSnapshot,
  active: OnboardingStepId
): Promise<void> {
  if (active !== "imessage" || snapshot.boxBusy || !snapshot.awakeBoxId) return;
  if (!((snapshot.ingest?.pending_resolutions ?? 0) > 0)) return;
  snapshot.resolutions = await readBoxResolutionView(snapshot.awakeBoxId).catch(() => null);
}

async function respond(
  ctx: MiniAppContext,
  step: OnboardingStepId | null,
  notice: string | null
): Promise<NextResponse> {
  const { snapshot, active } = await snapshotForRender(
    ctx.supabase,
    ctx.session.userId,
    step
  );
  const current = activeTheme(ctx);
  await withLiveLink(ctx.supabase, ctx.session.userId, snapshot, active);
  await withLiveResolutions(snapshot, active);
  return slides(
    current,
    renderOnboarding(
      current,
      snapshot,
      active,
      notice,
      ctx.session.via === "card",
      browserSigninHref(ctx, snapshot, active),
      requestedPanelKey(ctx),
      allowsFx(ctx)
    ),
    rendersNativeOnairos(snapshot, active),
    rendersIdentityMedia(active),
    rendersBooth(active, ctx.session.via === "card"),
    rendersPrompts(active),
    rendersIntro(active),
    ctx.session.via !== "card"
  );
}

/** The owner's username, or null before the Computer slide is done. */
async function currentUsername(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (user as { username?: unknown } | null)?.username;
  return typeof username === "string" && username ? username : null;
}

/** Fields the timing beacon may report, and the ceiling each is clamped to.
 * Anything absent, unparseable, negative or over its ceiling is dropped —
 * a client number reaches the log only as a bounded integer. */
const TIMING_FIELDS: Record<string, number> = {
  ttfb_ms: 600_000,
  transfer_ms: 600_000,
  dom_ms: 600_000,
  load_ms: 600_000,
  fp_ms: 600_000,
  fcp_ms: 600_000,
  doc_bytes: 100_000_000,
  img_bytes: 1_000_000_000,
  img_count: 1_000,
  other_bytes: 1_000_000_000,
  device_memory: 1_024,
};

/**
 * The client half of the load picture (lib/miniapps/client/deck-timing.ts):
 * transfer, first paint, and the image bytes the page pulled after the
 * document landed. Pairs with the server's `miniapp load` line, which stops
 * at the response.
 *
 * Client-reported numbers are never trusted, only bounded: each field is
 * parsed, floored to an integer and clamped, and nothing else on the form
 * is read. The reply is an empty 204 — a beacon has no page to render.
 */
function logClientTiming(
  ctx: MiniAppContext,
  form: FormData
): NextResponse {
  const metrics: Record<string, number> = {};
  for (const [field, ceiling] of Object.entries(TIMING_FIELDS)) {
    const entry = form.get(field);
    if (entry === null) continue;
    const raw = Number(entry);
    if (!Number.isFinite(raw) || raw < 0) continue;
    metrics[field] = Math.min(Math.floor(raw), ceiling);
  }
  if (Object.keys(metrics).length > 0) {
    console.log(
      JSON.stringify({
        msg: "miniapp client timing",
        app: "onboarding",
        // The surface, not the person: `card` means a Messages webview.
        via: ctx.session.via ?? null,
        ...metrics,
      })
    );
  }
  return new NextResponse(null, { status: 204, headers: baseHeaders() });
}

/**
 * Progress as one line of bubble copy. Read from the state file rather than
 * effectiveStatus(), because this runs after the response with no snapshot
 * in hand — the two can disagree briefly (a step whose live evidence exists
 * but was never marked), which is acceptable for a glanceable subcaption
 * and never for the deck itself.
 */
export function progressLine(state: OnboardingState): string {
  const numbered = SLIDE_GROUPS.filter((slide) => slide.id !== "welcome");
  const settled = (slide: OnboardingSlide): boolean =>
    slideSteps(slide).every((step) => state.steps[step] !== "todo");
  const done = numbered.filter(settled).length;
  if (done === numbered.length) return "Setup complete";
  const next = numbered.find((slide) => !settled(slide));
  const suffix = next ? ` · next: ${next.kicker}` : "";
  return `${done} of ${numbered.length} done${suffix}`;
}

/**
 * One pending card edit per request, keyed by that request's Supabase
 * client (route.ts builds one per request). A request can settle two steps
 * — the Computer slide marks username and email together — and the owner
 * should see one edit carrying the *final* line, not two carrying a stale
 * one and then the real one. Later marks overwrite the slot; the scheduled
 * callback reads it at flush time.
 */
const pendingCardEdit = new WeakMap<object, { state: OnboardingState }>();

/**
 * Stage 4: the thread itself as the progress indicator. The Onboarding card
 * already in the owner's transcript is edited in place as steps settle, so
 * it reads as where setup stands rather than a static "Set up your agent"
 * from whenever it was sent.
 *
 * Best-effort in every direction: an owner with no card (web-only, or one
 * never sent) comes back `stale` and is left alone, a send failure never
 * touches the request that triggered it, and nothing here blocks the
 * response — a Spectrum round trip on every skip is the latency this deck
 * just spent a release removing.
 */
function refreshOnboardingCard(
  supabase: SupabaseClient,
  userId: string,
  state: OnboardingState
): void {
  const pending = pendingCardEdit.get(supabase);
  if (pending) {
    // Already scheduled for this request — keep the newest state and let
    // the queued callback render the line from it.
    pending.state = state;
    return;
  }
  const slot = { state };
  pendingCardEdit.set(supabase, slot);
  try {
    after(async () => {
      const line = progressLine(slot.state);
      try {
        const outcome = await updateMiniAppCard(
          supabase,
          userId,
          "onboarding",
          "default",
          { subcaption: line, summary: `Onboarding — ${line}` }
        );
        // `stale` is the ordinary case for an owner who has no bubble; only
        // a live card that refused the edit is worth a line in the log.
        if (outcome === "failed") {
          console.error(
            JSON.stringify({
              msg: "onboarding card refresh failed",
              user_id: userId,
            })
          );
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "onboarding card refresh failed",
            user_id: userId,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
      }
    });
  } catch {
    // Outside a request scope (a test, a background job) — skip the edit.
    pendingCardEdit.delete(supabase);
  }
}

async function markSafely(
  supabase: SupabaseClient,
  userId: string,
  step: OnboardingStepId,
  status: "done" | "skipped" | "todo"
): Promise<boolean> {
  try {
    const state = await markOnboardingStep(supabase, userId, step, status);
    await writeStatusMirror(supabase, userId, { state });
    refreshOnboardingCard(supabase, userId, state);
    return true;
  } catch (error) {
    if (error instanceof StartLimitError) return false;
    throw error;
  }
}

/**
 * Deliver the Home launcher card to the owner's iMessage thread as the next
 * message after setup. Best-effort: web-only users have no destination yet,
 * and a send failure never blocks finishing onboarding.
 */
async function sendHomeCard(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  let claim: CardClaim | undefined;
  try {
    const { data: dest } = await supabase
      .from("imessage_destinations")
      .select("space_id, phone")
      .eq("user_id", userId)
      .maybeSingle();
    const spaceId = dest?.space_id ? String(dest.space_id) : "";
    const phone = dest?.phone ? String(dest.phone) : "";
    if (!spaceId || !phone) return;
    claim = await claimCardSend(supabase, userId, "home");
    if (!claim) return;
    await sendMiniAppCard(supabase, spaceId, phone, userId, "home", "default");
  } catch (error) {
    await claim?.release().catch(() => undefined);
    console.error(
      JSON.stringify({
        msg: "walkthrough home card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
}

export const onboarding: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    // A thumbnail request has nothing else to do — resolve it before any
    // snapshot work, not after building a page it will discard.
    const thumb = await serveIdentityThumb(ctx);
    if (thumb) return thumb;
    const { snapshot, active } = await snapshotForRender(
      ctx.supabase,
      ctx.session.userId,
      requestedStep(ctx),
      "entry"
    );
    // A pending Connect Link may have completed on the hosted page. Reading
    // that back from Composio is a third-party round trip, so the page
    // renders from the mirror and the sync lands before the next open.
    if (snapshot.connections.some((c) => c.status === "pending")) {
      try {
        after(() =>
          syncConnections(ctx.supabase, ctx.session.userId).catch(
            () => undefined
          )
        );
      } catch {
        // outside a request scope — skip the background sync
      }
    }
    const current = activeTheme(ctx);
    await withLiveLink(ctx.supabase, ctx.session.userId, snapshot, active);
    await withLiveResolutions(snapshot, active);
    return slides(
      current,
      renderOnboarding(
        current,
        snapshot,
        active,
        null,
        ctx.session.via === "card",
        browserSigninHref(ctx, snapshot, active),
        requestedPanelKey(ctx),
        allowsFx(ctx)
      ),
      rendersNativeOnairos(snapshot, active),
      rendersIdentityMedia(active),
      rendersBooth(active, ctx.session.via === "card"),
      rendersPrompts(active),
      rendersIntro(active),
      ctx.session.via !== "card"
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const supabase = ctx.supabase;
    const userId = ctx.session.userId;
    const action = String(form.get("action") ?? "");

    // A load-timing beacon writes nothing and renders nothing — log the
    // numbers and answer with an empty 204 before any state work.
    if (action === "__timing") return logClientTiming(ctx, form);

    if (action === "skip" || action === "mark_done") {
      const step = String(form.get("step") ?? "");
      if (!isOnboardingStep(step)) return forbidden("unknown step");
      const saved = await markSafely(
        supabase,
        userId,
        step,
        action === "skip" ? "skipped" : "done"
      );
      if (step === "walkthrough" && action === "mark_done") {
        // Finishing the walkthrough delivers Home as the next message so the
        // user's first stop after setup is the launcher clickthrough.
        // Best-effort: web-only users have no iMessage destination yet.
        await sendHomeCard(supabase, userId);
        return respond(
          ctx,
          null,
          saved
            ? "Setup complete — the Home app is on its way to your chat."
            : "Couldn't save progress — the computer is starting up."
        );
      }
      return respond(
        ctx,
        null,
        saved ? null : "Couldn't save progress — the computer is starting up."
      );
    }

    if (action === "set_environment") {
      const value = String(form.get("environment") ?? "");
      if (!isComputeEnvironment(value)) return forbidden("unknown environment");
      const snapshot = await loadSnapshot(supabase, userId);
      if (
        ENVIRONMENT_PROFILES[value].comingSoon &&
        value !== snapshot.environment
      ) {
        return respond(
          ctx,
          "environment",
          `${ENVIRONMENT_PROFILES[value].label} is coming soon — your agent stays on ${ENVIRONMENT_PROFILES[snapshot.environment].label} for now.`
        );
      }
      if (value === snapshot.environment) {
        await markSafely(supabase, userId, "environment", "done");
        return respond(
          ctx,
          null,
          `Staying on ${ENVIRONMENT_PROFILES[value].label}.`
        );
      }
      // Same row lease as the operator reprovision route: a double-tap here,
      // or an operator replacing this box at the same moment, must not fork
      // two boxes for one user.
      const { data: currentBox, error: currentBoxError } = await supabase
        .from("boxes")
        .select("provider_box_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (currentBoxError) {
        // Unknown whether a box exists: an unleased switch here could fork a
        // second box for the user, so ask them to retry instead.
        console.error(
          JSON.stringify({
            msg: "environment switch box lookup failed",
            user_id: userId,
            environment: value,
            error: currentBoxError.message,
          })
        );
        return respond(
          ctx,
          "environment",
          "Couldn't check on your computer just now — try again in a moment."
        );
      }
      const currentBoxId = (currentBox as { provider_box_id?: unknown } | null)
        ?.provider_box_id;
      let setupIncomplete = false;
      try {
        if (typeof currentBoxId === "string" && currentBoxId.length > 0) {
          await replaceBox(supabase, userId, currentBoxId, value);
        } else {
          await switchEnvironment(supabase, userId, value);
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "environment switch failed",
            user_id: userId,
            environment: value,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
        if (error instanceof ReplaceInProgressError) {
          return respond(
            ctx,
            "environment",
            "Your computer is already being moved — give it a minute, then check back."
          );
        }
        if (!(error instanceof SwitchSetupError)) {
          return respond(
            ctx,
            "environment",
            `${ENVIRONMENT_PROFILES[value].label} isn't available right now — try another, or skip and switch later.`
          );
        }
        // The row already points at the new box; only its starter setup
        // failed, and the user can finish that from the dashboard.
        setupIncomplete = true;
      }
      await markSafely(supabase, userId, "environment", "done");
      return respond(
        ctx,
        null,
        setupIncomplete
          ? `Your agent now lives on ${ENVIRONMENT_PROFILES[value].label} — some starter skills didn't install; add them from the dashboard.`
          : `Your agent now lives on ${ENVIRONMENT_PROFILES[value].label}.`
      );
    }

    if (action === "set_username") {
      const result = await setUsername(
        supabase,
        userId,
        String(form.get("username") ?? "")
      );
      if (!result.ok) {
        const message =
          result.error === "cooldown"
            ? `Username changes are limited — try again ${result.eligible ? `after ${result.eligible}` : "later"}.`
            : result.error === "taken"
              ? "That username is taken."
              : result.error === "invalid"
                ? "2–24 lowercase letters, digits, or underscores."
                : "Update failed — try again.";
        return respond(ctx, "username", message);
      }
      await markSafely(supabase, userId, "username", "done");
      if (result.address) {
        await markSafely(supabase, userId, "email", "done");
      }
      return respond(
        ctx,
        null,
        `You're @${result.username}${result.address ? ` — your agent has a new mailbox: ${result.address}` : ""}.`
      );
    }

    if (action === "set_model_family") {
      const family = String(form.get("model_family") ?? "");
      // Onboarding offers only the plain families — the consent-gated free
      // endpoints stay in Settings, which carries the terms and checkbox.
      if (!isModelFamily(family) || requiresConsent(family)) {
        return forbidden("invalid model family");
      }
      const ok = await setModelFamily(supabase, userId, family);
      if (ok) await markSafely(supabase, userId, "model", "done");
      return respond(
        ctx,
        ok ? null : "model",
        ok
          ? `Model set to ${MODEL_FAMILY_LABELS[family]}.`
          : "Update failed — try again."
      );
    }

    if (action === "connect") {
      const toolkit = String(form.get("toolkit") ?? "").toLowerCase();
      if (!TOOLKIT_SLUG_PATTERN.test(toolkit)) {
        return forbidden("invalid toolkit");
      }
      // The provider's OAuth page refuses to load inside a Messages card
      // webview (Google returns disallowed_useragent) — don't mint a
      // Connect Link there; the slide carries a jump into the real browser.
      if (ctx.session.via === "card") {
        return respond(
          ctx,
          "connect",
          "Sign-in can't run inside Messages — use the \"open this step in your browser\" link on the slide, connect there, then tap Refresh status."
        );
      }
      const callback = `${externalOrigin(ctx.request)}${ctx.basePath}?step=connect`;
      try {
        const link = await beginConnect(supabase, userId, toolkit, callback);
        return withBaseHeaders(
          NextResponse.redirect(link.redirect_url, 303)
        );
      } catch (error) {
        if (error instanceof ComposioApiError) {
          console.error(
            JSON.stringify({
              msg: "connect link failed",
              user_id: userId,
              toolkit,
              status: error.status,
              error: error.message,
            })
          );
          return respond(
            ctx,
            "connect",
            "That tool can't be connected right now — try another, or try again in a moment."
          );
        }
        throw error;
      }
    }

    if (action === "set_gmi_model") {
      const slug = String(form.get("gmi_model") ?? "");
      if (!isGmiModel(slug)) return forbidden("invalid model");
      const ok =
        (await setGmiModel(supabase, userId, slug)) &&
        (await setModelFamily(supabase, userId, "gmi"));
      if (ok) await markSafely(supabase, userId, "model", "done");
      return respond(
        ctx,
        ok ? null : "model",
        ok ? "GMI Cloud model set." : "Update failed — try again."
      );
    }

    if (action === "clear_gmi_model") {
      const ok = await clearGmiModel(supabase, userId);
      return respond(
        ctx,
        ok ? null : "model",
        ok ? "Back on speed tier." : "Update failed — try again."
      );
    }

    if (action === "set_speed") {
      const tier = String(form.get("speed_tier") ?? "");
      if (!isSpeedTier(tier)) return forbidden("invalid tier");
      const ok = await setSpeedTier(supabase, userId, tier);
      if (ok) await markSafely(supabase, userId, "model", "done");
      return respond(ctx, ok ? null : "model", ok ? `Speed set to ${tier}.` : "Update failed — try again.");
    }

    if (action === "grant_consent") {
      const scopes = form.getAll("scope").map(String).filter(isConsentScope);
      if (scopes.length === 0) {
        return respond(ctx, "consent", "Tick at least one box to continue, or skip the twin for now.");
      }
      let granted = 0;
      for (const scope of scopes) {
        const grant = await grantConsent(supabase, userId, scope, {
          surface: "onboarding",
        });
        if (grant) granted += 1;
      }
      if (granted === 0) {
        return respond(ctx, "consent", "Couldn't save your consent — try again.");
      }
      if (scopes.includes("likeness")) {
        await markSafely(supabase, userId, "consent", "done");
      }
      return respond(
        ctx,
        scopes.includes("likeness") ? "selfies" : "consent",
        "Saved — your choices are recorded, and you can revoke them here any time."
      );
    }

    if (action === "revoke_consent") {
      const scope = String(form.get("scope") ?? "");
      if (!isConsentScope(scope)) return forbidden("unknown scope");
      // Dependent features switch off with the grant: the provider voice is
      // deleted, the avatar config cleared.
      if (scope === "voice") {
        await revokeUserVoiceClone(supabase, userId, {}).catch(() => false);
      }
      if (scope === "video_avatar") {
        await disableVideoAvatar(supabase, userId).catch(() => false);
      }
      const revoked = await revokeConsent(supabase, userId, scope);
      if (revoked && scope === "likeness") {
        await markSafely(supabase, userId, "consent", "todo");
      }
      return respond(
        ctx,
        "consent",
        revoked
          ? `${CONSENT_COPY[scope].title} consent revoked.`
          : "Nothing to revoke."
      );
    }

    if (action === "upload_selfie") {
      const boothJson = ctx.request.headers.get("X-Identity-Booth") === "photo";
      const boothFailure = (message: string, status = 422): NextResponse =>
        withBaseHeaders(NextResponse.json({ ok: false, error: message }, { status }));
      const consent = consentFor(await listConsents(supabase, userId), "likeness");
      if (!consent) {
        return boothJson
          ? boothFailure(CONSENT_LINES.likeness, 403)
          : respond(ctx, "consent", CONSENT_LINES.likeness);
      }
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return boothJson
          ? boothFailure("Choose an image first.")
          : respond(ctx, "selfies", "Choose an image first.");
      }
      const result = await uploadIdentityImage(supabase, userId, file, "selfie", {
        source: form.get("source") === "booth" ? "booth" : "upload",
        consentId: consent.id,
      });
      if (!result.ok) {
        return boothJson
          ? boothFailure(result.error)
          : respond(ctx, "selfies", result.error);
      }
      await markSafely(supabase, userId, "selfies", "done");
      if (boothJson) {
        return withBaseHeaders(
          NextResponse.json({ ok: true, assetId: result.asset.id })
        );
      }
      return respond(ctx, "selfies", "Added to your image vault.");
    }

    if (action === "set_identity_references") {
      const result = await replaceIdentityReferences(
        supabase,
        userId,
        form.getAll("asset_id").map((value) => String(value))
      );
      return respond(
        ctx,
        "selfies",
        result.ok
          ? `${result.assetIds.length} private photo${result.assetIds.length === 1 ? "" : "s"} selected for @${(await currentUsername(supabase, userId)) ?? "you"}.`
          : result.error
      );
    }

    // Reference clips and voice samples: same guarded private path, tagged
    // with the grant they were added under.
    if (action === "upload_media") {
      const role = String(form.get("role") ?? "");
      if (
        !isIdentityRole(role) ||
        role === "avatar" ||
        role.endsWith("_draft") ||
        mediaKindForRole(role) === "image"
      ) {
        return forbidden("unknown media role");
      }
      const scope: ConsentScope = role === "voice_sample" ? "voice" : "likeness";
      const step: OnboardingStepId = role === "voice_sample" ? "voice" : "selfies";
      const consent = consentFor(await listConsents(supabase, userId), scope);
      if (!consent) return respond(ctx, "consent", CONSENT_LINES[scope]);
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return respond(ctx, step, "Choose a file first.");
      }
      const result = await uploadIdentityMedia(supabase, userId, file, role, {
        source: form.get("source") === "booth" ? "booth" : "upload",
        consentId: consent.id,
      });
      if (!result.ok) return respond(ctx, step, result.error);
      if (role === "reference_video") {
        await markSafely(supabase, userId, "selfies", "done");
      }
      return respond(
        ctx,
        step,
        role === "voice_sample"
          ? "Voice sample added."
          : "Reference video added to your vault."
      );
    }

    if (action === "move_media") {
      const assetId = String(form.get("asset_id") ?? "");
      const role = String(form.get("role") ?? "");
      const direction = String(form.get("direction") ?? "");
      if (!assetId || !isIdentityRole(role) || (direction !== "up" && direction !== "down")) {
        return forbidden("bad reorder");
      }
      const step: OnboardingStepId = role === "voice_sample" ? "voice" : "selfies";
      const ok = await reorderIdentityAsset(supabase, userId, assetId, role, direction);
      return respond(ctx, step, ok ? null : "Couldn't reorder — refresh and try again.");
    }

    if (action === "delete_media") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return forbidden("missing asset");
      const selected = await listIdentityReferenceAssetIds(supabase, userId);
      const wasSelected = selected.includes(assetId);
      if (wasSelected) {
        const remaining = selected.filter((id) => id !== assetId);
        const referencesOk = remaining.length > 0
          ? (await replaceIdentityReferences(supabase, userId, remaining)).ok
          : await clearIdentityReferences(supabase, userId);
        if (!referencesOk) {
          return respond(
            ctx,
            "selfies",
            "Couldn't update your reference set — the photo was not deleted."
          );
        }
      }
      const wasVoice = (await listIdentityAssets(supabase, userId).catch(() => [])).some(
        (entry) => entry.asset_id === assetId && entry.role === "voice_sample"
      );
      const ok = await deleteIdentityAsset(supabase, userId, assetId);
      return respond(
        ctx,
        wasVoice ? "voice" : "selfies",
        ok ? "Deleted — the original is gone from your vault." : "Nothing to delete."
      );
    }

    if (action === "generate_character_sheet") {
      const username = await currentUsername(supabase, userId);
      if (!username) {
        return respond(ctx, "username", "Pick a username first — the character sheet is bound to your @name.");
      }
      // Step 1 of 2: the render lands as a draft — nothing enters the
      // vault until save_character_sheet. A description switches to the
      // original-agent path (no photo reference).
      const description = String(form.get("description") ?? "").trim();
      const result = await generateCharacterSheet(supabase, userId, username, {
        ...(description ? { description } : {}),
      });
      return respond(ctx, "selfies", result.notice);
    }

    if (action === "generate_profile_image" || action === "generate_alt_image") {
      const username = await currentUsername(supabase, userId);
      if (!username) {
        return respond(ctx, "username", "Pick a username first — your twin is bound to your @name.");
      }
      const style = String(form.get("style") ?? "").trim();
      const opts = style ? { style } : {};
      const result =
        action === "generate_profile_image"
          ? await generateProfileImage(supabase, userId, username, opts)
          : await generateAltImage(supabase, userId, username, opts);
      if (result.ok && action === "generate_alt_image") {
        await markSafely(supabase, userId, "selfies", "done");
      }
      return respond(ctx, "selfies", result.notice);
    }

    if (action === "approve_profile_image") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return respond(ctx, "selfies", "No draft to approve.");
      const approved = await approveProfileImageDraft(supabase, userId, assetId);
      if (!approved) {
        return respond(ctx, "selfies", "That draft is gone — generate a new one.");
      }
      await markSafely(supabase, userId, "selfies", "done");
      return respond(ctx, "selfies", "Profile image approved — it's your twin's face now.");
    }

    if (action === "discard_profile_image") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return respond(ctx, "selfies", "No draft to discard.");
      await discardProfileImageDraft(supabase, userId, assetId);
      return respond(ctx, "selfies", "Draft discarded — try another style any time.");
    }

    if (action === "create_voice_clone") {
      const username = await currentUsername(supabase, userId);
      if (!username) {
        return respond(ctx, "username", "Pick a username first — your voice is bound to your @name.");
      }
      const result = await createUserVoiceClone(supabase, userId, username);
      if (!result.ok) return respond(ctx, "voice", result.error);
      if (result.status === "ready") {
        await markSafely(supabase, userId, "voice", "done");
        return respond(ctx, "voice", "Voice clone ready — /twin say now speaks in your voice.");
      }
      return respond(
        ctx,
        "voice",
        "Voice clone created — ElevenLabs asks you to verify it in their dashboard before it can speak. Tap Refresh once you have."
      );
    }

    if (action === "delete_voice_clone") {
      const ok = await revokeUserVoiceClone(supabase, userId, {});
      if (ok) await markSafely(supabase, userId, "voice", "todo");
      return respond(
        ctx,
        "voice",
        ok
          ? "Voice clone deleted here and at ElevenLabs. Your samples stay until you delete them."
          : "Couldn't reach the voice provider — try again in a minute."
      );
    }

    if (action === "enable_video_avatar") {
      const username = await currentUsername(supabase, userId);
      if (!username) {
        return respond(ctx, "username", "Pick a username first — your twin is bound to your @name.");
      }
      // The render takes minutes: it runs after the response, and the panel
      // reads its state (pending → ready | failed) back from the twin row.
      const run = (): Promise<unknown> =>
        enableVideoAvatar(supabase, userId, username, { channel: "web" }).catch(
          (error: unknown) => {
            console.error(
              JSON.stringify({
                msg: "video avatar render failed",
                user_id: userId,
                error: error instanceof Error ? error.message : String(error),
              })
            );
          }
        );
      try {
        after(run);
      } catch {
        void run();
      }
      return respond(
        ctx,
        "twin",
        "Rendering your video avatar — this takes a few minutes. Tap Refresh status."
      );
    }

    if (action === "disable_video_avatar") {
      const ok = await disableVideoAvatar(supabase, userId);
      return respond(ctx, "twin", ok ? "Video avatar turned off." : "Update failed — try again.");
    }

    if (action === "refresh_twin") {
      const twin = await getDigitalTwin(supabase, userId).catch(() => null);
      if (twin?.avatar_status === "ready") {
        await markSafely(supabase, userId, "twin", "done");
      }
      return respond(ctx, "twin", null);
    }

    if (action === "set_sharing") {
      const sharing = form.get("sharing") === "public" ? "public" : "private";
      const ok = await setTwinSharing(supabase, userId, sharing);
      return respond(
        ctx,
        "agent",
        ok
          ? sharing === "public"
            ? "Other people can now reference your profile image and character sheet — never your voice."
            : "Your twin is private again."
          : "Update failed — try again."
      );
    }

    if (action === "save_character_sheet") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return respond(ctx, "selfies", "No draft to save.");
      const saved = await saveCharacterSheetDraft(supabase, userId, assetId);
      if (!saved) {
        return respond(ctx, "selfies", "That draft is gone — generate a new one.");
      }
      await markSafely(supabase, userId, "selfies", "done");
      return respond(ctx, "selfies", "Character sheet saved to your vault.");
    }

    if (action === "discard_character_sheet") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return respond(ctx, "selfies", "No draft to discard.");
      await discardCharacterSheetDraft(supabase, userId, assetId);
      return respond(ctx, "selfies", "Draft discarded — generate another any time.");
    }

    if (action === "upload_consent") {
      if (env.gmiCloudApiKey() === null) {
        return respond(ctx, "twin", "Digital twin creation isn't configured on this deployment.");
      }
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return respond(ctx, "twin", "Choose a video first.");
      }
      const result = await uploadTwinConsent(supabase, userId, file);
      if (!result.ok) return respond(ctx, "twin", result.error);
      await markSafely(supabase, userId, "twin", "done");
      return respond(ctx, "twin", "Consent recorded.");
    }

    if (action === "create_twin") {
      if (env.gmiCloudApiKey() === null) {
        return respond(ctx, "twin", "Digital twin creation isn't configured on this deployment.");
      }
      const script = String(form.get("script") ?? "").trim().slice(0, 500);
      if (!script) return respond(ctx, "twin", "Write a line for your twin to say first.");
      const identity = await listIdentityAssets(supabase, userId).catch(() => []);
      const reference = identity.find(
        (entry) => entry.role === "selfie" || entry.role === "character_sheet"
      );
      if (!reference) {
        return respond(ctx, "twin", "Add a photo on the selfies step first.");
      }
      const imageUrl = await signedIdentityUrl(supabase, reference.asset).catch(
        () => null
      );
      if (!imageUrl) {
        return respond(ctx, "twin", "Couldn't read your reference image — try again.");
      }
      const result = await createTwinVideo(supabase, userId, {
        avatarImageUrl: imageUrl,
        script,
      });
      if (!result.ok) return respond(ctx, "twin", result.notice);
      await markSafely(supabase, userId, "twin", "done");
      return respond(ctx, "twin", result.notice);
    }

    if (action === "create_heygen_avatar") {
      if (!heygenAvailable()) {
        return respond(ctx, "avatar", "HeyGen isn't configured on this deployment — pick a photo below instead.");
      }
      const { data: user } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const username = (user?.username as string | null) ?? null;
      if (!username) {
        return respond(ctx, "username", "Pick a username first.");
      }
      const identity = await listIdentityAssets(supabase, userId).catch(() => []);
      const reference = identity.find(
        (entry) => entry.role === "selfie" || entry.role === "character_sheet"
      );
      if (!reference) {
        return respond(ctx, "avatar", "Add a photo on the selfies step first.");
      }
      const imageUrl = await signedIdentityUrl(supabase, reference.asset).catch(
        () => null
      );
      if (!imageUrl) {
        return respond(ctx, "avatar", "Couldn't read your reference image — try again.");
      }
      const result = await createUserHeygenAvatar(
        supabase,
        userId,
        username,
        imageUrl
      );
      if (!result.ok) return respond(ctx, "avatar", result.error);
      await setAvatarAssetId(supabase, userId, reference.asset_id).catch(
        () => false
      );
      await markSafely(supabase, userId, "avatar", "done");
      return respond(ctx, "avatar", "HeyGen avatar created — twin videos now use your trained avatar ID.");
    }

    if (action === "set_avatar") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return forbidden("missing asset");
      const ok = await setAvatarAssetId(supabase, userId, assetId);
      if (!ok) return respond(ctx, "avatar", "Couldn't set that avatar — pick one of your identity images.");
      await markSafely(supabase, userId, "avatar", "done");
      return respond(ctx, "avatar", "Avatar set — it now represents you.");
    }

    // Plain re-render — e.g. "Refresh" after finishing a browser sign-in.
    if (action === "noop") {
      return respond(ctx, null, null);
    }

    if (action === "refresh_import") {
      const imports = await readImportStatus(supabase, userId).catch(() => null);
      if (imports) await writeStatusMirror(supabase, userId, { imports });
      if (imports?.dictionary_built_at) {
        await markSafely(supabase, userId, "import", "done");
        return respond(
          ctx,
          "import",
          "Your personal dictionary is ready — your agent now knows you."
        );
      }
      return respond(ctx, "import", null);
    }

    if (action === "build_dictionary") {
      try {
        const imports = await startDictionaryRun(supabase, userId);
        await writeStatusMirror(supabase, userId, { imports });
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "import",
            "The computer is starting up — try again in a minute."
          );
        }
        if (error instanceof DictionaryStartError) {
          return respond(
            ctx,
            "import",
            "Nothing imported yet — run the import command first."
          );
        }
        throw error;
      }
      return respond(
        ctx,
        "import",
        "Your ingestion agent is on it — Dictionary.MD lands on your computer in a few minutes; tap Refresh status."
      );
    }

    if (action === "disable_browser_profile") {
      try {
        const browserProfile = await disableBrowserProfile(supabase, userId);
        await writeStatusMirror(supabase, userId, { browserProfile });
      } catch {
        return respond(
          ctx,
          "import",
          "Couldn't reach your agent's computer — try again in a minute."
        );
      }
      return respond(
        ctx,
        "import",
        "Real profile browsing is off — the copied profile was deleted from your agent's computer."
      );
    }

    if (action === "refresh_ingest") {
      const ingest = await readIngestStatus(supabase, userId).catch(() => null);
      if (ingest) await writeStatusMirror(supabase, userId, { ingest });
      if (ingest && ingest.chunks > 0) {
        await markSafely(supabase, userId, "imessage", "done");
      }
      return respond(ctx, "imessage", null);
    }

    // Labels and ids pass through untouched: saveResolutions owns validation
    // and persists box-side only. Nothing from this form is logged or mirrored.
    if (action === "resolve_threads") {
      const resolutions: Array<{ label: FormDataEntryValue | null; id: FormDataEntryValue | null }> = [];
      for (let index = 0; form.has(`label_${index}`); index++) {
        const id = form.get(`id_${index}`);
        resolutions.push({ label: form.get(`label_${index}`), id: id === "" ? null : id });
      }
      let notice: string;
      try {
        const view = await saveResolutions(supabase, userId, { resolutions });
        const remaining = view.unresolved.length;
        notice = remaining > 0
          ? `Saved. ${remaining} label${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} a decision; rerun the upload command once all are decided.`
          : "Saved — every label is decided. Rerun the upload command on your Mac to finish.";
      } catch (error) {
        if (error instanceof ResolutionInputError) {
          notice = `Couldn't save: ${error.message}. Tap Refresh status and try again.`;
        } else if (error instanceof StateBusyError) {
          notice = "An upload is writing to your archive right now — try again in a moment.";
        } else if (error instanceof StartLimitError) {
          notice = "The computer is starting up — try again in a minute.";
        } else {
          throw error;
        }
      }
      return respond(ctx, "imessage", notice);
    }

    if (action === "connect_stripe") {
      const here = `${externalOrigin(ctx.request)}${ctx.basePath}?step=stripe`;
      try {
        const url = await startOnboarding(supabase, userId, here, here);
        return withBaseHeaders(NextResponse.redirect(url, 303));
      } catch (error) {
        console.log(
          JSON.stringify({
            msg: "onboarding stripe connect failed",
            user_id: userId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        return respond(
          ctx,
          "stripe",
          "Stripe onboarding isn't available right now — try again later, or skip and connect from the Shop app."
        );
      }
    }

    if (action === "link_connect" || action === "link_check") {
      try {
        const doc =
          action === "link_connect"
            ? await startLinkAuth(supabase, userId)
            : await checkLinkAuth(supabase, userId);
        await writeStatusMirror(supabase, userId, { link: doc });
        if (doc.authenticated) {
          await markSafely(supabase, userId, "link", "done");
          return respond(ctx, "link", "Link connected.");
        }
        if (!doc.installed) {
          return respond(
            ctx,
            "link",
            "The Link CLI isn't on your agent's computer yet — skip for now and connect later."
          );
        }
        if (doc.verification_url) {
          return respond(
            ctx,
            "link",
            "Open the link below and approve the connection at link.com, then check status. The code expires after a few minutes — Start over mints a fresh one."
          );
        }
        if (doc.session_authenticated) {
          return respond(
            ctx,
            "link",
            "Link is signed in, but agent-payment permission isn't verified yet — tap Update Link permissions to approve the required access."
          );
        }
        return respond(
          ctx,
          "link",
          action === "link_connect"
            ? "Couldn't start the Link connection — try again in a minute."
            : "Not connected yet — approve the connection at link.com first."
        );
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "link",
            "The computer is starting up — try again in a minute."
          );
        }
        throw error;
      }
    }

    if (action === "run_workflow") {
      const id = String(form.get("workflow") ?? "");
      const workflow = WALKTHROUGH_WORKFLOWS.find(([wid]) => wid === id);
      if (!workflow) return forbidden("unknown workflow");
      try {
        const box = await ensureBoxAwake(supabase, userId);
        await createRun(box.target, {
          input: workflow[2],
          sessionId: MAIN_SESSION,
          metadata: {
            app: "onboarding",
            resource: ctx.session.resourceId,
            surface: "miniapp",
            workflow: id,
          },
        });
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "walkthrough",
            "The computer is starting up — try again in a minute."
          );
        }
        throw error;
      }
      await markSafely(supabase, userId, "walkthrough", "done");
      return respond(
        ctx,
        "walkthrough",
        `Sent — your agent is working on “${workflow[1]}”; the reply lands in chat.`
      );
    }

    if (action === "refresh_connections") {
      const connections = await syncConnections(supabase, userId).catch(
        () => [] as ConnectionRow[]
      );
      if (connections.some((c) => c.status === "active")) {
        await markSafely(supabase, userId, "connect", "done");
      }
      return respond(ctx, "connect", null);
    }

    if (action === "add_login") {
      const name = String(form.get("name") ?? "").trim();
      if (name.length === 0 || name.length > 120) {
        return respond(ctx, "secrets", "A name is required.");
      }
      const fields: Record<string, string> = {};
      const loginUsername = String(form.get("username") ?? "");
      const password = String(form.get("password") ?? "");
      if (loginUsername) fields["username"] = loginUsername;
      if (password) fields["password"] = password;
      try {
        const box = await ensureBoxAwake(supabase, userId);
        try {
          await applyBatch(box.boxId, userId, [
            { op: "create", item: { kind: "login", name, fields } },
          ]);
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "secrets",
            "The computer is starting up — try again in a minute."
          );
        }
        if (error instanceof VaultCliError) {
          return respond(ctx, "secrets", "Save failed — try again.");
        }
        throw error;
      }
      await markSafely(supabase, userId, "secrets", "done");
      return respond(ctx, null, `Saved "${name}" to your vault.`);
    }

    if (action === "enable_manager") {
      const manager = String(form.get("manager") ?? "");
      if (manager !== "bitwarden" && manager !== "onepassword") {
        return forbidden("unknown manager");
      }
      const token = String(form.get("token") ?? "");
      try {
        const box = await ensureBoxAwake(supabase, userId);
        try {
          await enableManager(supabase, userId, box.boxId, { manager, token });
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "secrets",
            "The computer is starting up — try again in a minute."
          );
        }
        if (error instanceof ManagerInputError) {
          return respond(ctx, "secrets", error.message);
        }
        return respond(
          ctx,
          "secrets",
          "Enabling the manager failed — try again."
        );
      }
      await markSafely(supabase, userId, "secrets", "done");
      return respond(ctx, null, "Manager enabled.");
    }

    if (action === "onairos_handoff") {
      if (env.onairosApiKey() === null) {
        return respond(
          ctx,
          "onairos",
          "Onairos isn't configured on this deployment."
        );
      }
      try {
        await syncOnairos(supabase, userId, {
          token: String(form.get("token") ?? ""),
          apiUrl: String(form.get("api_url") ?? ""),
        });
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "onairos",
            "The computer is starting up — try again in a minute."
          );
        }
        if (error instanceof OnairosError) {
          return respond(ctx, "onairos", `Connecting failed — ${error.message}.`);
        }
        throw error;
      }
      await markSafely(supabase, userId, "onairos", "done");
      return respond(
        ctx,
        null,
        "Onairos connected — your imported context lives on your computer."
      );
    }

    if (action === "connect_onairos") {
      if (env.onairosApiKey() === null) {
        return respond(ctx, "onairos", "Onairos isn't configured on this deployment.");
      }
      const { data: destination } = await supabase
        .from("imessage_destinations")
        .select("space_id, phone")
        .eq("user_id", userId)
        .maybeSingle();
      if (!destination?.space_id || !destination.phone) {
        return respond(
          ctx,
          "onairos",
          "No iMessage thread found yet — text your agent once, then try again."
        );
      }
      const spaceId = String(destination.space_id);
      const phone = String(destination.phone);
      if (await spectrumFlowActive(supabase, userId)) {
        return respond(
          ctx,
          "onairos",
          "The Onairos conversation is already going in your iMessage thread — reply there to continue."
        );
      }
      let result;
      try {
        result = await relayToOnairos({
          sessionId: spaceId,
          senderId: phone,
          phone,
          text: "Connect Onairos",
        });
      } catch {
        return respond(
          ctx,
          "onairos",
          "Couldn't reach Onairos — try again in a minute."
        );
      }
      await setSpectrumFlow(
        supabase,
        userId,
        result.shouldRouteNextMessage ? "pending" : "error"
      ).catch(() => undefined);
      if (result.reply) {
        const sender = await createSpectrumSender().catch(() => undefined);
        if (sender) {
          try {
            await sender
              .sendText(spaceId, phone, result.reply)
              .catch(() => undefined);
          } finally {
            await sender.close().catch(() => undefined);
          }
        }
      }
      return respond(
        ctx,
        "onairos",
        "Check your iMessage — Onairos will ask for your account email there. Reply in the thread to finish connecting."
      );
    }

    if (action === "ask_agent") {
      const text = String(form.get("text") ?? "").trim();
      if (!text || text.length > 4000) {
        return respond(ctx, "agent", "Say something first.");
      }
      try {
        const box = await ensureBoxAwake(supabase, userId);
        const run = await createRun(box.target, {
          input: text,
          sessionId: MAIN_SESSION,
          metadata: { app: "onboarding", resource: ctx.session.resourceId, surface: "miniapp" },
        });
        await supabase.from("agent_runs").insert({
          user_id: userId,
          hermes_run_id: run.run_id,
          trigger: "web",
        });
        await armStopAfter(supabase, userId).catch(() => undefined);
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "agent",
            "The computer is starting up — try again in a minute."
          );
        }
        throw error;
      }
      await markSafely(supabase, userId, "agent", "done");
      return respond(
        ctx,
        null,
        "Sent — your agent is replying in your chat. You're set up."
      );
    }

    return forbidden("unknown action");
  },
};
