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
import { NextResponse } from "next/server";
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
  setSpeedTier,
  setUsername,
  SPEED_TIERS,
} from "@/lib/settings/account";
import { getMerchant, startOnboarding, type Merchant } from "@/lib/commerce/merchants";
import {
  mintIngestTicket,
  readIngestStatus,
  type IngestStatus,
} from "@/lib/imessage/ingest";
import { env } from "@/lib/env";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";
import {
  beginConnect,
  syncConnections,
  TOOLKIT_SLUG_PATTERN,
  type ConnectionRow,
} from "@/lib/connectors/manage";
import { createRun, MAIN_SESSION } from "@/lib/hermes/client";
import {
  defaultOnboardingState,
  isOnboardingStep,
  markOnboardingStep,
  ONBOARDING_STEPS,
  readOnboardingState,
  type OnboardingState,
  type OnboardingStepId,
} from "../onboarding";
import {
  getAvatarAssetId,
  listIdentityAssets,
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
import { onairosProvider, type OnairosStatus } from "./onairos";
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
import type { MiniAppContext, MiniAppModule } from "./types";

const STEP_TITLES: Record<OnboardingStepId, string> = {
  environment: "Pick your agent's computer",
  username: "Pick your username",
  email: "Your agent's email",
  model: "Model preference",
  selfies: "Take selfies & pro photos",
  twin: "Record your digital twin",
  avatar: "Create your avatar",
  imessage: "Ingest iMessage history",
  onairos: "Personal context",
  connect: "Connect your apps",
  secrets: "Secrets",
  stripe: "Stripe account",
  link: "Connect Link",
  agent: "Meet your agent",
  walkthrough: "Walkthrough & first workflows",
};

/** Mono kicker line above each slide title — the "why" in one breath. */
const STEP_KICKERS: Record<OnboardingStepId, string> = {
  environment: "Computer",
  username: "Identity",
  email: "Inbox",
  model: "Thinking speed",
  selfies: "Image Vault",
  twin: "Digital Twin",
  avatar: "Avatar",
  imessage: "Context · iMessage",
  onairos: "Context · Onairos",
  connect: "Actions · Integrations",
  secrets: "Key vault",
  stripe: "Get paid",
  link: "Agent payments",
  agent: "First contact",
  walkthrough: "Tour & workflows",
};

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

/** Onboarding offers the golden-path action toolkits; the Connect app has all. */
const ONBOARDING_TOOLKITS: Array<[string, string]> = [
  ["gmail", "Gmail"],
  ["googlecalendar", "Google Calendar"],
  ["notion", "Notion"],
  ["slack", "Slack"],
  ["github", "GitHub"],
];

export interface OnboardingSnapshot {
  state: OnboardingState;
  /** The environment the user's compute currently runs (boxes.environment). */
  environment: ComputeEnvironment;
  username: string | null;
  address: string | null;
  identityMedia: IdentityMediaView[];
  avatarAssetId: string | null;
  twin: DigitalTwin | null;
  twinAvailable: boolean;
  connections: ConnectionRow[];
  managers: ManagerStatus[];
  vaultItemCount: number;
  onairos: OnairosStatus;
  speedTier: string | null;
  merchant: Merchant | null;
  link: LinkAuthDoc | null;
  pluginSessions: number;
  ingest: IngestStatus | null;
  ingestCommand: string | null;
  boxBusy: boolean;
}

export async function loadOnboardingSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingSnapshot> {
  return loadSnapshot(supabase, userId);
}

async function loadSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingSnapshot> {
  let state = defaultOnboardingState();
  let boxBusy = false;
  try {
    state = await readOnboardingState(supabase, userId);
  } catch (error) {
    if (!(error instanceof StartLimitError)) throw error;
    boxBusy = true;
  }
  const [
    { data: user },
    { data: addressRow },
    { data: connectionRows },
    managers,
    { count },
    onairos,
    { data: entitlement },
    merchant,
    link,
    { count: pluginCount },
    ingest,
    identityMedia,
    avatarAssetId,
    twin,
    { data: boxRow },
  ] = await Promise.all([
    supabase.from("users").select("username").eq("id", userId).maybeSingle(),
    supabase
      .from("agent_addresses")
      .select("address")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .is("retired_at", null)
      .maybeSingle(),
    supabase
      .from("connections")
      .select("toolkit, status, connected_at")
      .eq("user_id", userId),
    listManagers(supabase, userId).catch(() => [] as ManagerStatus[]),
    supabase
      .from("vault_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
    onairosProvider.status(supabase, userId).catch(
      (): OnairosStatus => ({
        available: false,
        connected: false,
        connect_url: null,
      })
    ),
    supabase
      .from("entitlements")
      .select("speed_tier")
      .eq("user_id", userId)
      .maybeSingle(),
    getMerchant(supabase, userId).catch(() => null),
    readLinkAuthDoc(supabase, userId).catch(() => null),
    supabase
      .from("plugin_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null),
    readIngestStatus(supabase, userId).catch(() => null),
    listIdentityMediaViews(supabase, userId),
    getAvatarAssetId(supabase, userId).catch(() => null),
    getDigitalTwin(supabase, userId).catch(() => null),
    supabase
      .from("boxes")
      .select("environment")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return {
    state,
    environment: toComputeEnvironment(boxRow?.environment),
    username: (user?.username as string | null) ?? null,
    address: (addressRow?.address as string | null) ?? null,
    identityMedia,
    avatarAssetId,
    twin,
    twinAvailable: env.gmiCloudApiKey() !== null,
    connections: (connectionRows ?? []) as ConnectionRow[],
    managers,
    vaultItemCount: count ?? 0,
    onairos,
    speedTier: (entitlement?.speed_tier as string | null) ?? null,
    merchant,
    link,
    pluginSessions: pluginCount ?? 0,
    ingest,
    ingestCommand: buildIngestCommand(userId),
    boxBusy,
  };
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
  }
}

function firstOpenStep(snapshot: OnboardingSnapshot): OnboardingStepId {
  for (const step of ONBOARDING_STEPS) {
    if (effectiveStatus(snapshot, step) === "todo") return step;
  }
  return "walkthrough";
}

/** Confirmed vault references — drafts and the avatar pointer excluded. */
const isVaultMedia = (m: IdentityMediaView): boolean =>
  m.role === "selfie" || m.role === "character_sheet";

/** Same-origin photo-booth mount (script-src 'self'); the plain upload
 * forms below it stay the lite/Messages and no-camera path. */
function boothMount(mode: "photo" | "video"): string {
  return `<div id="identity-booth" data-mode="${mode}"></div><script src="/creator-os/identity-booth.js" defer></script>`;
}

function skipForm(step: OnboardingStepId, label = "Skip for now"): string {
  return `<form method="post" class="inline"><input type="hidden" name="action" value="skip"><input type="hidden" name="step" value="${esc(step)}"><button class="ghost">${esc(label)}</button></form>`;
}

function doneForm(step: OnboardingStepId, label: string): string {
  return `<form method="post" class="inline"><input type="hidden" name="action" value="mark_done"><input type="hidden" name="step" value="${esc(step)}"><button>${esc(label)}</button></form>`;
}

function stepBody(
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId,
  browserSignin: string | null,
  lite = false
): string {
  if (step === "environment") {
    const cards = COMPUTE_ENVIRONMENTS.map((environment) => {
      const profile = ENVIRONMENT_PROFILES[environment];
      const current = environment === snapshot.environment;
      const name = `<span class="envname">${esc(profile.label)}${current ? '<span class="envtag">Current</span>' : ""}${profile.comingSoon && !current ? '<span class="envtag soon">Coming soon</span>' : ""}</span>`;
      const inner = `${name}<span class="envblurb">${esc(profile.blurb)}</span>`;
      if (profile.comingSoon && !current) {
        return `<div class="envcard off" aria-disabled="true">${inner}</div>`;
      }
      return `<form method="post" class="envform"><input type="hidden" name="action" value="set_environment"><input type="hidden" name="environment" value="${esc(environment)}"><button class="envcard${current ? " current" : ""}">${inner}</button></form>`;
    }).join("");
    return `<p class="muted">Your agent gets its own computer. Pick where it lives — you can switch later, but its files start fresh on the new machine.</p><div class="envgrid">${cards}</div>`;
  }
  if (step === "username") {
    const current = snapshot.username
      ? `<p>Current: <strong>@${esc(snapshot.username)}</strong></p>`
      : "";
    return `${current}<p class="muted">Lowercase letters, digits, underscore — 2–24 characters. Your agent's email follows it.</p><form method="post" class="row"><input type="hidden" name="action" value="set_username"><input type="text" name="username" placeholder="username" maxlength="24" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="done"><button>Save</button></form><div class="row actions">${skipForm("username")}</div>`;
  }
  if (step === "email") {
    const line = snapshot.address
      ? `<p>Your agent reads and drafts at <strong>${esc(snapshot.address)}</strong>. Sending always waits for your approval.</p>`
      : `<p class="muted">Your agent's inbox is provisioned automatically when you set a username — no extra step.</p>`;
    return `${line}<div class="row actions">${snapshot.address ? doneForm("email", "Looks good") : ""}${skipForm("email")}</div>`;
  }
  if (step === "model") {
    const buttons = SPEED_TIERS.map(
      (tier) =>
        `<form method="post" class="inline"><input type="hidden" name="action" value="set_speed"><input type="hidden" name="speed_tier" value="${esc(tier)}"><button${tier === snapshot.speedTier ? "" : ' class="ghost"'}>${esc(tier)}</button></form>`
    ).join("");
    return `<p class="muted">Pick how your agent thinks — faster answers or deeper reasoning. A tier, never a specific model; change it any time in Settings.</p><div class="row">${buttons}</div><div class="row actions">${skipForm("model")}</div>`;
  }
  if (step === "selfies") {
    const references = snapshot.identityMedia.filter(isVaultMedia);
    const thumbs = references
      .filter((m) => m.url)
      .map(
        (m) =>
          `<img class="idthumb" src="${esc(m.url ?? "")}" alt="${esc(m.role === "character_sheet" ? "character sheet" : "selfie")}">`
      )
      .join("");
    const gallery = thumbs ? `<div class="idgrid">${thumbs}</div>` : "";
    // Booth captures post upload_selfie on finalize; the plain form stays
    // the lite/Messages and no-camera path (capture="user" opens the iPhone
    // camera directly from the picker).
    const booth = lite ? "" : boothMount("photo");
    const upload = `<details${lite ? " open" : ""}><summary>Upload from your library</summary><form method="post" enctype="multipart/form-data" class="row"><input type="hidden" name="action" value="upload_selfie"><input type="file" name="file" accept="image/png,image/jpeg,image/webp" capture="user"><button>Upload</button></form></details>`;
    // Two-step character sheet, same card: generate renders a draft; the
    // owner then saves it into the vault or discards it.
    const draft = snapshot.identityMedia.find(
      (m) => m.role === "character_sheet_draft"
    );
    const sheet = !snapshot.username
      ? `<p class="muted">Set a <a href="?step=username">username</a> first — the character sheet is bound to your @name.</p>`
      : draft
        ? `<div class="sheetcard"><p class="muted">Step 2 of 2 — review your character sheet, then save it to the vault or discard it.</p>${draft.url ? `<img class="sheetpreview" src="${esc(draft.url)}" alt="character sheet draft">` : ""}<div class="row"><form method="post" class="inline"><input type="hidden" name="action" value="save_character_sheet"><input type="hidden" name="asset_id" value="${esc(draft.assetId)}"><button>Save to vault</button></form><form method="post" class="inline"><input type="hidden" name="action" value="discard_character_sheet"><input type="hidden" name="asset_id" value="${esc(draft.assetId)}"><button class="ghost">Discard</button></form></div></div>`
        : `<div class="sheetcard"><p class="muted">Step 1 of 2 — generate a character sheet from your photos; you review it before anything is saved.</p><form method="post" class="inline"><input type="hidden" name="action" value="generate_character_sheet"><button${references.length > 0 ? "" : ' class="ghost"'}>Generate character sheet</button></form></div>`;
    return `<p class="muted">Step into the booth — photos live privately in your image vault and anchor your @${esc(snapshot.username ?? "username")} identity for generated media.</p>${booth}${gallery}${upload}${sheet}<div class="row actions">${skipForm("selfies")}</div>`;
  }
  if (step === "twin") {
    if (!snapshot.twinAvailable) {
      return `<p class="muted">Digital twin creation isn't configured on this deployment — set it up later from Settings once it is. Nothing here blocks the rest of setup.</p><div class="row actions">${skipForm("twin", "Skip — not configured")}</div>`;
    }
    const twin = snapshot.twin;
    const consent = twin?.consent_video_key
      ? `<p>Consent recording on file.</p>`
      : `${lite ? "" : boothMount("video")}<details${lite ? " open" : ""}><summary>Upload a recording instead</summary><p class="muted">Record or upload a short video of yourself saying you consent to creating a digital twin of your likeness.</p><form method="post" enctype="multipart/form-data" class="row"><input type="hidden" name="action" value="upload_consent"><input type="file" name="file" accept="video/mp4,video/webm" capture="user"><button>Upload consent</button></form></details>`;
    const reference = snapshot.identityMedia.find(
      (m) => isVaultMedia(m) && m.url
    );
    const create = reference
      ? `<form method="post" class="stack"><input type="hidden" name="action" value="create_twin"><input type="text" name="script" placeholder="What should @${esc(snapshot.username ?? "you")} say? (a sentence or two)" maxlength="500"><button>Create twin video</button></form>`
      : `<p class="muted">Add a photo on the <a href="?step=selfies">selfies step</a> first — the twin animates your reference image.</p>`;
    const statusLine = twin
      ? `<p>Twin status: <strong>${esc(twin.status)}</strong>.</p>`
      : "";
    return `<p class="muted">Create a HeyGen Avatar IV talking-head twin from your reference photo. The video is delivered privately — only you can share it.</p>${statusLine}${consent}${create}<div class="row actions">${skipForm("twin")}</div>`;
  }
  if (step === "avatar") {
    // First option: mint a HeyGen avatar ID from an identity image (when
    // configured). Fallback: pick a photo directly — renders go straight
    // through GMI with the raw image.
    const heygenBlock = heygenAvailable()
      ? snapshot.twin?.provider_avatar_id
        ? `<p>HeyGen avatar ready — videos render with your trained avatar ID.</p>`
        : snapshot.identityMedia.some(isVaultMedia)
          ? `<form method="post" class="inline"><input type="hidden" name="action" value="create_heygen_avatar"><button>Create HeyGen avatar</button></form><p class="muted">Recommended — trains a reusable avatar ID from your newest identity image.</p>`
          : `<p class="muted">Add a photo on the <a href="?step=selfies">selfies step</a> to create a HeyGen avatar.</p>`
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
    return `<p class="muted">Pick the image that represents @${esc(snapshot.username ?? "you")} — generated media can reference it as your likeness.</p>${heygenBlock}${gallery}<div class="row actions">${generate}${skipForm("avatar")}</div>`;
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
    if (!snapshot.onairos.available) {
      return `<p class="muted">Onairos personal context isn't configured on this deployment — connect it later from Settings once it is. Nothing here blocks the rest of setup.</p><div class="row actions">${skipForm("onairos", "Skip — not configured")}</div>`;
    }
    if (snapshot.onairos.connected) {
      return `<p>Connected — your imported context lives on your computer, and Settings has Re-sync / Disconnect.</p><div class="row actions">${skipForm("onairos")}</div>`;
    }
    const apiKey = env.onairosApiKey() ?? "";
    const googleClientId = env.onairosGoogleClientId();
    const googleAttr = googleClientId
      ? ` data-google-client-id="${esc(googleClientId)}"`
      : "";
    // Google blocks OAuth inside embedded webviews (disallowed_useragent),
    // so a card-opened Messages sheet offers a signed jump into the real
    // browser where the Google path works.
    const browserLine = browserSignin
      ? `<p class="muted">Using Google to sign in? Google blocks sign-in inside Messages — <a href="${esc(browserSignin)}" target="_blank" rel="noopener">open this step in your browser</a>, finish there, then come back and tap Refresh.</p><form method="post" class="inline"><input type="hidden" name="action" value="noop"><button class="ghost">Refresh</button></form>`
      : "";
    // The native SDK flow runs right here; the key only ever renders on the
    // owner's own authenticated slide (never in a public bundle), and the
    // handoff posts back as a regular form (action=onairos_handoff).
    return `<p class="muted">Sign in with Onairos to import your personal context — the consent flow opens right here, and your imported context lives on your computer, never on the platform.</p><div id="onairos-connect" data-api-key="${esc(apiKey)}"${googleAttr}><p class="muted">Loading Onairos sign-in…</p></div><script src="/creator-os/onairos-connect.js" defer></script>${browserLine}<details><summary>Or connect via iMessage</summary><p class="muted">Onairos asks for your account email, a verification code, and your YES right in your iMessage thread.</p><form method="post" class="inline"><input type="hidden" name="action" value="connect_onairos"><button class="ghost">Connect via iMessage</button></form></details><div class="row actions">${skipForm("onairos")}</div>`;
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
    return `<p class="muted">Your agent fills secrets only with your approval. Use the built-in vault, or bring your own manager.</p>${managerLines}<details><summary>Add a first login (built-in vault)</summary><form method="post" class="stack"><input type="hidden" name="action" value="add_login"><input type="text" name="name" placeholder="e.g. &quot;Gmail&quot;" maxlength="120"><input type="text" name="username" placeholder="Username" maxlength="200"><input type="password" name="password" placeholder="Password" maxlength="500" autocomplete="off"><button>Save to vault</button></form></details><details><summary>Bring your own manager</summary><form method="post" class="stack"><input type="hidden" name="action" value="enable_manager"><select name="manager"><option value="bitwarden">Bitwarden (machine-account token)</option><option value="onepassword">1Password (service-account token)</option></select><input type="password" name="token" placeholder="Access token" maxlength="512" autocomplete="off"><button>Enable</button></form><p class="muted">The token goes straight to your agent's computer — it is never stored on the platform or shown again.</p></details><div class="row actions">${settled ? doneForm("secrets", "Done with secrets") : ""}${skipForm("secrets")}</div>`;
  }
  if (step === "stripe") {
    const merchant = snapshot.merchant;
    const connectForm = (label: string): string =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="connect_stripe"><button>${esc(label)}</button></form>`;
    const status = !merchant
      ? `<p class="muted">Connect your own Stripe account (Stripe Connect) so you can sell through your storefront — funds settle directly to you; the platform never holds your money. You can do this now or later.</p><div class="row actions">${connectForm("Connect Stripe")}${skipForm("stripe", "Later")}</div>`
      : merchant.charges_enabled
        ? `<p>Stripe connected — charges enabled. Manage it from the Shop app.</p><div class="row actions">${skipForm("stripe", "Continue")}</div>`
        : `<p>Stripe onboarding in progress.</p><div class="row actions">${connectForm("Resume onboarding")}${skipForm("stripe", "Later")}</div>`;
    return status;
  }
  if (step === "link") {
    const link = snapshot.link;
    const intro = `<p class="muted">Link is Stripe's wallet. Pairing your agent's computer with your Link account lets it request one-time-use payment credentials for purchases and bookings — every spend still waits for your approval at link.com, and you always click the final Pay button.</p>`;
    if (link?.authenticated) {
      return `${intro}<p>Link connected — your agent can request payment credentials, and each spend still needs your approval.</p><div class="row actions">${skipForm("link", "Continue")}</div>`;
    }
    if (link && !link.installed) {
      return `${intro}<p class="muted">The Link CLI isn't on your agent's computer yet — it arrives with the next computer update. Skip for now and connect later from here.</p><div class="row actions">${skipForm("link", "Skip — not ready yet")}</div>`;
    }
    const connectForm = (label: string): string =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="link_connect"><button>${esc(label)}</button></form>`;
    const checkForm = `<form method="post" class="inline"><input type="hidden" name="action" value="link_check"><button>I approved — check status</button></form>`;
    const pendingUrl = safeVerificationUrl(link?.verification_url ?? null);
    if (pendingUrl) {
      const phrase = link?.phrase
        ? `<p>Confirm this phrase at link.com: <strong>${esc(link.phrase)}</strong></p>`
        : "";
      return `${intro}<p><a href="${esc(pendingUrl)}" target="_blank" rel="noopener">Approve the connection at link.com</a></p>${phrase}<p class="muted">Opens in your browser — no app to install. Log in or sign up with the email on your Link wallet. The code expires after a few minutes; use Start over for a fresh one.</p><div class="row actions">${checkForm}${connectForm("Start over")}${skipForm("link", "Later")}</div>`;
    }
    return `${intro}<div class="row actions">${connectForm("Connect Link")}${skipForm("link", "Later")}</div>`;
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
  return `<p class="muted">Say hello — your agent replies in your chat (iMessage or the web tab), same conversation everywhere.</p><form method="post" class="row"><input type="hidden" name="action" value="ask_agent"><input type="text" name="text" placeholder="e.g. What can you do for me?" maxlength="4000" enterkeyhint="send"><button>Send</button></form><div class="row actions">${skipForm("agent")}</div>`;
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
  booth = false
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
.envgrid{display:grid;gap:0.6rem;margin-top:0.6rem}
form.envform{display:block}
.envcard{display:flex;flex-direction:column;align-items:flex-start;gap:0.35rem;width:100%;min-height:4.5rem;padding:0.9rem 1rem;border-radius:var(--radius-well);border:1px solid var(--ring);background:var(--well-bg);text-align:left;text-transform:none;letter-spacing:0;color:var(--ink)}
button.envcard:hover{transform:none;border-color:var(--accent)}
button.envcard:active{transform:scale(0.99)}
.envcard.current{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.envcard.off{opacity:0.6}
.envname{font-family:var(--font-ui);font-size:0.78rem;letter-spacing:0.09em;text-transform:uppercase;display:flex;gap:0.55rem;align-items:center;flex-wrap:wrap}
.envtag{font-size:0.58rem;letter-spacing:0.1em;color:var(--accent);border:1px solid var(--accent);border-radius:var(--radius-pill);padding:0.15rem 0.5rem}
.envtag.soon{color:var(--ink-muted);border-color:var(--ring)}
.envblurb{font-family:var(--font-body);font-size:0.85rem;line-height:1.45;color:var(--ink-muted)}
.grow{flex:1}
.muted{color:var(--ink-muted);font-size:0.85rem}
.chip{font-family:var(--font-ui);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted)}
input[type=file]{flex:1;min-width:0;color:var(--ink-muted);font-size:0.85rem;font-family:var(--font-body)}
.idgrid{display:flex;gap:0.6rem;flex-wrap:wrap;margin:0.4rem 0 0.8rem}
.idthumb{width:92px;height:92px;object-fit:cover;border-radius:var(--radius-well);border:1px solid var(--ring);display:block}
.idpick{display:grid;gap:0.4rem;justify-items:center}
.sheetcard{border:1px solid var(--ring);border-radius:var(--radius-well);background:var(--well-bg);padding:0.7rem 0.85rem;margin:0.6rem 0}
.sheetpreview{display:block;width:100%;max-height:280px;object-fit:contain;border-radius:var(--radius-well);border:1px solid var(--ring);margin:0.4rem 0 0.6rem;background:var(--well-bg)}
.booth{display:grid;gap:0.6rem;margin:0.4rem 0 0.8rem}
.booth-stage{position:relative;border-radius:var(--radius-well);border:1px solid var(--ring);background:var(--well-bg);overflow:hidden;min-height:120px;display:flex;align-items:center;justify-content:center}
.booth-stage.on{aspect-ratio:4/3}
.booth-video{display:none;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
.booth-stage.on .booth-video{display:block}
.booth-flash{position:absolute;inset:0;background:#fff;opacity:0.85;animation:boothFlash 220ms ease-out forwards}
@keyframes boothFlash{to{opacity:0}}
.booth-count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-ui);font-size:4rem;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,0.6)}
.booth-rec{position:absolute;top:0.6rem;left:0.7rem;font-family:var(--font-ui);font-size:0.62rem;letter-spacing:0.12em;color:#ff5a5a;text-shadow:0 1px 6px rgba(0,0,0,0.6)}
.booth-start{margin:1.4rem}
.booth-saving{font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted);padding:1.4rem}
.booth-controls{display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap}
.booth-hint{font-family:var(--font-ui);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted)}
.booth-error{color:var(--ink);font-size:0.85rem;margin:0}
.booth-shutter{width:3.4rem;height:3.4rem;min-height:0;padding:0;border-radius:50%;background:var(--ink);border:3px solid var(--ring);box-shadow:0 0 0 3px var(--ink) inset}
.booth-shutter:disabled{opacity:0.4;cursor:default}
.booth-clip{display:grid;gap:0.5rem}
.booth-playback{width:100%;border-radius:var(--radius-well);border:1px solid var(--ring);background:#000}
.dcar{position:relative;perspective:1100px;touch-action:pan-y;outline:none;user-select:none;-webkit-user-select:none;cursor:grab}
.dcar-stage{position:relative;height:190px;transform-style:preserve-3d}
.dcar-card{position:absolute;left:50%;top:50%;width:132px;height:158px;border-radius:var(--radius-well);border:1px solid var(--ring);overflow:hidden;background:var(--well-bg);box-shadow:var(--shadow);transition:opacity 180ms ease}
.dcar-card img{width:100%;height:100%;object-fit:cover;display:block}
.dcar-card.dropped img{opacity:0.3;filter:grayscale(1)}
.dcar-card.front{border-color:var(--accent)}
.dcar-toggle{position:absolute;left:50%;bottom:0.4rem;transform:translateX(-50%);min-height:0;padding:0.25rem 0.7rem;font-size:0.58rem}
.dcar-dots{display:flex;gap:0.4rem;justify-content:center;margin-top:0.4rem}
.dcar-dot{width:0.55rem;height:0.55rem;min-height:0;padding:0;border-radius:50%;background:var(--ring)}
.dcar-dot.on{background:var(--accent)}
@media(prefers-reduced-motion:reduce){.booth-flash{animation:none;opacity:0}.dcar-card{transition:none}}
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
  const index = ONBOARDING_STEPS.indexOf(active);
  const prev = index > 0 ? ONBOARDING_STEPS[index - 1] : null;
  const next =
    index < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[index + 1] : null;
  const pad = (n: number): string => String(n).padStart(2, "0");
  // Keep a non-default theme across slide navigation.
  const href = (step: OnboardingStepId): string =>
    current.id === DEFAULT_THEME
      ? `?step=${esc(step)}`
      : `?step=${esc(step)}&amp;theme=${esc(current.id)}`;
  const dots = ONBOARDING_STEPS.map((step, i) => {
    const status = effectiveStatus(snapshot, step);
    const cls = [
      step === active ? "active" : "",
      status === "done" ? "done" : status === "skipped" ? "skipped" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<a href="${href(step)}"${cls ? ` class="${cls}"` : ""} aria-label="${pad(i + 1)} ${esc(STEP_TITLES[step])}" title="${esc(STEP_TITLES[step])}"></a>`;
  }).join("");
  const noticeHtml = notice
    ? `<div class="notice">${esc(notice)}</div>`
    : "";
  const busy = snapshot.boxBusy
    ? '<div class="notice">Your agent\'s computer is busy starting up — progress will save once it\'s awake.</div>'
    : "";
  const status = effectiveStatus(snapshot, active);
  const statusTag =
    status === "done"
      ? " · done"
      : status === "skipped"
        ? " · skipped"
        : "";
  const fonts =
    current.fontStylesheet === null
      ? ""
      : `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(current.fontStylesheet)}">`;
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Onboarding — ${esc(STEP_TITLES[active])}</title>${fonts}<style>${tokenBlock(current.tokens)}${SLIDE_CSS}${lite ? LITE_CSS : ""}</style>${shader}</head><body>${backdropHtml}${scrim}${grain}<div class="frame"><header class="bar"><span class="logo-pill"><img src="/creator-os/wzrd-wordmark-1600.png" alt="WZRD.tech"></span><span class="counter">${pad(index + 1)} / ${pad(ONBOARDING_STEPS.length)}${esc(statusTag)}</span></header><main class="slide">${busy}${noticeHtml}<p class="kicker">${pad(index + 1)} / ${esc(STEP_KICKERS[active])}</p><h1>${esc(STEP_TITLES[active])}</h1><section class="panel">${stepBody(snapshot, active, browserSignin, lite)}</section></main><footer class="nav">${prev ? `<a class="navlink" href="${href(prev)}">← Back</a>` : '<span class="navlink ghosted">← Back</span>'}<nav class="dots" aria-label="Steps">${dots}</nav>${next ? `<a class="navlink" href="${href(next)}">Next →</a>` : '<span class="navlink ghosted">Next →</span>'}</footer></div></body></html>`;
}

function activeStep(ctx: MiniAppContext, snapshot: OnboardingSnapshot): OnboardingStepId {
  const requested = ctx.request.nextUrl.searchParams.get("step") ?? "";
  return isOnboardingStep(requested) ? requested : firstOpenStep(snapshot);
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
  if (active !== "connect" && !rendersNativeOnairos(snapshot, active)) {
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
  step === "selfies" || step === "twin" || step === "avatar";

/** The selfies/twin slides mount the same-origin photo booth — never in
 * lite/Messages card sessions (tight memory/GPU budget, no camera UX). */
const rendersBooth = (
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId,
  lite: boolean
): boolean =>
  !lite &&
  (step === "selfies" ||
    (step === "twin" &&
      snapshot.twinAvailable &&
      !snapshot.twin?.consent_video_key));

/** The Onairos slide mounts the vendor SDK when a native connect is possible
 * — the CSP widens only for that render. */
function rendersNativeOnairos(
  snapshot: OnboardingSnapshot,
  step: OnboardingStepId
): boolean {
  return (
    step === "onairos" &&
    snapshot.onairos.available &&
    !snapshot.onairos.connected
  );
}

async function respond(
  ctx: MiniAppContext,
  step: OnboardingStepId | null,
  notice: string | null
): Promise<NextResponse> {
  const snapshot = await loadSnapshot(ctx.supabase, ctx.session.userId);
  const current = activeTheme(ctx);
  const active = step ?? firstOpenStep(snapshot);
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
    rendersBooth(snapshot, active, ctx.session.via === "card")
  );
}

async function markSafely(
  supabase: SupabaseClient,
  userId: string,
  step: OnboardingStepId,
  status: "done" | "skipped" | "todo"
): Promise<boolean> {
  try {
    await markOnboardingStep(supabase, userId, step, status);
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
    const snapshot = await loadSnapshot(ctx.supabase, ctx.session.userId);
    // A pending Connect Link may have completed on the hosted page — sync
    // the mirror before rendering so the chip is truthful.
    if (snapshot.connections.some((c) => c.status === "pending")) {
      snapshot.connections = await syncConnections(
        ctx.supabase,
        ctx.session.userId
      ).catch(() => snapshot.connections);
    }
    const current = activeTheme(ctx);
    const active = activeStep(ctx, snapshot);
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
      rendersBooth(snapshot, active, ctx.session.via === "card")
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
        `You're @${result.username}${result.address ? ` — your agent's email is ${result.address}` : ""}.`
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
      const link = await beginConnect(supabase, userId, toolkit, callback);
      return withBaseHeaders(
        NextResponse.redirect(link.redirect_url, 303)
      );
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

    if (action === "refresh_ingest") {
      const ingest = await readIngestStatus(supabase, userId).catch(() => null);
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
      if (loginUsername) fields.username = loginUsername;
      if (password) fields.password = password;
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
