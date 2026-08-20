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
  setSpeedTier,
  setUsername,
  SPEED_TIERS,
} from "@/lib/settings/account";
import { esc, forbidden, html, page } from "../html";
import { memoryAction, renderMemorySection } from "../sections/memory";
import { onairosAction, renderOnairosSection } from "../sections/onairos";
import { renderTracesSection } from "../sections/traces";
import type { MiniAppContext, MiniAppModule } from "./types";

interface SettingsData {
  username: string | null;
  speedTier: string | null;
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
    supabase.from("users").select("username").eq("id", userId).maybeSingle(),
    supabase
      .from("entitlements")
      .select("plan, speed_tier")
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
    speedTier: (entitlement?.speed_tier as string | null) ?? null,
    plan: (entitlement?.plan as string | null) ?? null,
    address: (addressRow?.address as string | null) ?? null,
    pluginSessions: (tokens ?? []) as SettingsData["pluginSessions"],
    bucket:
      (bucket as { bytes_used: number; quota_bytes: number } | null) ?? null,
  };
}

function section(title: string, body: string): string {
  return `<h2 style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);margin:16px 0 6px">${esc(title)}</h2>${body}`;
}

/** A clearly-marked panel whose API belongs to another workstream. */
function comingSoon(text: string): string {
  return `<div class="card pending" style="color:var(--muted)">${esc(text)}</div>`;
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
  notice: string | null
): string {
  const usernameSection = section(
    "USERNAME",
    `<div class="card">${data.username ? `Current: <strong>@${esc(data.username)}</strong>` : "Not set yet."}<p style="color:var(--muted);font-size:11px;margin:4px 0 6px">2–24 lowercase letters, digits, or underscores. Changing it is limited to once every 30 days and moves your agent's email.</p><form method="post" style="display:flex;gap:6px;margin:0"><input type="hidden" name="action" value="set_username"><input type="text" name="username" placeholder="new username" maxlength="24" autocomplete="off"><button>Save</button></form></div>`
  );
  const speedButtons = SPEED_TIERS.map(
    (tier) =>
      `<form method="post" style="margin:0"><input type="hidden" name="action" value="set_speed"><input type="hidden" name="speed_tier" value="${esc(tier)}"><button${tier === data.speedTier ? "" : ' class="ghost"'}>${esc(tier)}</button></form>`
  ).join("");
  const speedSection = section(
    "SPEED & INTELLIGENCE",
    `<div class="card"><div style="display:flex;gap:6px">${speedButtons}</div><p style="color:var(--muted);font-size:11px;margin:6px 0 0">Faster answers or deeper reasoning — a tier, never a specific model.</p></div>`
  );
  const emailSection = section(
    "AGENT EMAIL",
    `<div class="card">${data.address ? `<strong>${esc(data.address)}</strong> — drafts only; sending always waits for your approval.` : "Provisioned automatically when you set a username."}</div>`
  );
  const contactSection = data.username
    ? section(
        "CONTACT CARD",
        `<div class="card">Your public contact card: <strong>${esc(`${env.appOrigin()}/@${data.username}`)}</strong><p style="color:var(--muted);font-size:11px;margin:4px 0 0">Shows only your name, agent address, and contact button — nothing else.</p></div>`
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
        `<div class="item"><span style="flex:1">${esc(t.tool)}</span><span class="when">${esc(new Date(t.created_at).toLocaleDateString())}${t.last_used_at ? ` · last used ${esc(new Date(t.last_used_at).toLocaleDateString())}` : ""}</span></div>`
    )
    .join("");
  const pluginSection = section(
    "PLUGIN SESSIONS",
    (pluginRows ||
      '<div class="card" style="color:var(--muted)">No plugin sessions.</div>') +
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
  return page(
    "Settings",
    `<h1>Settings</h1>${notice ? `<p style="color:var(--muted);font-size:12px">${esc(notice)}</p>` : ""}${usernameSection}${speedSection}${emailSection}${contactSection}${timezoneSection}${memorySection}${onairosSection}${pluginSection}${storageSection}${traceSection}${dataSection}`
  );
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
  return html(renderSettings(data, { memory, traces, onairos }, notice));
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

    if (action === "set_speed") {
      const tier = String(form.get("speed_tier") ?? "");
      if (!isSpeedTier(tier)) return forbidden("invalid tier");
      const ok = await setSpeedTier(ctx.supabase, userId, tier);
      return respond(ctx, ok ? `Speed set to ${tier}.` : "Update failed.");
    }

    return forbidden("unknown action");
  },
};
