/**
 * Settings mini-app (goal.md §MA5 #14) — the one place every setting lives.
 * Live writes go through the existing shared code paths only
 * (lib/settings/account — same functions as /api/settings/*): username
 * (cooldown-aware) and speed tier. Read-only panels mirror plugin sessions
 * (MA2.4) and bucket usage (MA4) from their existing tables. Timezone,
 * and plugin revoke (MA2.4) belong to sessions H/B — their sections are
 * clearly marked and gain their existing API when it lands; no new mutation
 * paths (§MA5). Memory (MA9.1), traces (MA9.3), and Onairos (MA9.2) mount
 * their self-contained sections from ../sections. Owner-only.
 */
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  isSpeedTier,
  MODEL_FAMILIES,
  MODEL_FAMILY_LABELS,
  setMiniappBackground,
  setMiniappTheme,
  setModelFamily,
  setOpenRouterModel,
  setSpeedTier,
  setUsername,
  setVeniceModel,
  SPEED_TIERS,
} from "@/lib/settings/account";
import {
  DEFAULT_MODEL_FAMILY,
  DEFAULT_VENICE_MODEL,
  defaultOpenRouterModelForTier,
  isModelFamily,
  isOpenRouterModel,
  isVeniceModel,
  OPENROUTER_MODELS,
  requiresConsent,
  VENICE_MODELS,
} from "@/lib/entitlements/models";
import {
  CREATIVE_LANES,
  isCreativeLane,
  isLaneModel,
  LANE_LABELS,
  LANE_MODELS,
  loadCreativePrefs,
  setCreativeModel,
  type CreativePrefs,
} from "@/lib/creative/model-prefs";
import {
  clearProviderKey,
  isProviderId,
  listProviderKeyStatuses,
  PROVIDER_LABELS,
  providerVaultAvailable,
  setProviderKey,
  type ProviderKeyStatus,
} from "@/lib/providers/keys";
import { INKLING_CONSENT } from "@/lib/entitlements/inkling";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import {
  getAvatarAssetId,
  listIdentityMediaViews,
  removeIdentityAsset,
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
  type DigitalTwin,
} from "@/lib/identity/twin";
import type { CreativeAsset } from "@/lib/assets/pipeline";
import {
  DEFAULT_THEME,
  isThemeId,
  THEME_IDS,
  THEMES,
} from "../themes";
import {
  BACKGROUND_IDS,
  BACKGROUND_NAMES,
  DEFAULT_BACKGROUND,
  isBackgroundId,
} from "../backgrounds";
import { esc, forbidden } from "../html";
import {
  activeBackground,
  activeHomeHref,
  activeTheme,
  withStyle,
} from "../themeContext";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import { memoryAction, renderMemorySection } from "../sections/memory";
import {
  connectivityAction,
  renderConnectivitySection,
} from "../sections/connectivity";
import { onairosAction, renderOnairosSection } from "../sections/onairos";
import { renderTracesSection } from "../sections/traces";
import type { MiniAppContext, MiniAppModule } from "./types";

interface SettingsData {
  username: string | null;
  miniappTheme: string;
  miniappBackground: string;
  speedTier: string | null;
  modelFamily: string;
  openrouterModel: string | null;
  veniceModel: string | null;
  creativePrefs: CreativePrefs;
  providerKeys: ProviderKeyStatus[];
  providerVault: boolean;
  plan: string | null;
  address: string | null;
  pluginSessions: Array<{
    tool: string;
    created_at: string;
    last_used_at: string | null;
  }>;
  bucket: { bytes_used: number; quota_bytes: number } | null;
  identityMedia: IdentityMediaView[];
  avatarAssetId: string | null;
  twin: DigitalTwin | null;
  twinVideoUrl: string | null;
  twinAvailable: boolean;
}

async function loadSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<SettingsData> {
  const [
    { data: user },
    { data: entitlement },
    { data: addressRow },
    { data: tokens },
    { data: bucket },
    identityMedia,
    avatarAssetId,
    twin,
    creativePrefs,
    providerKeys,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("username, miniapp_theme, miniapp_background")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("entitlements")
      .select("plan, speed_tier, model_family, openrouter_model, venice_model")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("agent_addresses")
      .select("address")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .is("retired_at", null)
      .maybeSingle(),
    supabase
      .from("plugin_tokens")
      .select("tool, created_at, last_used_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_buckets")
      .select("bytes_used, quota_bytes")
      .eq("user_id", userId)
      .maybeSingle(),
    listIdentityMediaViews(supabase, userId),
    getAvatarAssetId(supabase, userId).catch(() => null),
    getDigitalTwin(supabase, userId).catch(() => null),
    loadCreativePrefs(supabase, userId),
    listProviderKeyStatuses(supabase, userId).catch(() => []),
  ]);
  let twinVideoUrl: string | null = null;
  if (twin?.video_asset_id) {
    const { data: videoAsset } = await supabase
      .from("creative_assets")
      .select("*")
      .eq("id", twin.video_asset_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (videoAsset) {
      twinVideoUrl = await signedIdentityUrl(
        supabase,
        videoAsset as CreativeAsset
      ).catch(() => null);
    }
  }
  return {
    username: (user?.username as string | null) ?? null,
    miniappTheme: (() => {
      const value = String(user?.miniapp_theme ?? "");
      return isThemeId(value) ? value : DEFAULT_THEME;
    })(),
    miniappBackground: (() => {
      const value = String(user?.miniapp_background ?? "");
      return isBackgroundId(value) ? value : DEFAULT_BACKGROUND;
    })(),
    speedTier: (entitlement?.speed_tier as string | null) ?? null,
    modelFamily: (() => {
      const value = String(entitlement?.model_family ?? "");
      return isModelFamily(value) ? value : DEFAULT_MODEL_FAMILY;
    })(),
    openrouterModel:
      (entitlement?.openrouter_model as string | null) ?? null,
    veniceModel: (entitlement?.venice_model as string | null) ?? null,
    creativePrefs,
    providerKeys,
    providerVault: providerVaultAvailable(),
    plan: (entitlement?.plan as string | null) ?? null,
    address: (addressRow?.address as string | null) ?? null,
    pluginSessions: (tokens ?? []) as SettingsData["pluginSessions"],
    bucket:
      (bucket as { bytes_used: number; quota_bytes: number } | null) ?? null,
    identityMedia,
    avatarAssetId,
    twin,
    twinVideoUrl,
    twinAvailable: env.gmiCloudApiKey() !== null,
  };
}

/** The TML free-endpoint notice, with its two links opening in a new tab. */
function consentHtml(): string {
  return INKLING_CONSENT.map((segment) =>
    segment.href
      ? `<a href="${esc(segment.href)}" target="_blank" rel="noopener">${esc(segment.text)}</a>`
      : esc(segment.text)
  ).join("");
}

function section(title: string, body: string): string {
  return `<h2>${esc(title)}</h2>${body}`;
}

/** A clearly-marked panel whose API belongs to another workstream. */
function comingSoon(text: string): string {
  return `<div class="card pending muted">${esc(text)}</div>`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1)} GB`;
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} MB`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface MountedSections {
  memory: string;
  traces: string;
  onairos: string;
  connectivity: string;
}

function renderSettings(
  data: SettingsData,
  sections: MountedSections,
  notice: string | null,
  lite: boolean
): string {
  const usernameSection = section(
    "USERNAME",
    `<div class="card">${data.username ? `Current: <strong>@${esc(data.username)}</strong>` : "Not set yet."}<p class="muted">2–24 lowercase letters, digits, or underscores. Changing it is limited to once every 30 days and moves your agent's email.</p><form method="post" class="row"><input type="hidden" name="action" value="set_username"><input type="text" name="username" placeholder="new username" maxlength="24" autocomplete="off"><button>Save</button></form></div>`
  );
  const speedButtons = SPEED_TIERS.map(
    (tier) =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="set_speed"><input type="hidden" name="speed_tier" value="${esc(tier)}"><button${tier === data.speedTier ? "" : ' class="ghost"'}>${esc(tier)}</button></form>`
  ).join("");
  const speedSection = section(
    "SPEED & INTELLIGENCE",
    `<div class="card"><div class="row">${speedButtons}</div><p class="muted">Faster answers or deeper reasoning — a tier, never a specific model.</p></div>`
  );
  const plainFamilyButtons = MODEL_FAMILIES.filter(
    (family) => !requiresConsent(family)
  )
    .map(
      (family) =>
        `<form method="post" class="inline"><input type="hidden" name="action" value="set_model_family"><input type="hidden" name="model_family" value="${esc(family)}"><button${family === data.modelFamily ? "" : ' class="ghost"'}>${esc(MODEL_FAMILY_LABELS[family])}</button></form>`
    )
    .join("");
  // The two free Inkling endpoints only save with the consent box ticked —
  // the warning is inline and the checkbox is re-checked server-side.
  const consentFamilyForms = MODEL_FAMILIES.filter(requiresConsent)
    .map(
      (family) =>
        `<form method="post" class="stack"><input type="hidden" name="action" value="set_model_family"><input type="hidden" name="model_family" value="${esc(family)}"><label class="row muted"><input type="checkbox" name="agree_tml" value="1"><span class="grow">I agree to the terms above and want ${esc(MODEL_FAMILY_LABELS[family])}.</span></label><button${family === data.modelFamily ? "" : ' class="ghost"'}>${esc(MODEL_FAMILY_LABELS[family])}</button></form>`
    )
    .join("");
  const themeButtons = THEME_IDS.map(
    (id) =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="set_theme"><input type="hidden" name="theme" value="${esc(id)}"><button${id === data.miniappTheme ? "" : ' class="ghost"'}>${esc(THEMES[id].name)}</button></form>`
  ).join("");
  const backgroundButtons = BACKGROUND_IDS.map(
    (id) =>
      `<form method="post" class="inline"><input type="hidden" name="action" value="set_background"><input type="hidden" name="background" value="${esc(id)}"><button${id === data.miniappBackground ? "" : ' class="ghost"'}>${esc(BACKGROUND_NAMES[id])}</button></form>`
  ).join("");
  const themeSection = section(
    "THEME",
    `<div class="card"><div class="row">${themeButtons}</div><p class="muted">${esc(THEMES[isThemeId(data.miniappTheme) ? data.miniappTheme : DEFAULT_THEME].description)}</p><p class="muted">Applies to every mini-app the next time it loads.</p></div>` +
      `<div class="card"><h2>Backdrop</h2><div class="row">${backgroundButtons}</div><p class="muted">A living backdrop behind every mini-app — it applies right away here and everywhere on next open. Inside Messages it runs at a reduced resolution.</p></div>`
  );
  const tierValue = isSpeedTier(String(data.speedTier ?? ""))
    ? (String(data.speedTier) as (typeof SPEED_TIERS)[number])
    : "balanced";
  const openrouterSelected =
    data.openrouterModel && isOpenRouterModel(data.openrouterModel)
      ? data.openrouterModel
      : defaultOpenRouterModelForTier(tierValue);
  const openrouterOptions = SPEED_TIERS.map(
    (tier) =>
      `<optgroup label="${esc(tier)}">${OPENROUTER_MODELS.filter(
        (model) => model.tier === tier
      )
        .map(
          (model) =>
            `<option value="${esc(model.slug)}"${model.slug === openrouterSelected ? " selected" : ""}>${esc(model.label)}</option>`
        )
        .join("")}</optgroup>`
  ).join("");
  const openrouterCard = `<div class="card"><h2>OpenRouter model</h2><form method="post" class="row"><input type="hidden" name="action" value="set_openrouter_model"><select name="openrouter_model">${openrouterOptions}</select><button${data.modelFamily === "openrouter" ? "" : ' class="ghost"'}>Use</button></form><p class="muted">Grouped by speed tier — picking one switches your model to OpenRouter.</p></div>`;
  const veniceSelected =
    data.veniceModel && isVeniceModel(data.veniceModel)
      ? data.veniceModel
      : DEFAULT_VENICE_MODEL;
  const veniceOptions = VENICE_MODELS.map(
    (model) =>
      `<option value="${esc(model.slug)}"${model.slug === veniceSelected ? " selected" : ""}>${esc(model.label)}</option>`
  ).join("");
  const veniceCard = `<div class="card"><h2>Venice model</h2><form method="post" class="row"><input type="hidden" name="action" value="set_venice_model"><select name="venice_model">${veniceOptions}</select><button${data.modelFamily === "venice" ? "" : ' class="ghost"'}>Use</button></form><p class="muted">Private, OpenAI-compatible inference — add a personal Venice key below to use your own balance.</p></div>`;
  const modelSection = section(
    "MODEL",
    `<div class="card"><div class="row">${plainFamilyButtons}</div><p class="muted">Ox Alpha unless you pick otherwise. OpenAI follows your speed tier above.</p><div class="row"><p class="muted">${consentHtml()}</p></div>${consentFamilyForms}</div>${openrouterCard}${veniceCard}`
  );
  const creativeCards = CREATIVE_LANES.map((lane) => {
    const selected = data.creativePrefs[lane];
    const options = LANE_MODELS[lane]
      .map(
        (model) =>
          `<option value="${esc(model.slug)}"${model.slug === selected ? " selected" : ""}>${esc(model.label)}</option>`
      )
      .join("");
    return `<div class="card"><h2>${esc(LANE_LABELS[lane])}</h2><form method="post" class="row"><input type="hidden" name="action" value="set_creative_model"><input type="hidden" name="lane" value="${esc(lane)}"><select name="model">${options}</select><button>Save</button></form></div>`;
  }).join("");
  const creativeSection = section(
    "CREATIVE MODELS",
    creativeCards +
      `<p class="muted">Each command's prompts are automatically optimized for the model you pick.</p>`
  );
  const providerCards = data.providerKeys
    .map((status) => {
      const label = PROVIDER_LABELS[status.provider];
      const state = status.hint
        ? `Personal key on file ····${esc(status.hint)} — requests use your own balance.`
        : "Using platform credentials.";
      const clear = status.hint
        ? `<form method="post" class="inline"><input type="hidden" name="action" value="clear_provider_key"><input type="hidden" name="provider" value="${esc(status.provider)}"><button class="ghost">Remove key</button></form>`
        : "";
      return `<div class="card"><h2>${esc(label)}</h2><p class="muted">${state}</p><form method="post" class="row"><input type="hidden" name="action" value="save_provider_key"><input type="hidden" name="provider" value="${esc(status.provider)}"><input type="password" name="api_key" placeholder="${esc(label)} API key" autocomplete="off"><button>Save</button></form>${clear}</div>`;
    })
    .join("");
  const providerSection = section(
    "PROVIDER KEYS",
    data.providerVault
      ? providerCards +
          `<p class="muted">Optional — spend your own provider credits. Keys are sealed at rest and never shown again.</p>`
      : comingSoon(
          "Personal provider keys aren't enabled on this deployment."
        )
  );
  const emailSection = section(
    "AGENT EMAIL",
    `<div class="card">${data.address ? `<strong>${esc(data.address)}</strong> — drafts only; sending always waits for your approval.` : "Provisioned automatically when you set a username."}</div>`
  );
  const contactSection = data.username
    ? section(
        "CONTACT CARD",
        `<div class="card">Your public contact card: <strong>${esc(`${env.appOrigin()}/@${data.username}`)}</strong><p class="muted">Shows only your name, agent address, and contact button — nothing else.</p></div>`
      )
    : "";
  const identitySection = section("IDENTITY VAULT", identityVaultBody(data));
  const timezoneSection = section(
    "TIMEZONE",
    comingSoon(
      "Coming soon — a profile timezone (used for briefs and scheduling defaults) doesn't exist yet. Calendar schedules already carry their own timezone."
    )
  );
  const memorySection = sections.memory;
  const connectivitySection = sections.connectivity;
  const pluginRows = data.pluginSessions
    .map(
      (t) =>
        `<div class="item"><span class="grow">${esc(t.tool)}</span><span class="when">${esc(new Date(t.created_at).toLocaleDateString())}${t.last_used_at ? ` · last used ${esc(new Date(t.last_used_at).toLocaleDateString())}` : ""}</span></div>`
    )
    .join("");
  const pluginSection = section(
    "PLUGIN SESSIONS",
    (pluginRows || '<div class="card muted">No plugin sessions.</div>') +
      comingSoon(
        "Revoke ships with the WZRD.Tech plugin work (MA2.4) — this panel will call its API once it exists."
      )
  );
  const storageSection = section(
    "STORAGE",
    data.bucket
      ? `<div class="card">${esc(formatBytes(data.bucket.bytes_used))} of ${esc(formatBytes(data.bucket.quota_bytes))} used.</div>`
      : comingSoon(
          "Public media storage (MA4) hasn't been provisioned for this account yet — usage appears here once it is."
        )
  );
  const traceSection = sections.traces;
  const onairosSection = sections.onairos;
  const dataSection = section(
    "YOUR DATA",
    comingSoon(
      "Export and deletion are operator-run today — ask and it happens (full export / cascade delete already exist server-side). Self-serve buttons land here."
    )
  );
  const body = `<section class="panel">${usernameSection}${themeSection}${speedSection}${modelSection}${creativeSection}${providerSection}${emailSection}${contactSection}${identitySection}${timezoneSection}${memorySection}${connectivitySection}${onairosSection}${pluginSection}${storageSection}${traceSection}${dataSection}
${promptBar("Ask your agent — e.g. change my speed tier to fast…")}</section>`;
  return renderShell({
    title: "Settings",
    kicker: "Preferences",
    body,
    notice,
    lite,
  });
}

const THUMB_STYLE =
  "width:92px;height:92px;object-fit:cover;border-radius:12px;display:block";

/** The vault cards: avatar preview, per-image set-as-avatar/delete, upload,
 * re-generate, and the digital-twin status — all through the shared
 * lib/identity helpers (same code paths as onboarding). */
function identityVaultBody(data: SettingsData): string {
  const current = data.identityMedia.find(
    (m) => m.assetId === data.avatarAssetId && m.url
  );
  const avatarCard = `<div class="card">${
    current
      ? `<div class="row"><img src="${esc(current.url ?? "")}" alt="avatar" style="${THUMB_STYLE}"><span class="grow">Current avatar</span></div>`
      : `<span class="muted">No avatar set — pick one below.</span>`
  }</div>`;
  const draft = data.identityMedia.find(
    (m) => m.role === "character_sheet_draft" && m.url
  );
  const draftCard = draft
    ? `<div class="card"><img src="${esc(draft.url ?? "")}" alt="character sheet draft" style="${THUMB_STYLE}"><p class="muted">Character sheet draft — save it to your vault or discard it.</p><form method="post" class="inline"><input type="hidden" name="action" value="save_character_sheet"><input type="hidden" name="asset_id" value="${esc(draft.assetId)}"><button>Save to vault</button></form><form method="post" class="inline"><input type="hidden" name="action" value="discard_character_sheet"><input type="hidden" name="asset_id" value="${esc(draft.assetId)}"><button class="ghost">Discard</button></form></div>`
    : "";
  const items = data.identityMedia
    .filter(
      (m) => (m.role === "selfie" || m.role === "character_sheet") && m.url
    )
    .map(
      (m) =>
        `<div class="item"><img src="${esc(m.url ?? "")}" alt="${esc(m.role === "character_sheet" ? "character sheet" : "selfie")}" style="${THUMB_STYLE}"><span class="grow muted">${esc(m.role === "character_sheet" ? "character sheet" : "selfie")}</span><form method="post" class="inline"><input type="hidden" name="action" value="set_avatar"><input type="hidden" name="asset_id" value="${esc(m.assetId)}"><button${m.assetId === data.avatarAssetId ? "" : ' class="ghost"'}>${m.assetId === data.avatarAssetId ? "Avatar" : "Set as avatar"}</button></form><form method="post" class="inline"><input type="hidden" name="action" value="delete_identity_asset"><input type="hidden" name="asset_id" value="${esc(m.assetId)}"><button class="ghost">Delete</button></form></div>`
    )
    .join("");
  const gallery =
    items || '<div class="card muted">No identity images yet.</div>';
  const upload = `<div class="card"><form method="post" enctype="multipart/form-data" class="row"><input type="hidden" name="action" value="upload_selfie"><input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif"><button>Upload image</button></form><p class="muted">PNG, JPEG, WebP, or HEIC (iPhone photos convert automatically) — stored privately in your image vault.</p>${
    data.username
      ? `<form method="post" class="inline"><input type="hidden" name="action" value="generate_character_sheet"><button class="ghost">Re-generate character sheet</button></form>`
      : '<p class="muted">Set a username to generate a character sheet.</p>'
  }</div>`;
  const heygenCard = heygenAvailable()
    ? `<div class="card">${
        data.twin?.provider_avatar_id
          ? "HeyGen avatar ready — videos render with your trained avatar ID."
          : `<form method="post" class="inline"><input type="hidden" name="action" value="create_heygen_avatar"><button>Create HeyGen avatar</button></form><p class="muted">Recommended — trains a reusable avatar ID from your newest identity image.</p>`
      }</div>`
    : "";
  const twinCard = !data.twinAvailable
    ? '<div class="card muted">Digital twin creation isn\'t configured on this deployment.</div>'
    : `<div class="card">Digital twin: <strong>${esc(data.twin ? data.twin.status : "not created")}</strong>${
        data.twinVideoUrl
          ? `<video src="${esc(data.twinVideoUrl)}" controls playsinline style="width:100%;border-radius:12px;margin-top:0.5rem"></video>`
          : ""
      }<form method="post" class="stack"><input type="hidden" name="action" value="recreate_twin"><input type="text" name="script" placeholder="What should your twin say?" maxlength="500"><button class="ghost">${data.twin ? "Re-create twin" : "Create twin"}</button></form></div>`;
  return `${avatarCard}${draftCard}${gallery}${upload}${heygenCard}${twinCard}`;
}

async function respond(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const [data, memory, traces, onairos, connectivity] = await Promise.all([
    loadSettings(ctx.supabase, ctx.session.userId),
    renderMemorySection(ctx),
    renderTracesSection(ctx),
    renderOnairosSection(ctx),
    renderConnectivitySection(ctx),
  ]);
  const response = shellHtml(
    renderSettings(
      data,
      { memory, traces, onairos, connectivity },
      notice,
      ctx.session.via === "card"
    )
  );
  // The IDENTITY VAULT previews private assets via short-TTL signed storage
  // URLs — widen img/media the way apps/video.tsx does for its shell.
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    `${csp.replace("img-src 'self'", "img-src 'self' https:")}; media-src https:`
  );
  return response;
}

export const settings: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    return respond(ctx, null);
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const action = String(form.get("action") ?? "");
    const userId = ctx.session.userId;

    if (action === "prompt") {
      try {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "Your agent's computer can't start right now — try again in a few minutes."
          );
        }
        throw error;
      }
      return respond(ctx, "Sent to your agent.");
    }

    const memoryResponse = await memoryAction(ctx, form);
    if (memoryResponse) return memoryResponse;
    const connectivityResponse = await connectivityAction(ctx, form);
    if (connectivityResponse) return connectivityResponse;
    const onairosResponse = await onairosAction(ctx, form);
    if (onairosResponse) return onairosResponse;

    if (action === "set_username") {
      const result = await setUsername(
        ctx.supabase,
        userId,
        String(form.get("username") ?? "")
      );
      if (!result.ok) {
        const message =
          result.error === "cooldown"
            ? `Username changes are limited to once every 30 days${result.eligible ? ` — eligible ${result.eligible}` : ""}.`
            : result.error === "taken"
              ? "That username is taken."
              : result.error === "invalid"
                ? "2–24 lowercase letters, digits, or underscores."
                : "Update failed — try again.";
        return respond(ctx, message);
      }
      return respond(
        ctx,
        `You're @${result.username}${result.address ? ` — agent email is now ${result.address}` : ""}.`
      );
    }

    if (action === "set_model_family") {
      const family = String(form.get("model_family") ?? "");
      if (!isModelFamily(family)) return forbidden("invalid model family");
      // Consent is enforced here too, not only in the markup that carries it.
      if (requiresConsent(family) && String(form.get("agree_tml") ?? "") !== "1") {
        return forbidden("consent required");
      }
      const ok = await setModelFamily(ctx.supabase, userId, family);
      return respond(
        ctx,
        ok
          ? `Model set to ${MODEL_FAMILY_LABELS[family]}.`
          : "Update failed."
      );
    }

    if (action === "set_theme") {
      const themeId = String(form.get("theme") ?? "");
      if (!isThemeId(themeId)) return forbidden("invalid theme");
      const ok = await setMiniappTheme(ctx.supabase, userId, themeId);
      if (!ok) return respond(ctx, "Update failed.");
      // Re-render inside the just-written style so the response paints it.
      return withStyle(
        {
          theme: THEMES[themeId],
          background: activeBackground(),
          homeHref: activeHomeHref(),
        },
        () => respond(ctx, `Theme set to ${THEMES[themeId].name}.`)
      );
    }

    if (action === "set_background") {
      const backgroundId = String(form.get("background") ?? "");
      if (!isBackgroundId(backgroundId)) return forbidden("invalid background");
      const ok = await setMiniappBackground(ctx.supabase, userId, backgroundId);
      if (!ok) return respond(ctx, "Update failed.");
      return withStyle(
        {
          theme: activeTheme(),
          background: backgroundId,
          homeHref: activeHomeHref(),
        },
        () => respond(ctx, `Backdrop set to ${BACKGROUND_NAMES[backgroundId]}.`)
      );
    }

    if (action === "set_speed") {
      const tier = String(form.get("speed_tier") ?? "");
      if (!isSpeedTier(tier)) return forbidden("invalid tier");
      const ok = await setSpeedTier(ctx.supabase, userId, tier);
      return respond(ctx, ok ? `Speed set to ${tier}.` : "Update failed.");
    }

    if (action === "set_openrouter_model") {
      const slug = String(form.get("openrouter_model") ?? "");
      if (!isOpenRouterModel(slug)) return forbidden("invalid model");
      const ok =
        (await setOpenRouterModel(ctx.supabase, userId, slug)) &&
        (await setModelFamily(ctx.supabase, userId, "openrouter"));
      return respond(
        ctx,
        ok ? "OpenRouter model saved." : "Update failed."
      );
    }

    if (action === "set_venice_model") {
      const slug = String(form.get("venice_model") ?? "");
      if (!isVeniceModel(slug)) return forbidden("invalid model");
      const ok =
        (await setVeniceModel(ctx.supabase, userId, slug)) &&
        (await setModelFamily(ctx.supabase, userId, "venice"));
      return respond(ctx, ok ? "Venice model saved." : "Update failed.");
    }

    if (action === "set_creative_model") {
      const lane = String(form.get("lane") ?? "");
      const slug = String(form.get("model") ?? "");
      if (!isCreativeLane(lane) || !isLaneModel(lane, slug)) {
        return forbidden("invalid creative model");
      }
      const ok = await setCreativeModel(ctx.supabase, userId, lane, slug);
      return respond(
        ctx,
        ok ? `Model saved for ${LANE_LABELS[lane]}.` : "Update failed."
      );
    }

    if (action === "save_provider_key") {
      const provider = String(form.get("provider") ?? "");
      if (!isProviderId(provider)) return forbidden("invalid provider");
      const result = await setProviderKey(
        ctx.supabase,
        userId,
        provider,
        String(form.get("api_key") ?? "")
      );
      return respond(
        ctx,
        result.ok
          ? `${PROVIDER_LABELS[provider]} key saved — requests now use your own balance.`
          : result.error
      );
    }

    if (action === "clear_provider_key") {
      const provider = String(form.get("provider") ?? "");
      if (!isProviderId(provider)) return forbidden("invalid provider");
      const ok = await clearProviderKey(ctx.supabase, userId, provider);
      return respond(
        ctx,
        ok
          ? `${PROVIDER_LABELS[provider]} key removed — back to platform credentials.`
          : "Nothing to remove."
      );
    }

    if (action === "upload_selfie") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return respond(ctx, "Choose an image first.");
      }
      const result = await uploadIdentityImage(
        ctx.supabase,
        userId,
        file,
        "selfie"
      );
      return respond(
        ctx,
        result.ok ? "Added to your image vault." : result.error
      );
    }

    if (action === "generate_character_sheet") {
      const { data: user } = await ctx.supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const username = (user?.username as string | null) ?? null;
      if (!username) {
        return respond(ctx, "Set a username first — the character sheet is bound to your @name.");
      }
      const result = await generateCharacterSheet(ctx.supabase, userId, username);
      return respond(ctx, result.notice);
    }

    if (action === "save_character_sheet") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return forbidden("missing asset");
      const ok = await saveCharacterSheetDraft(ctx.supabase, userId, assetId);
      return respond(
        ctx,
        ok
          ? "Character sheet saved to your vault."
          : "That draft is gone — generate a new one."
      );
    }

    if (action === "discard_character_sheet") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return forbidden("missing asset");
      await discardCharacterSheetDraft(ctx.supabase, userId, assetId);
      return respond(ctx, "Draft discarded.");
    }

    if (action === "set_avatar") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return forbidden("missing asset");
      const ok = await setAvatarAssetId(ctx.supabase, userId, assetId);
      return respond(
        ctx,
        ok
          ? "Avatar set."
          : "Couldn't set that avatar — pick one of your identity images."
      );
    }

    if (action === "delete_identity_asset") {
      const assetId = String(form.get("asset_id") ?? "");
      if (!assetId) return forbidden("missing asset");
      const ok = await removeIdentityAsset(ctx.supabase, userId, assetId);
      return respond(
        ctx,
        ok ? "Removed from your identity vault." : "Nothing to remove."
      );
    }

    if (action === "create_heygen_avatar") {
      if (!heygenAvailable()) {
        return respond(ctx, "HeyGen isn't configured on this deployment.");
      }
      const { data: user } = await ctx.supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const username = (user?.username as string | null) ?? null;
      if (!username) return respond(ctx, "Set a username first.");
      const media = await listIdentityMediaViews(ctx.supabase, userId);
      const reference = media.find(
        (m) => (m.role === "selfie" || m.role === "character_sheet") && m.url
      );
      if (!reference?.url) {
        return respond(ctx, "Upload an identity image first.");
      }
      const result = await createUserHeygenAvatar(
        ctx.supabase,
        userId,
        username,
        reference.url
      );
      if (!result.ok) return respond(ctx, result.error);
      await setAvatarAssetId(ctx.supabase, userId, reference.assetId).catch(
        () => false
      );
      return respond(ctx, "HeyGen avatar created — twin videos now use your trained avatar ID.");
    }

    if (action === "recreate_twin") {
      if (env.gmiCloudApiKey() === null) {
        return respond(ctx, "Digital twin creation isn't configured on this deployment.");
      }
      const script = String(form.get("script") ?? "").trim().slice(0, 500);
      if (!script) return respond(ctx, "Write a line for your twin to say first.");
      const media = await listIdentityMediaViews(ctx.supabase, userId);
      const reference = media.find(
        (m) => (m.role === "selfie" || m.role === "character_sheet") && m.url
      );
      if (!reference?.url) {
        return respond(ctx, "Upload an identity image first — the twin animates your reference photo.");
      }
      const result = await createTwinVideo(ctx.supabase, userId, {
        avatarImageUrl: reference.url,
        script,
      });
      return respond(ctx, result.notice);
    }

    return forbidden("unknown action");
  },
};
