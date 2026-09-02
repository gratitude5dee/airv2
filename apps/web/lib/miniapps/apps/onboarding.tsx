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
  setModelFamily,
  setSpeedTier,
  setUsername,
  SPEED_TIERS,
} from "@/lib/settings/account";
import {
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  requiresConsent,
  type ModelFamily,
} from "@/lib/entitlements/models";
import { getMerchant, startOnboarding, type Merchant } from "@/lib/commerce/merchants";
import {
  mintIngestTicket,
  readIngestStatus,
  type IngestStatus,
} from "@/lib/imessage/ingest";
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
import { sendMiniAppCard } from "@/lib/miniapps/cards";
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
  writeStatusMirror,
} from "../onboardingMirror";
import {
  getAvatarAssetId,
  listIdentityAssets,
  listIdentityMediaRoles,
  listIdentityMediaViews,
  setAvatarAssetId,
  signedIdentityUrl,
  uploadIdentityImage,
  type IdentityMediaView,
} from "@/lib/identity/assets";
import {
  discardCharacterSheetDraft,
  generateCharacterSheet,
  saveCharacterSheetDraft,
} from "@/lib/identity/generate";
import { heygenAvailable } from "@/lib/identity/heygen";
import {
  createTwinVideo,
  createUserHeygenAvatar,
  getDigitalTwin,
  uploadTwinConsent,
  type DigitalTwin,
} from "@/lib/identity/twin";
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
import { switchEnvironment } from "@/lib/provisioning/provision";
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
  | "photo_select"
  | "sheet"
  | "booth_video"
  | "twin_create";

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
  selfies: ["selfies"],
  booth_photo: ["selfies"],
  photo_select: ["selfies"],
  sheet: ["selfies"],
  twin: ["twin"],
  booth_video: ["twin"],
  twin_create: ["twin"],
  avatar: ["avatar"],
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
    title: "Photo Booth",
    kicker: "Photo Booth",
    // Six stepper panels — the deck-stepper folds them into a one-at-a-time
    // wizard with green-check progress; state still lives on the three step
    // IDs (selfies/twin/avatar) each panel reads and writes.
    sections: [
      { key: "booth_photo", label: "Take photo" },
      { key: "photo_select", label: "Photo selection" },
      { key: "sheet", label: "Generate character sheet" },
      { key: "booth_video", label: "Take video" },
      { key: "twin_create", label: "Create digital twin" },
      { key: "avatar", label: "Avatar selection" },
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
      { key: "agent", label: "Try a prompt" },
      { key: "walkthrough", label: "Your launcher" },
    ],
  },
];

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
  avatarAssetId: string | null;
  twin: DigitalTwin | null;
  twinAvailable: boolean;
  connections: ConnectionRow[];
  managers: ManagerStatus[];
  vaultItemCount: number;
  onairos: OnairosStatus;
  speedTier: string | null;
  modelFamily: ModelFamily;
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
  /** A pairing phrase/URL exists box-side but isn't in `link` yet. */
  linkPairing: boolean;
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
          .select("speed_tier, model_family")
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
      // Signed thumbnail URLs are only looked at on the booth slide; every
      // other slide needs the roles alone (selfie present? avatar set?).
      timedPart(parts, "identity_media", () =>
        rendering("booth")
          ? listIdentityMediaViews(supabase, userId)
          : listIdentityMediaRoles(supabase, userId)
      ),
      timedPart(parts, "box", () =>
        supabase
          .from("boxes")
          .select("environment")
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
            refreshStatusMirror(supabase, userId).catch(() => undefined)
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
    }

    // A step the state file already resolves needs no live evidence:
    // effectiveStatus returns the recorded value without reading these.
    const open = (step: OnboardingStepId): boolean =>
      state.steps[step] !== "done" && state.steps[step] !== "skipped";
    const identityNeeded =
      rendering("booth") || open("twin") || open("avatar");
    const managersNeeded = rendering("apps") || open("secrets");
    const merchantNeeded = rendering("apps") || open("stripe");
    const [twin, avatarAssetId, managers, merchant] = await Promise.all([
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
      avatarAssetId,
      twin,
      twinAvailable: env.gmiCloudApiKey() !== null,
      connections,
      managers,
      vaultItemCount: count ?? 0,
      onairos: onairosStatusFromRows(connections),
      speedTier: (entitlement?.speed_tier as string | null) ?? null,
      modelFamily: isModelFamily(String(entitlement?.model_family ?? ""))
        ? (entitlement?.model_family as ModelFamily)
        : DEFAULT_MODEL_FAMILY,
      merchant,
      link,
      pluginSessions: pluginCount ?? 0,
      ingest,
      ingestCommand: buildIngestCommand(userId),
      imports,
      importCommand: buildImportCommand(userId),
      browserProfile,
      browserProfileCommand: buildBrowserProfileCommand(userId),
      boxBusy,
      linkPairing,
      loaded: {
        identityUrls: rendering("booth"),
        twin: identityNeeded,
        managers: managersNeeded,
        merchant: merchantNeeded,
      },
    };
  });
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
  if (slide.id === "booth") {
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
  if (jobs.length === 0) return;
  await timedFetch("onboarding", "slide_hydrate", () => Promise.all(jobs));
}

/**
 * The snapshot a render works from: scoped to the requested step when the
 * URL names one, then topped up for the slide the deck actually opens on.
 */
async function snapshotForRender(
  supabase: SupabaseClient,
  userId: string,
  requested: OnboardingStepId | null
): Promise<{ snapshot: OnboardingSnapshot; active: OnboardingStepId }> {
  const snapshot = await loadSnapshot(
    supabase,
    userId,
    requested ? slideForStep(requested) : "status"
  );
  const active = requested ?? firstOpenStep(snapshot);
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
function buildIngestCommand(userId: string): string | null {
  try {
    const origin = env.appOrigin();
    const ticket = mintIngestTicket(userId);
    return `curl -fsSL ${origin}/imessage-ingest.sh -o /tmp/air-ingest.sh && AIR_INGEST_ENDPOINT=${origin}/api/me/imessage-history bash /tmp/air-ingest.sh ${ticket}`;
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
    case "selfies":
      return snapshot.identityMedia.some(isVaultMedia) ? "done" : "todo";
    case "twin":
      return snapshot.twin && snapshot.twin.status !== "avatar_only"
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

function firstOpenStep(snapshot: OnboardingSnapshot): OnboardingStepId {
  for (const step of ONBOARDING_STEPS) {
    if (effectiveStatus(snapshot, step) === "todo") return step;
  }
  return "walkthrough";
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

/** Confirmed vault references — drafts and the avatar pointer excluded. */
const isVaultMedia = (m: IdentityMediaView): boolean =>
  m.role === "selfie" || m.role === "character_sheet";

/** Same-origin photo-booth mount (script-src 'self'); the plain upload
 * forms below it stay the lite/Messages and no-camera path. The bundle is
 * loaded once per slide by renderOnboarding — a grouped slide can hold both
 * the photo and the video booth. */
function boothMount(mode: "photo" | "video"): string {
  return `<div class="identity-booth" data-mode="${mode}"></div>`;
}

function skipForm(step: OnboardingStepId, label = "Skip for now"): string {
  return `<form method="post" class="inline"><input type="hidden" name="action" value="skip"><input type="hidden" name="step" value="${esc(step)}"><button class="ghost">${esc(label)}</button></form>`;
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
  return `<p class="muted">Pick the family your agent thinks with.</p><div class="famgrid">${families}</div><p class="muted">(you can select others in settings later)</p><p class="muted">Thinking speed — faster answers or deeper reasoning:</p><div class="row">${tiers}</div><div class="row actions">${skipForm("model")}</div>`;
}

/**
 * Personality engine (Onairos) step: a status well, the native sign-in well,
 * iMessage folded away as the alternative, and one actions row — Continue
 * (primary, once connected) or Skip, plus Refresh for card sessions that
 * finished a Google sign-in in the real browser. The key only ever renders
 * on the owner's own authenticated slide (never in a public bundle), the
 * SDK handoff posts back as a regular form (action=onairos_handoff), and a
 * connected account keeps the flow mounted so more sources can be added.
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
  const imessage = `<details><summary>Or connect via iMessage</summary><p class="muted">Onairos asks for your account email, a verification code, and your YES right in your iMessage thread.</p><form method="post" class="inline"><input type="hidden" name="action" value="connect_onairos"><button class="ghost">Connect via iMessage</button></form></details>`;
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
    // Lite/Messages sessions run on a tight memory budget — the intro is a
    // still there, and the video only plays in the full webview.
    const intro = lite
      ? ""
      : `<video class="introvid" src="/creator-os/welcome-air.mp4" autoplay muted loop playsinline preload="auto" aria-label="Sunrise over the clouds"></video>`;
    return `${intro}<p>An agent of your own: its own computer, its own mailbox, and your context — set up in six short steps.</p><p class="muted">Everything here is optional and re-enterable. Skip anything, come back any time.</p><div class="row actions">${doneForm("welcome", "Continue")}</div>`;
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
  if (step === "selfies") {
    return `${boothPhotoBody(snapshot, lite)}${photoSelectBody(snapshot)}${sheetBody(snapshot)}`;
  }
  if (step === "twin") {
    return `${boothVideoBody(snapshot, lite)}${twinCreateBody(snapshot)}`;
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
          `<form method="post" class="idpick"><input type="hidden" name="action" value="set_avatar"><input type="hidden" name="asset_id" value="${esc(m.assetId)}"><img class="idthumb" src="${esc(m.url ?? "")}" alt="identity image"><button${m.assetId === snapshot.avatarAssetId ? "" : ' class="ghost"'}>${m.assetId === snapshot.avatarAssetId ? "Current avatar" : "Use as avatar"}</button></form>`
      )
      .join("");
    const gallery = choices
      ? `<div class="idgrid">${choices}</div>`
      : `<p class="muted">No identity images yet — upload selfies or generate a character sheet on the <a href="?step=selfies">selfies step</a>.</p>`;
    const generate = snapshot.username
      ? `<form method="post" class="inline"><input type="hidden" name="action" value="generate_character_sheet"><button class="ghost">Generate a new look</button></form>`
      : "";
    return `<p class="muted">Optional — pick the image that represents @${esc(snapshot.username ?? "you")}, or generate a new look. Generated media can reference it as your likeness.</p>${trainedBlock}${gallery}<div class="row actions">${generate}${skipForm("avatar")}</div>`;
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
        : `<p class="muted">Your iMessage history lives only on your Mac. Run one command there to copy recent messages to your agent's computer as personal context.</p>`;
    const pluginLine =
      snapshot.pluginSessions > 0
        ? `<p class="muted">WZRD ChatGPT/Claude plugin: ${snapshot.pluginSessions} active session${snapshot.pluginSessions === 1 ? "" : "s"}.</p>`
        : `<p class="muted">Also available: the WZRD plugin for ChatGPT/Claude — start sign-in from the tool, then approve its code in Settings.</p>`;
    const command = snapshot.ingestCommand
      ? `<details><summary>Get the one-time upload command</summary><p class="muted">Run in Terminal on your Mac (needs Full Disk Access; link valid ~30 minutes):</p><pre>${esc(snapshot.ingestCommand)}</pre><form method="post" class="inline"><input type="hidden" name="action" value="refresh_ingest"><button class="ghost">Refresh status</button></form></details>`
      : "";
    return `${statusLine}${command}${pluginLine}<div class="row actions">${skipForm("imessage")}</div>`;
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
 * Photo Booth wizard panels — the slide's six stepper steps. Each reads and
 * writes the same three step IDs (selfies/twin/avatar) as before; only the
 * presentation is split.
 */
function boothPhotoBody(snapshot: OnboardingSnapshot, lite: boolean): string {
  // Booth captures post upload_selfie on finalize; the plain form stays
  // the lite/Messages and no-camera path (capture="user" opens the iPhone
  // camera directly from the picker).
  const booth = lite ? "" : boothMount("photo");
  const upload = `<details${lite ? " open" : ""}><summary>Upload from your library</summary><form method="post" enctype="multipart/form-data" class="row"><input type="hidden" name="action" value="upload_selfie"><input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" capture="user"><button>Upload</button></form><p class="muted">iPhone HEIC photos convert automatically.</p></details>`;
  return `<p class="muted">Step into the booth — shoot from your iPhone or your MacBook camera, or upload from your library. Photos live privately in your image vault and anchor your @${esc(snapshot.username ?? "username")} identity for generated media.</p>${booth}${upload}<div class="row actions">${skipForm("selfies")}</div>`;
}

function photoSelectBody(snapshot: OnboardingSnapshot): string {
  const references = snapshot.identityMedia.filter(isVaultMedia);
  const thumbs = references
    .filter((m) => m.url)
    .map(
      (m) =>
        `<img class="idthumb" src="${esc(m.url ?? "")}" alt="${esc(m.role === "character_sheet" ? "character sheet" : "selfie")}">`
    )
    .join("");
  const gallery = thumbs
    ? `<div class="idgrid">${thumbs}</div>`
    : `<p class="muted">Nothing selected yet — take or upload a photo first, then tap shots in the booth gallery and confirm with the green check.</p>`;
  return `<p class="muted">Your confirmed photos — these live privately in your vault and anchor generated media.</p>${gallery}`;
}

function sheetBody(snapshot: OnboardingSnapshot): string {
  const references = snapshot.identityMedia.filter(isVaultMedia);
  // Two-step character sheet, same card: generate renders a draft; the
  // owner then saves it into the vault or discards it.
  const draft = snapshot.identityMedia.find(
    (m) => m.role === "character_sheet_draft"
  );
  return !snapshot.username
    ? `<p class="muted">Set a <a href="?step=username">username</a> first — the character sheet is bound to your @name.</p>`
    : draft
      ? `<div class="sheetcard"><p class="muted">Step 2 of 2 — review your character sheet, then save it to the vault or discard it.</p>${draft.url ? `<img class="sheetpreview" src="${esc(draft.url)}" alt="character sheet draft">` : ""}<div class="row"><form method="post" class="inline"><input type="hidden" name="action" value="save_character_sheet"><input type="hidden" name="asset_id" value="${esc(draft.assetId)}"><button>Save to vault</button></form><form method="post" class="inline"><input type="hidden" name="action" value="discard_character_sheet"><input type="hidden" name="asset_id" value="${esc(draft.assetId)}"><button class="ghost">Discard</button></form></div></div>`
      : `<div class="sheetcard"><p class="muted">Step 1 of 2 — generate a character sheet from your photos; you review it before anything is saved.</p><form method="post" class="inline"><input type="hidden" name="action" value="generate_character_sheet"><button${references.length > 0 ? "" : ' class="ghost"'}>Generate character sheet</button></form></div>`;
}

function boothVideoBody(snapshot: OnboardingSnapshot, lite: boolean): string {
  if (!snapshot.twinAvailable) {
    return `<p class="muted">Digital twin creation isn't configured on this deployment — set it up later from Settings once it is. Nothing here blocks the rest of setup.</p><div class="row actions">${skipForm("twin", "Skip — not configured")}</div>`;
  }
  const consent = snapshot.twin?.consent_video_key
    ? `<p>Consent recording on file.</p>`
    : `${lite ? "" : boothMount("video")}<details${lite ? " open" : ""}><summary>Upload a recording instead</summary><p class="muted">Record or upload a short video of yourself saying you consent to creating a digital twin of your likeness.</p><form method="post" enctype="multipart/form-data" class="row"><input type="hidden" name="action" value="upload_consent"><input type="file" name="file" accept="video/mp4,video/webm" capture="user"><button>Upload consent</button></form></details>`;
  return `<p class="muted">Optional — record the consent line for a talking-head twin of your likeness. The video is delivered privately: only you can share it.</p>${consent}<div class="row actions">${skipForm("twin")}</div>`;
}

function twinCreateBody(snapshot: OnboardingSnapshot): string {
  if (!snapshot.twinAvailable) {
    return `<p class="muted">Digital twin creation isn't configured on this deployment — nothing here blocks the rest of setup.</p>`;
  }
  const twin = snapshot.twin;
  const reference = snapshot.identityMedia.find(
    (m) => isVaultMedia(m) && m.url
  );
  const create = reference
    ? `<form method="post" class="stack"><input type="hidden" name="action" value="create_twin"><input type="text" name="script" placeholder="What should @${esc(snapshot.username ?? "you")} say? (a sentence or two)" maxlength="500"><button>Create twin video</button></form>`
    : `<p class="muted">Add a photo on the <a href="?step=selfies">selfies step</a> first — the twin animates your reference image.</p>`;
  const statusLine = twin
    ? `<p>Twin status: <strong>${esc(twin.status)}</strong>.</p>`
    : "";
  return `<p class="muted">Optional — create a talking-head twin from your reference photo.</p>${statusLine}${create}`;
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
  const hasVaultMedia = snapshot.identityMedia.some(
    (m) => isVaultMedia(m) && m.url
  );
  if (key === "booth_photo" || key === "photo_select") return hasVaultMedia;
  if (key === "sheet")
    return snapshot.identityMedia.some((m) => m.role === "character_sheet");
  if (key === "booth_video") return Boolean(snapshot.twin?.consent_video_key);
  if (key === "twin_create")
    return Boolean(snapshot.twin && snapshot.twin.status !== "avatar_only");
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
  if (key === "booth_photo") return boothPhotoBody(snapshot, lite);
  if (key === "photo_select") return photoSelectBody(snapshot);
  if (key === "sheet") return sheetBody(snapshot);
  if (key === "booth_video") return boothVideoBody(snapshot, lite);
  if (key === "twin_create") return twinCreateBody(snapshot);
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
  if (nativeOnairos) {
    if (!csp.includes("script-src")) csp += "; script-src 'self'";
    // The SDK loads Google Identity Services for its Google sign-in path
    // (allowances per https://developers.google.com/identity/gsi/web/guides/csp).
    csp = csp.replace(
      "script-src 'self'",
      "script-src 'self' https://accounts.google.com/gsi/client"
    );
    csp = csp.replace(
      "style-src 'unsafe-inline'",
      "style-src 'unsafe-inline' https://accounts.google.com/gsi/style"
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
    // The welcome film is a first-party file under /creator-os.
    csp = csp.includes("media-src")
      ? csp.replace(/media-src ([^;]+)/, "media-src $1 'self'")
      : csp + "; media-src 'self'";
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

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.93' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E";

const SLIDE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
html{background:var(--canvas);background-attachment:fixed}
body{min-height:100svh;background:transparent;color:var(--ink);font-family:var(--font-body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;display:block}
.scrim{position:fixed;inset:0;z-index:1;pointer-events:none;background:var(--scrim)}
.grain{position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:soft-light;opacity:0.15;background-image:url("${GRAIN_SVG}")}
.frame{position:relative;z-index:2;min-height:100svh;display:flex;flex-direction:column;padding:clamp(0.9rem,3.2vw,1.35rem) clamp(1rem,4.5vw,1.7rem)}
header.bar{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;font-family:var(--font-ui)}
.logo-pill{display:inline-flex;align-items:center;height:clamp(2.7rem,9vw,3.4rem);padding:0 clamp(0.85rem,3vw,1.25rem);border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--logo-plate);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow)}
.logo-pill img{display:block;height:clamp(1.2rem,4.4vw,1.6rem);width:auto}
.counter{display:inline-flex;align-items:center;height:2rem;padding:0 0.75rem;border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink)}
main.slide{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(1.2rem,4vw,2.5rem) 0;animation:slideIn var(--slide-in) cubic-bezier(0.22,1,0.36,1)}
@keyframes slideIn{from{opacity:0;transform:translateY(26px) scale(0.985)}60%{opacity:1}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
main.slide .kicker{animation:riseIn var(--slide-in) cubic-bezier(0.22,1,0.36,1) backwards;animation-delay:60ms}
main.slide h1{animation:riseIn var(--slide-in) cubic-bezier(0.22,1,0.36,1) backwards;animation-delay:130ms}
main.slide .panel{animation:riseIn var(--slide-in) cubic-bezier(0.22,1,0.36,1) backwards;animation-delay:200ms}
@media(prefers-reduced-motion:reduce){main.slide,main.slide .kicker,main.slide h1,main.slide .panel{animation:none}.navlink,button,.dots a{transition:none}}
.kicker{font-family:var(--font-ui);font-size:clamp(0.68rem,0.8vw,0.85rem);letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin:0 0 0.9rem;text-align:center}
h1{font-weight:400;font-size:clamp(1.9rem,5.4vw,3.6rem);letter-spacing:-0.045em;line-height:0.98;margin:0 0 1.4rem;text-align:center;max-width:26ch;text-shadow:var(--text-shadow)}
.panel{width:min(100%,34rem);border-radius:var(--radius-panel);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow);padding:clamp(1rem,3.4vw,1.5rem)}
.notice{width:min(100%,34rem);margin:0 0 0.8rem;font-family:var(--font-ui);font-size:0.72rem;line-height:1.45;letter-spacing:0.04em;color:var(--on-accent);background:var(--accent);border-radius:var(--radius-well);padding:0.55rem 0.8rem}
footer.nav{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;font-family:var(--font-ui)}
.navlink{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 1.1rem;border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink);text-decoration:none;white-space:nowrap;transition:box-shadow 200ms ease,transform 200ms ease}
.navlink:hover{transform:scale(1.04)}
.navlink.ghosted{opacity:0.35;pointer-events:none}
.dots{display:flex;gap:0.42rem;align-items:center;flex-wrap:wrap;min-width:0}
.dots a{width:1.5rem;height:1.5rem;padding:0.5rem;border-radius:50%;background:var(--ring);background-clip:content-box;display:block;transition:transform 200ms ease}
.dots a:hover{transform:scale(1.5)}
.dots a.done{background:var(--accent)}
.dots a.skipped{background:var(--ink-muted)}
.dots a.active{outline:1.5px solid var(--accent);outline-offset:2.5px;background:var(--accent)}
.dots .locked{width:1.5rem;height:1.5rem;padding:0.5rem;border-radius:50%;background:var(--ring);background-clip:content-box;display:block;opacity:0.35}
p{font-size:0.95rem;line-height:1.5;margin:0 0 0.6rem}
a{color:var(--accent)}
button{font-family:var(--font-ui);background:var(--ink);color:var(--on-ink);border:0;border-radius:var(--radius-pill);min-height:2.75rem;padding:0.5rem 1.15rem;font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;transition:transform 180ms ease}
button:hover{transform:scale(1.05)}
button:active{transform:scale(0.97)}
button.ghost{background:transparent;color:var(--ink-muted);border:1px solid var(--ring)}
button.ghost:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
input[type=text],input[type=password],select{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring);border-radius:var(--radius-well);min-height:2.75rem;padding:0.6rem 0.85rem;flex:1;font-size:1rem;font-family:var(--font-body);outline:none;min-width:0}
input[type=text]:focus,input[type=password]:focus{border-color:var(--accent)}
input::placeholder{color:var(--ink-muted)}
.item{display:flex;align-items:center;gap:0.6rem;border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.7rem 0.85rem;margin-bottom:0.55rem;font-size:0.9rem;background:var(--well-bg)}
details{border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.85rem;background:var(--well-bg);margin-bottom:0.6rem}
summary{font-family:var(--font-ui);font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--ink-muted);cursor:pointer;min-height:2.75rem;display:flex;align-items:center}
pre{background:var(--well-bg);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.75rem;font-family:var(--font-ui);font-size:0.68rem;line-height:1.45;white-space:pre-wrap;word-break:break-all;max-height:240px;overflow:auto;color:var(--accent)}
ul{margin:0.2rem 0 0.8rem;padding-left:1.1rem}
li{font-size:0.88rem;line-height:1.5;color:var(--ink-muted)}
li strong{color:var(--ink)}
form{margin:0}
form.inline{display:inline-flex}
form.stack{display:grid;gap:0.5rem;margin-top:0.5rem}
form.stack select{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.8rem;font-size:0.9rem;font-family:var(--font-body)}
.row{display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center}
.row.actions{margin-top:0.85rem}
@media(max-width:480px){.row.actions{flex-direction:column;align-items:stretch}.row.actions form.inline{display:flex}.row.actions form.inline button{flex:1;width:100%}}
.deck{width:min(100%,34rem);display:grid;gap:0.9rem}
.deck.split{width:min(100%,60rem)}
@media(min-width:900px){.deck.split{grid-template-columns:1.4fr 1fr;align-items:start}}
.deck .panel{width:100%}
.subhead{font-family:var(--font-ui);font-size:0.66rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin:0 0 0.7rem}
.seg{display:inline-flex;gap:2px;justify-self:center;padding:3px;border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
.seg a{padding:0.42rem 1.2rem;border-radius:var(--radius-pill);font-family:var(--font-ui);font-size:0.66rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink);text-decoration:none}
.seg a.on{background:var(--accent);color:var(--panel-bg)}
.pager{display:flex;gap:0.9rem;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 -0.25rem;padding:0 0.25rem}
.pager::-webkit-scrollbar{display:none}
.pane{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;display:grid;gap:0.9rem;align-content:start;min-width:0}
.introvid{display:block;width:100%;border-radius:var(--radius-well);border:1px solid var(--ring);background:var(--well-bg);margin-bottom:0.9rem}
.envgrid{display:grid;gap:0.6rem;margin-top:0.6rem;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));align-items:stretch}
form.envform{display:block;height:100%}
.envmark{width:1.5rem;height:1.5rem;fill:none;stroke:currentColor;stroke-width:1.4;color:var(--accent)}
.mailbox{display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;border:1px solid var(--accent);border-radius:var(--radius-well);background:var(--well-bg);padding:0.7rem 0.85rem;margin:0.8rem 0 0.6rem;font-size:0.95rem;word-break:break-all}
.mailform .suffix{font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.06em;color:var(--ink-muted)}
.famgrid{display:grid;gap:0.5rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));margin:0.5rem 0 0.7rem}
.famform button{width:100%}
.linkcta{display:flex;align-items:center;justify-content:center;gap:0.5rem;background:var(--ink);color:var(--on-ink);border-radius:var(--radius-pill);min-height:2.75rem;padding:0.5rem 1.15rem;font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;transition:transform 180ms ease}
.linkcta:hover{transform:scale(1.03)}
.linkphrase{display:flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:var(--radius-well);background:var(--well-bg);padding:0.7rem 0.85rem;margin:0.6rem 0;font-size:1.1rem;letter-spacing:0.04em;font-weight:600}
.prompts{display:grid;gap:0.6rem;margin:0.5rem 0 0.8rem}
.prompt{display:grid;gap:0.45rem;border:1px solid var(--ring);border-radius:var(--radius-well);background:var(--well-bg);padding:0.75rem 0.85rem}
.prompt strong{font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase}
.envcard{display:flex;flex-direction:column;align-items:flex-start;gap:0.35rem;width:100%;height:100%;min-height:4.5rem;padding:0.9rem 1rem;border-radius:var(--radius-well);border:1px solid var(--ring);background:var(--well-bg);text-align:left;text-transform:none;letter-spacing:0;color:var(--ink)}
button.envcard:hover{transform:none;border-color:var(--accent)}
button.envcard:active{transform:scale(0.99)}
.envcard.current{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.envcard.off{opacity:0.6}
.envname{font-family:var(--font-ui);font-size:0.78rem;letter-spacing:0.09em;text-transform:uppercase;display:flex;gap:0.55rem;align-items:center;flex-wrap:wrap}
.envtag{font-size:0.58rem;letter-spacing:0.1em;color:var(--accent);border:1px solid var(--accent);border-radius:var(--radius-pill);padding:0.15rem 0.5rem}
.envtag.soon{color:var(--ink-muted);border-color:var(--ring)}
.envblurb{font-family:var(--font-body);font-size:0.85rem;line-height:1.45;color:var(--ink-muted)}
.grow{flex:1}
/* Personality engine: status well (dot + chip + line) over the sign-in well. */
.oa-status{display:flex;align-items:center;flex-wrap:wrap;gap:0.55rem;border:1px solid var(--ring);border-radius:var(--radius-well);background:var(--well-bg);padding:0.8rem 0.95rem;margin-bottom:0.7rem}
.oa-status p{flex-basis:100%;margin:0.2rem 0 0;font-size:0.9rem;line-height:1.5}
.oa-status .chip{color:var(--ink)}
.oa-dot{width:0.55rem;height:0.55rem;border-radius:50%;background:var(--ink-muted);box-shadow:0 0 0 3px var(--ring)}
.oa-status.on{border-color:rgba(48,209,88,0.38)}
.oa-status.on .oa-dot{background:#30d158;box-shadow:0 0 0 3px rgba(48,209,88,0.22)}
.oa-status.on .chip{color:#30d158}
.oa-connect{display:grid;gap:0.5rem;border:1px solid var(--ring);border-radius:var(--radius-well);background:var(--well-bg);padding:0.85rem 0.95rem;margin-bottom:0.6rem}
.oa-connect .chip{color:var(--accent)}
.oa-connect p{margin:0}
.oa-mount{display:flex;align-items:center;flex-wrap:wrap;gap:0.5rem;min-height:2.75rem;margin-top:0.15rem}
.oa-note{font-size:0.8rem;line-height:1.45;color:var(--ink-muted);padding-top:0.6rem;border-top:1px solid var(--ring)}
.muted{color:var(--ink-muted);font-size:0.85rem}
.chip{font-family:var(--font-ui);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted)}
input[type=file]{flex:1;min-width:0;color:var(--ink-muted);font-size:0.85rem;font-family:var(--font-body)}
.idgrid{display:flex;gap:0.6rem;flex-wrap:wrap;margin:0.4rem 0 0.8rem}
.idthumb{width:92px;height:92px;object-fit:cover;border-radius:var(--radius-well);border:1px solid var(--ring);display:block}
.idpick{display:grid;gap:0.4rem;justify-items:center}
.sheetcard{border:1px solid var(--ring);border-radius:var(--radius-well);background:var(--well-bg);padding:0.7rem 0.85rem;margin:0.6rem 0}
.sheetpreview{display:block;width:100%;max-height:280px;object-fit:contain;border-radius:var(--radius-well);border:1px solid var(--ring);margin:0.4rem 0 0.6rem;background:var(--well-bg)}
.booth{display:grid;gap:0.6rem;margin:0.4rem 0 0.8rem}
.booth-controls{display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap}
.booth-error{color:var(--ink);font-size:0.85rem;margin:0}
.booth-clip{display:grid;gap:0.5rem}
.booth-playback{width:100%;border-radius:var(--radius-well);border:1px solid var(--ring);background:#000}
/* iPhone-style camera chrome: black surface, grid, mode strip, ring shutter. */
.cam{border-radius:var(--radius-well);border:1px solid var(--ring);background:#000;overflow:hidden}
.cam-stage{position:relative;min-height:120px;display:flex;align-items:center;justify-content:center;background:#000}
.cam.on .cam-stage{aspect-ratio:3/4;max-height:420px;width:100%}
.cam-video{display:none;width:100%;height:100%;object-fit:cover}
.cam-video.mirror{transform:scaleX(-1)}
.cam.on .cam-video{display:block}
.cam-grid{position:absolute;inset:0;pointer-events:none;opacity:0.55}
.cam-grid i{position:absolute;background:rgba(255,255,255,0.32)}
.cam-grid i:nth-child(1){left:33.33%;top:0;bottom:0;width:1px}
.cam-grid i:nth-child(2){left:66.66%;top:0;bottom:0;width:1px}
.cam-grid i:nth-child(3){top:33.33%;left:0;right:0;height:1px}
.cam-grid i:nth-child(4){top:66.66%;left:0;right:0;height:1px}
.cam-flash{position:absolute;inset:0;background:#fff;opacity:0.85;animation:boothFlash 200ms ease-out forwards}
@keyframes boothFlash{to{opacity:0}}
.cam-clock{position:absolute;top:0.55rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:0.35rem;padding:0.15rem 0.6rem;border-radius:var(--radius-pill);background:rgba(0,0,0,0.55);font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.08em;color:#fff}
.cam-reddot{width:0.5rem;height:0.5rem;border-radius:50%;background:#ff453a;animation:camPulse 1.1s ease-in-out infinite}
@keyframes camPulse{50%{opacity:0.35}}
.cam-count{position:absolute;top:0.55rem;right:0.7rem;padding:0.15rem 0.55rem;border-radius:var(--radius-pill);background:rgba(0,0,0,0.55);font-family:var(--font-ui);font-size:0.66rem;letter-spacing:0.08em;color:#fff}
.cam-start{margin:1.4rem}
.cam-saving{font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#fff;padding:1.4rem}
.cam-deck{display:grid;gap:0.55rem;padding:0.6rem 0.9rem 0.8rem;background:#000}
.cam-modes{display:flex;gap:1.3rem;justify-content:center}
.cam-mode{font-family:var(--font-ui);font-size:0.66rem;letter-spacing:0.14em;color:rgba(255,255,255,0.65);text-decoration:none;padding:0.15rem 0.2rem}
.cam-mode.on{color:#ffd60a}
.cam-mode.off{opacity:0.45}
.cam-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
.cam-thumb{justify-self:start;width:2.6rem;height:2.6rem;border-radius:0.55rem;border:1.5px solid rgba(255,255,255,0.7);background:rgba(255,255,255,0.08);overflow:hidden;display:block}
.cam-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.cam-shutter{justify-self:center;width:3.9rem;height:3.9rem;min-height:0;padding:0;border-radius:50%;background:#fff;border:none;box-shadow:0 0 0 3px #000 inset,0 0 0 5.5px #fff;transition:transform 120ms ease}
.cam-shutter:active{transform:scale(0.92)}
.cam-shutter:disabled{opacity:0.4;cursor:default}
.cam-shutter.rec{background:#ff453a;box-shadow:0 0 0 3px #000 inset,0 0 0 5.5px #fff}
.cam-shutter.rec.on{border-radius:0.85rem;transform:scale(0.72)}
.cam-flip{justify-self:end;width:2.7rem;height:2.7rem;min-height:0;padding:0;border-radius:50%;border:none;background:rgba(255,255,255,0.14);color:#fff;display:flex;align-items:center;justify-content:center}
.cam-flip:disabled{opacity:0.4}
/* Circular gallery review: cards bent along an arc; tap = select. */
.cgal{position:relative;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none;cursor:grab;overflow:hidden}
.cgal-stage{position:relative;height:206px}
.cgal-card{position:absolute;left:50%;top:44%;width:136px;height:164px;border-radius:var(--radius-well);border:1.5px solid var(--ring);overflow:hidden;background:var(--well-bg);box-shadow:var(--shadow);transition:opacity 180ms ease,border-color 180ms ease}
.cgal-card img{width:100%;height:100%;object-fit:cover;display:block}
.cgal-card.picked{border-color:#30d158}
.cgal-card:not(.picked) img{opacity:0.55}
.cgal-card.front{box-shadow:0 10px 30px rgba(0,0,0,0.35)}
.cgal-check{position:absolute;top:0.4rem;right:0.4rem;width:1.5rem;height:1.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,0.85);background:rgba(0,0,0,0.35);color:transparent;transition:background 150ms ease,color 150ms ease}
.cgal-check.on{background:#30d158;border-color:#30d158;color:#fff}
.cgal-dots{display:flex;gap:0.4rem;justify-content:center;margin-top:0.3rem}
.cgal-dot{width:0.55rem;height:0.55rem;min-height:0;padding:0;border-radius:50%;background:var(--ring)}
.cgal-dot.on{background:var(--accent)}
.cgal-hint{font-family:var(--font-ui);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted);text-align:center;margin:0.35rem 0 0}
.cam-confirm{display:inline-flex;align-items:center;gap:0.5rem;background:#30d158;border-color:#30d158;color:#fff}
.cam-confirm .cgal-check{position:static;width:1.3rem;height:1.3rem;background:rgba(255,255,255,0.2);border-color:transparent;color:#fff}
.cam-confirm:disabled{opacity:0.45}
/* In-slide stepper: circles + connectors above the panels, one at a time. */
.stepper-head{display:flex;align-items:center;justify-content:center;margin:0.2rem 0 0.9rem}
.stepper-node{display:flex;align-items:center}
.stepper-ind{width:2.1rem;height:2.1rem;min-height:0;padding:0;border-radius:50%;border:1.5px solid var(--ring);background:var(--panel-bg);color:var(--ink-muted);font-family:var(--font-ui);font-size:0.72rem;display:flex;align-items:center;justify-content:center;transition:background 200ms ease,color 200ms ease,border-color 200ms ease}
.stepper-ind.active{background:var(--accent);border-color:var(--accent);color:var(--panel-bg)}
.stepper-ind.complete{background:#30d158;border-color:#30d158;color:#fff}
.stepper-line{width:2.6rem;height:2px;background:var(--ring);position:relative;overflow:hidden}
.stepper-line i{position:absolute;inset:0;background:#30d158;transform:scaleX(0);transform-origin:left;transition:transform 300ms ease}
.stepper-line.complete i{transform:scaleX(1)}
.stepper-panel-hidden{display:none}
.stepper-nav{display:flex;justify-content:space-between;align-items:center;margin-top:0.4rem}
.stepper-nav .spacer{flex:1}
@media(prefers-reduced-motion:reduce){.cam-flash{animation:none;opacity:0}.cam-reddot{animation:none}.cgal-card,.stepper-ind,.stepper-line i{transition:none}}
`;

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

export function renderOnboarding(
  current: Theme,
  snapshot: OnboardingSnapshot,
  active: OnboardingStepId,
  notice: string | null,
  lite = false,
  browserSignin: string | null = null
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
  // iPhone-style page dots: swipe (or tap a dot) to move between slides and
  // skip anything — except that slides past Computer stay locked until the
  // username (agent mailbox) exists.
  const dots = SLIDE_GROUPS.map((target, i) => {
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
  const backdrop = current.backdrop;
  const shader =
    backdrop.kind === "shader" && !lite
      ? `<script src="${esc(backdrop.script)}" defer></script>`
      : "";
  // The shader element paints itself; if fx.js or WebGL is unavailable it
  // stays an empty inert box and the canvas gradient carries the page.
  const backdropHtml =
    backdrop.kind === "shader" && !lite
      ? backdrop.element.replace("<wz-sky", '<wz-sky class="backdrop"')
      : "";
  const grain =
    backdrop.grain && !lite
      ? '<div class="grain" aria-hidden="true"></div>'
      : "";
  const scrim =
    current.tokens.scrim === "none"
      ? ""
      : '<div class="scrim" aria-hidden="true"></div>';
  // Each section is one card; a slide is the concatenation of the bodies of
  // the steps it owns, so every sub-step keeps its own forms and actions.
  const card = (section: SlideSection): string => {
    const heading = section.label
      ? `<h2 class="subhead">${esc(section.label)}</h2>`
      : "";
    const done = sectionDone(snapshot, section.key) ? " data-step-done" : "";
    return `<section class="panel"${done}>${heading}${sectionBody(snapshot, section.key, browserSignin, lite)}</section>`;
  };
  // Sections that declare a pane render inside a scroll-snap pager — the
  // Photo Booth's photo/video two-part flow — with a segmented control on
  // top; anchors + CSS scroll-snap keep it working without JS, and lite
  // (Messages webview) renders stay a plain stack.
  const panes = lite
    ? []
    : [...new Set(slide.sections.map((s) => s.pane).filter(Boolean))] as string[];
  // A stacked multi-section slide (no pager, no split columns) renders as
  // a stepper; deep links land on the panel that owns the active step.
  const stepper =
    !lite && !slide.split && panes.length <= 1 && slide.sections.length > 1;
  // A pending character-sheet draft pulls the booth to its review panel —
  // generate/confirm actions land back on ?step=selfies, which would
  // otherwise reopen the first panel and hide the Save/Discard controls.
  const draftPending =
    slide.id === "booth" &&
    shownStep === "selfies" &&
    snapshot.identityMedia.some((m) => m.role === "character_sheet_draft");
  const activeSection = draftPending
    ? slide.sections.findIndex((s) => s.key === "sheet")
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
      : slide.sections.map(card).join("");
  // Same-origin bundles, one per slide that needs one.
  const scripts = [
    !lite && slide.id === "booth"
      ? '<script src="/creator-os/identity-booth.js" defer></script>'
      : "",
    slide.id === "start"
      ? '<script src="/creator-os/prompt-copy.js" defer></script>'
      : "",
    // The deck swipes like an iPhone: a horizontal touch swipe anywhere on
    // the slide navigates back/forward (same-origin bundle, touch only).
    lite ? "" : '<script src="/creator-os/deck-swipe.js" defer></script>',
    // Multi-section slides fold into a stepper (one panel at a time with
    // indicator circles); with no JS the panels simply stack.
    stepper ? '<script src="/creator-os/deck-stepper.js" defer></script>' : "",
  ].join("");
  const deck = `<div class="deck${slide.split ? " split" : ""}"${stepper ? ` data-stepper data-stepper-active="${activeSection}"` : ""}>${sections}</div>${scripts}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Onboarding — ${esc(slide.title)}</title>${fonts}<style>${tokenBlock(current.tokens)}${SLIDE_CSS}${lite ? LITE_CSS : ""}</style>${shader}</head><body>${backdropHtml}${scrim}${grain}<div class="frame"${prev ? ` data-swipe-prev="${href(prev)}"` : ""}${next ? ` data-swipe-next="${href(next)}"` : ""}><header class="bar"><span class="logo-pill"><img src="/creator-os/wzrd-wordmark-1600.png" alt="WZRD.tech"></span><span class="counter">${counter}${esc(statusTag)}</span></header><main class="slide">${busy}${noticeHtml}<p class="kicker">${kickerNumber}${esc(slide.kicker)}</p><h1>${esc(slide.title)}</h1>${deck}</main><footer class="nav">${prev ? `<a class="navlink" href="${href(prev)}">← Back</a>` : '<span class="navlink ghosted">← Back</span>'}<nav class="dots" aria-label="Slides">${dots}</nav>${next ? `<a class="navlink" href="${href(next)}">Next →</a>` : '<span class="navlink ghosted">Next →</span>'}</footer></div></body></html>`;
}

/** The step the URL asks for, if it names a real one. */
function requestedStep(ctx: MiniAppContext): OnboardingStepId | null {
  const requested = ctx.request.nextUrl.searchParams.get("step") ?? "";
  return isOnboardingStep(requested) ? requested : null;
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

/** Identity slides preview signed private media — the CSP widens only for
 * those renders. */
const rendersIdentityMedia = (step: OnboardingStepId): boolean =>
  slideForStep(step).id === "booth";

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

/** The welcome slide plays the intro film from /creator-os. */
const rendersIntro = (step: OnboardingStepId, lite: boolean): boolean =>
  !lite && slideForStep(step).id === "welcome";

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
  return slides(
    current,
    renderOnboarding(
      current,
      snapshot,
      active,
      notice,
      ctx.session.via === "card",
      browserSigninHref(ctx, snapshot, active)
    ),
    rendersNativeOnairos(snapshot, active),
    rendersIdentityMedia(active),
    rendersBooth(active, ctx.session.via === "card"),
    rendersPrompts(active),
    rendersIntro(active, ctx.session.via === "card"),
    ctx.session.via !== "card"
  );
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
    const { snapshot, active } = await snapshotForRender(
      ctx.supabase,
      ctx.session.userId,
      requestedStep(ctx)
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
    return slides(
      current,
      renderOnboarding(
        current,
        snapshot,
        active,
        null,
        ctx.session.via === "card",
        browserSigninHref(ctx, snapshot, active)
      ),
      rendersNativeOnairos(snapshot, active),
      rendersIdentityMedia(active),
      rendersBooth(active, ctx.session.via === "card"),
      rendersPrompts(active),
      rendersIntro(active, ctx.session.via === "card"),
      ctx.session.via !== "card"
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const supabase = ctx.supabase;
    const userId = ctx.session.userId;
    const action = String(form.get("action") ?? "");

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
      try {
        await switchEnvironment(supabase, userId, value);
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "environment switch failed",
            user_id: userId,
            environment: value,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
        return respond(
          ctx,
          "environment",
          `${ENVIRONMENT_PROFILES[value].label} isn't available right now — try another, or skip and switch later.`
        );
      }
      await markSafely(supabase, userId, "environment", "done");
      return respond(
        ctx,
        null,
        `Your agent now lives on ${ENVIRONMENT_PROFILES[value].label}.`
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

    if (action === "set_speed") {
      const tier = String(form.get("speed_tier") ?? "");
      if (!isSpeedTier(tier)) return forbidden("invalid tier");
      const ok = await setSpeedTier(supabase, userId, tier);
      if (ok) await markSafely(supabase, userId, "model", "done");
      return respond(ctx, ok ? null : "model", ok ? `Speed set to ${tier}.` : "Update failed — try again.");
    }

    if (action === "upload_selfie") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return respond(ctx, "selfies", "Choose an image first.");
      }
      const result = await uploadIdentityImage(supabase, userId, file, "selfie");
      if (!result.ok) return respond(ctx, "selfies", result.error);
      await markSafely(supabase, userId, "selfies", "done");
      return respond(ctx, "selfies", "Added to your image vault.");
    }

    if (action === "generate_character_sheet") {
      const { data: user } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const username = (user?.username as string | null) ?? null;
      if (!username) {
        return respond(ctx, "username", "Pick a username first — the character sheet is bound to your @name.");
      }
      // Step 1 of 2: the render lands as a draft — nothing enters the
      // vault until save_character_sheet.
      const result = await generateCharacterSheet(supabase, userId, username);
      return respond(ctx, "selfies", result.notice);
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
