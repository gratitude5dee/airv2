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
  setSpeedTier,
  setUsername,
  SPEED_TIERS,
} from "@/lib/settings/account";
import {
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  requiresConsent,
} from "@/lib/entitlements/models";
import { INKLING_CONSENT } from "@/lib/entitlements/inkling";
import { StartLimitError } from "@/lib/orchestrator/boxes";
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
import { activeBackground, activeTheme, withStyle } from "../themeContext";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import { memoryAction, renderMemorySection } from "../sections/memory";
import { onairosAction, renderOnairosSection } from "../sections/onairos";
import { renderTracesSection } from "../sections/traces";
import type { MiniAppContext, MiniAppModule } from "./types";

interface SettingsData {
  username: string | null;
  miniappTheme: string;
  miniappBackground: string;
  speedTier: string | null;
  modelFamily: string;
  plan: string | null;
  address: string | null;
  pluginSessions: Array<{
    tool: string;
    created_at: string;
    last_used_at: string | null;
  }>;
  bucket: { bytes_used: number; quota_bytes: number } | null;
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
  ] = await Promise.all([
    supabase
      .from("users")
      .select("username, miniapp_theme, miniapp_background")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("entitlements")
      .select("plan, speed_tier, model_family")
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
  ]);
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
    plan: (entitlement?.plan as string | null) ?? null,
    address: (addressRow?.address as string | null) ?? null,
    pluginSessions: (tokens ?? []) as SettingsData["pluginSessions"],
    bucket:
      (bucket as { bytes_used: number; quota_bytes: number } | null) ?? null,
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
      `<div class="card"><h2>Backdrop</h2><div class="row">${backgroundButtons}</div><p class="muted">A living backdrop behind every full-screen mini-app. Theme default keeps the theme's own sky; inline cards always use the lightweight theme backdrop.</p></div>`
  );
  const modelSection = section(
    "MODEL",
    `<div class="card"><div class="row">${plainFamilyButtons}</div><p class="muted">Ox Alpha unless you pick otherwise. OpenAI follows your speed tier above.</p><div class="row"><p class="muted">${consentHtml()}</p></div>${consentFamilyForms}</div>`
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
  const timezoneSection = section(
    "TIMEZONE",
    comingSoon(
      "Coming soon — a profile timezone (used for briefs and scheduling defaults) doesn't exist yet. Calendar schedules already carry their own timezone."
    )
  );
  const memorySection = sections.memory;
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
  const body = `<section class="panel">${usernameSection}${themeSection}${speedSection}${modelSection}${emailSection}${contactSection}${timezoneSection}${memorySection}${onairosSection}${pluginSection}${storageSection}${traceSection}${dataSection}
${promptBar("Ask your agent — e.g. change my speed tier to fast…")}</section>`;
  return renderShell({
    title: "Settings",
    kicker: "Preferences",
    body,
    notice,
    lite,
  });
}

async function respond(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const [data, memory, traces, onairos] = await Promise.all([
    loadSettings(ctx.supabase, ctx.session.userId),
    renderMemorySection(ctx),
    renderTracesSection(ctx),
    renderOnairosSection(ctx),
  ]);
  return shellHtml(
    renderSettings(
      data,
      { memory, traces, onairos },
      notice,
      ctx.session.via === "card"
    )
  );
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
        { theme: THEMES[themeId], background: activeBackground() },
        () => respond(ctx, `Theme set to ${THEMES[themeId].name}.`)
      );
    }

    if (action === "set_background") {
      const backgroundId = String(form.get("background") ?? "");
      if (!isBackgroundId(backgroundId)) return forbidden("invalid background");
      const ok = await setMiniappBackground(ctx.supabase, userId, backgroundId);
      if (!ok) return respond(ctx, "Update failed.");
      return withStyle({ theme: activeTheme(), background: backgroundId }, () =>
        respond(ctx, `Backdrop set to ${BACKGROUND_NAMES[backgroundId]}.`)
      );
    }

    if (action === "set_speed") {
      const tier = String(form.get("speed_tier") ?? "");
      if (!isSpeedTier(tier)) return forbidden("invalid tier");
      const ok = await setSpeedTier(ctx.supabase, userId, tier);
      return respond(ctx, ok ? `Speed set to ${tier}.` : "Update failed.");
    }

    return forbidden("unknown action");
  },
};
