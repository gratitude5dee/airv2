/**
 * Onboarding mini-app (goal.md §MA5 #1) — the front-door experience. Six
 * guided, resumable steps; each writes real state through the existing code
 * paths (username/email via lib/settings/account, Composio Connect Links via
 * lib/connectors/manage, managers via lib/vault/managers, vault items via
 * the vault CLI, first exchange via Hermes MAIN_SESSION). Progress persists
 * box-side (C4, lib/miniapps/onboarding.ts); every step is skippable and
 * re-enterable. Step 4 (Onairos, §MA9.2) reports status via ./onairos.ts
 * over lib/onairos/sync.ts and stays skippable when no key is configured.
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
import { onairosProvider, type OnairosStatus } from "./onairos";
import { externalOrigin } from "../gates";
import { esc, forbidden, html, page, withBaseHeaders } from "../html";
import type { MiniAppContext, MiniAppModule } from "./types";

const STEP_TITLES: Record<OnboardingStepId, string> = {
  username: "Pick your username",
  email: "Your agent's email",
  model: "Model preference",
  connect: "Connect accounts",
  imessage: "Ingest iMessage history",
  onairos: "Personal context",
  secrets: "Secrets",
  stripe: "Stripe account",
  agent: "Meet your agent",
  walkthrough: "Walkthrough & first workflows",
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

/** Onboarding offers the two golden-path toolkits; the Connect app has all. */
const ONBOARDING_TOOLKITS: Array<[string, string]> = [
  ["gmail", "Gmail"],
  ["googlecalendar", "Google Calendar"],
];

interface Snapshot {
  state: OnboardingState;
  username: string | null;
  address: string | null;
  connections: ConnectionRow[];
  managers: ManagerStatus[];
  vaultItemCount: number;
  onairos: OnairosStatus;
  speedTier: string | null;
  merchant: Merchant | null;
  pluginSessions: number;
  ingest: IngestStatus | null;
  ingestCommand: string | null;
  boxBusy: boolean;
}

async function loadSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<Snapshot> {
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
    { count: pluginCount },
    ingest,
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
    supabase
      .from("plugin_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null),
    readIngestStatus(supabase, userId).catch(() => null),
  ]);
  return {
    state,
    username: (user?.username as string | null) ?? null,
    address: (addressRow?.address as string | null) ?? null,
    connections: (connectionRows ?? []) as ConnectionRow[],
    managers,
    vaultItemCount: count ?? 0,
    onairos,
    speedTier: (entitlement?.speed_tier as string | null) ?? null,
    merchant,
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
function effectiveStatus(
  snapshot: Snapshot,
  step: OnboardingStepId
): "todo" | "done" | "skipped" {
  const recorded = snapshot.state.steps[step];
  if (recorded === "done" || recorded === "skipped") return recorded;
  switch (step) {
    case "username":
      return snapshot.username ? "done" : "todo";
    case "email":
      return snapshot.address ? "done" : "todo";
    case "model":
      // entitlements.speed_tier has a NOT NULL default, so its presence
      // proves nothing — only an explicit choice (recorded above) counts.
      return "todo";
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
    case "agent":
      return "todo";
    case "walkthrough":
      return "todo";
  }
}

function firstOpenStep(snapshot: Snapshot): OnboardingStepId {
  for (const step of ONBOARDING_STEPS) {
    if (effectiveStatus(snapshot, step) === "todo") return step;
  }
  return "walkthrough";
}

function skipForm(step: OnboardingStepId, label = "Skip for now"): string {
  return `<form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="skip"><input type="hidden" name="step" value="${esc(step)}"><button class="ghost">${esc(label)}</button></form>`;
}

function stepBody(snapshot: Snapshot, step: OnboardingStepId): string {
  if (step === "username") {
    const current = snapshot.username
      ? `<p style="font-size:13px">Current: <strong>@${esc(snapshot.username)}</strong></p>`
      : "";
    return `${current}<p style="color:var(--muted);font-size:12px">Lowercase letters, digits, underscore — 2–24 characters. Your agent's email follows it.</p><form method="post" style="display:flex;gap:6px"><input type="hidden" name="action" value="set_username"><input type="text" name="username" placeholder="username" maxlength="24" autocomplete="off"><button>Save</button></form>${skipForm("username")}`;
  }
  if (step === "email") {
    const line = snapshot.address
      ? `<p style="font-size:13px">Your agent reads and drafts at <strong>${esc(snapshot.address)}</strong>. Sending always waits for your approval.</p>`
      : `<p style="color:var(--muted);font-size:13px">Your agent's inbox is provisioned automatically when you set a username — no extra step.</p>`;
    return `${line}${snapshot.address ? `<form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="mark_done"><input type="hidden" name="step" value="email"><button>Looks good</button></form> ` : ""}${skipForm("email")}`;
  }
  if (step === "model") {
    const buttons = SPEED_TIERS.map(
      (tier) =>
        `<form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="set_speed"><input type="hidden" name="speed_tier" value="${esc(tier)}"><button${tier === snapshot.speedTier ? "" : ' class="ghost"'}>${esc(tier)}</button></form>`
    ).join(" ");
    return `<p style="color:var(--muted);font-size:12px">Pick how your agent thinks — faster answers or deeper reasoning. A tier, never a specific model; change it any time in Settings.</p><div style="display:flex;gap:6px">${buttons}</div><div style="margin-top:8px">${skipForm("model")}</div>`;
  }
  if (step === "connect") {
    const byToolkit = new Map(snapshot.connections.map((c) => [c.toolkit, c]));
    const rows = ONBOARDING_TOOLKITS.map(([slug, label]) => {
      const status = byToolkit.get(slug)?.status ?? null;
      const chip =
        status === "active"
          ? '<span style="color:var(--muted);font-size:11px">connected</span>'
          : status === "pending"
            ? '<span style="color:var(--muted);font-size:11px">pending — finish sign-in, then refresh</span>'
            : "";
      const button =
        status === "active"
          ? ""
          : `<form method="post" style="margin:0"><input type="hidden" name="action" value="connect"><input type="hidden" name="toolkit" value="${esc(slug)}"><button>Connect</button></form>`;
      return `<div class="item"><span style="flex:1">${esc(label)}</span>${chip}${button}</div>`;
    }).join("");
    return `${rows}<p style="color:var(--muted);font-size:12px">Apple Calendar connects via an ICS subscription in the Calendar app — there is no OAuth for it here.</p><div style="display:flex;gap:6px"><form method="post" style="margin:0"><input type="hidden" name="action" value="refresh_connections"><button class="ghost">Refresh status</button></form>${skipForm("connect")}</div>`;
  }
  if (step === "imessage") {
    const ingest = snapshot.ingest;
    const statusLine =
      ingest && ingest.chunks > 0
        ? `<p style="font-size:13px">Ingested <strong>${ingest.messages}</strong> messages${ingest.last_upload_at ? ` (last upload ${esc(ingest.last_upload_at.slice(0, 10))})` : ""} — they live on your agent's computer, never on the platform.</p>`
        : `<p style="color:var(--muted);font-size:13px">Your iMessage history lives only on your Mac. Run one command there to copy recent messages to your agent's computer as personal context.</p>`;
    const pluginLine =
      snapshot.pluginSessions > 0
        ? `<p style="color:var(--muted);font-size:12px">WZRD ChatGPT/Claude plugin: ${snapshot.pluginSessions} active session${snapshot.pluginSessions === 1 ? "" : "s"}.</p>`
        : `<p style="color:var(--muted);font-size:12px">Also available: the WZRD plugin for ChatGPT/Claude — start sign-in from the tool, then approve its code in Settings.</p>`;
    const command = snapshot.ingestCommand
      ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Get the one-time upload command</summary><p style="color:var(--muted);font-size:11px;margin:6px 0 4px">Run in Terminal on your Mac (needs Full Disk Access; link valid ~30 minutes):</p><pre>${esc(snapshot.ingestCommand)}</pre><form method="post" style="margin:0"><input type="hidden" name="action" value="refresh_ingest"><button class="ghost">Refresh status</button></form></details>`
      : "";
    return `${statusLine}${command}${pluginLine}<div style="margin-top:8px">${skipForm("imessage")}</div>`;
  }
  if (step === "onairos") {
    if (!snapshot.onairos.available) {
      return `<p style="color:var(--muted);font-size:13px">Onairos personal context isn't configured on this deployment — connect it later from Settings once it is. Nothing here blocks the rest of setup.</p>${skipForm("onairos", "Skip — not configured")}`;
    }
    return `<p style="font-size:13px">${snapshot.onairos.connected ? "Connected — your imported context lives on your computer, and Settings has Re-sync / Disconnect." : "Connect your Onairos context from the main app — the consent flow runs there and your imported context lands on your computer, never on the platform."}</p>${skipForm("onairos")}`;
  }
  if (step === "secrets") {
    const managerLines = snapshot.managers
      .filter((m) => m.manager !== "command")
      .map(
        (m) =>
          `<div style="font-size:12px;color:var(--muted)">${esc(m.manager === "bitwarden" ? "Bitwarden" : "1Password")}: ${esc(m.enabled ? m.status : "off")}</div>`
      )
      .join("");
    return `<p style="color:var(--muted);font-size:12px">Your agent fills secrets only with your approval. Use the built-in vault, or bring your own manager.</p>${managerLines}<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Add a first login (built-in vault)</summary><form method="post" style="display:grid;gap:6px;margin-top:6px"><input type="hidden" name="action" value="add_login"><input type="text" name="name" placeholder="e.g. &quot;Gmail&quot;" maxlength="120"><input type="text" name="username" placeholder="Username" maxlength="200"><input type="password" name="password" placeholder="Password" maxlength="500" autocomplete="off"><button>Save to vault</button></form></details><details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Bring your own manager</summary><form method="post" style="display:grid;gap:6px;margin-top:6px"><input type="hidden" name="action" value="enable_manager"><select name="manager" style="background:var(--surface);color:var(--text);border:0.5px solid var(--ring);border-radius:10px;padding:8px 10px;font-size:13px"><option value="bitwarden">Bitwarden (machine-account token)</option><option value="onepassword">1Password (service-account token)</option></select><input type="password" name="token" placeholder="Access token" maxlength="512" autocomplete="off"><button>Enable</button></form><p style="color:var(--muted);font-size:11px;margin:4px 0 0">The token goes straight to your agent's computer — it is never stored on the platform or shown again.</p></details><div style="margin-top:8px">${snapshot.vaultItemCount > 0 || snapshot.managers.some((m) => m.enabled) ? `<form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="mark_done"><input type="hidden" name="step" value="secrets"><button>Done with secrets</button></form> ` : ""}${skipForm("secrets")}</div>`;
  }
  if (step === "stripe") {
    const merchant = snapshot.merchant;
    const status = !merchant
      ? `<p style="color:var(--muted);font-size:13px">Connect your own Stripe account (Stripe Connect) so you can sell through your storefront — funds settle directly to you; the platform never holds your money. You can do this now or later.</p><form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="connect_stripe"><button>Connect Stripe</button></form>`
      : merchant.charges_enabled
        ? `<p style="font-size:13px">Stripe connected — charges enabled. Manage it from the Shop app.</p>`
        : `<p style="font-size:13px">Stripe onboarding in progress.</p><form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="connect_stripe"><button>Resume onboarding</button></form>`;
    return `${status} ${skipForm("stripe", "Later")}`;
  }
  if (step === "walkthrough") {
    const tour = `<p style="font-size:13px">Quick tour:</p><ul style="font-size:12px;color:var(--muted);margin:4px 0 8px;padding-left:18px"><li><strong>Chat</strong> — one conversation with your agent, same on iMessage and the web.</li><li><strong>Needs you</strong> — every action with side effects (emails, payments, publishes) waits here for your approval.</li><li><strong>Apps</strong> — the App Store: calendar, vault, shop, and mini-apps from publishers.</li><li><strong>Settings</strong> — username, speed, memory, context, plugin sessions.</li></ul>`;
    const buttons = WALKTHROUGH_WORKFLOWS.map(
      ([id, label]) =>
        `<form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="run_workflow"><input type="hidden" name="workflow" value="${esc(id)}"><button class="ghost">${esc(label)}</button></form>`
    ).join(" ");
    return `${tour}<p style="color:var(--muted);font-size:12px">Try a first workflow — all read-only; your agent replies in chat:</p><div style="display:flex;gap:6px;flex-wrap:wrap">${buttons}</div><div style="margin-top:8px">${skipForm("walkthrough", "Finish setup")}</div>`;
  }
  // agent
  return `<p style="color:var(--muted);font-size:12px">Say hello — your agent replies in your chat (iMessage or the web tab), same conversation everywhere.</p><form method="post" style="display:flex;gap:6px"><input type="hidden" name="action" value="ask_agent"><input type="text" name="text" placeholder="e.g. What can you do for me?" maxlength="4000"><button>Send</button></form>${skipForm("agent")}`;
}

function renderOnboarding(
  snapshot: Snapshot,
  active: OnboardingStepId,
  notice: string | null
): string {
  const noticeHtml = notice
    ? `<p style="color:var(--muted);font-size:12px">${esc(notice)}</p>`
    : "";
  const busy = snapshot.boxBusy
    ? '<p style="color:var(--muted);font-size:12px">Your agent\'s computer is busy starting up — progress will save once it\'s awake.</p>'
    : "";
  const items = ONBOARDING_STEPS.map((step, index) => {
    const status = effectiveStatus(snapshot, step);
    const marker =
      status === "done" ? "●" : status === "skipped" ? "○" : "◌";
    const label = `${marker} ${index + 1}. ${STEP_TITLES[step]}${status === "skipped" ? " (skipped)" : ""}`;
    const link = `<a href="?step=${esc(step)}" style="color:inherit;text-decoration:none">${esc(label)}</a>`;
    const bodyHtml =
      step === active
        ? `<div style="margin-top:8px">${stepBody(snapshot, step)}</div>`
        : "";
    return `<div class="card${step === active ? "" : status === "todo" ? " pending" : ""}">${link}${bodyHtml}</div>`;
  }).join("");
  return page(
    "Onboarding",
    `<h1>Set up your agent</h1>${busy}${noticeHtml}${items}`
  );
}

function activeStep(ctx: MiniAppContext, snapshot: Snapshot): OnboardingStepId {
  const requested = ctx.request.nextUrl.searchParams.get("step") ?? "";
  return isOnboardingStep(requested) ? requested : firstOpenStep(snapshot);
}

async function respond(
  ctx: MiniAppContext,
  step: OnboardingStepId | null,
  notice: string | null
): Promise<NextResponse> {
  const snapshot = await loadSnapshot(ctx.supabase, ctx.session.userId);
  return html(
    renderOnboarding(snapshot, step ?? firstOpenStep(snapshot), notice)
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
    return html(renderOnboarding(snapshot, activeStep(ctx, snapshot), null));
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
      return respond(
        ctx,
        null,
        saved ? null : "Couldn't save progress — the computer is starting up."
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
