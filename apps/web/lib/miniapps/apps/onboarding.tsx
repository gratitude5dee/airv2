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

/** Mono kicker line above each slide title — the "why" in one breath. */
const STEP_KICKERS: Record<OnboardingStepId, string> = {
  username: "Identity",
  email: "Inbox",
  model: "Thinking speed",
  connect: "Accounts",
  imessage: "Context · iMessage",
  onairos: "Context · Onairos",
  secrets: "Key vault",
  stripe: "Get paid",
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

/** Onboarding offers the two golden-path toolkits; the Connect app has all. */
const ONBOARDING_TOOLKITS: Array<[string, string]> = [
  ["gmail", "Gmail"],
  ["googlecalendar", "Google Calendar"],
];

export interface OnboardingSnapshot {
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
  snapshot: OnboardingSnapshot,
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

function firstOpenStep(snapshot: OnboardingSnapshot): OnboardingStepId {
  for (const step of ONBOARDING_STEPS) {
    if (effectiveStatus(snapshot, step) === "todo") return step;
  }
  return "walkthrough";
}

function skipForm(step: OnboardingStepId, label = "Skip for now"): string {
  return `<form method="post" class="inline"><input type="hidden" name="action" value="skip"><input type="hidden" name="step" value="${esc(step)}"><button class="ghost">${esc(label)}</button></form>`;
}

function doneForm(step: OnboardingStepId, label: string): string {
  return `<form method="post" class="inline"><input type="hidden" name="action" value="mark_done"><input type="hidden" name="step" value="${esc(step)}"><button>${esc(label)}</button></form>`;
}

function stepBody(snapshot: OnboardingSnapshot, step: OnboardingStepId): string {
  if (step === "username") {
    const current = snapshot.username
      ? `<p>Current: <strong>@${esc(snapshot.username)}</strong></p>`
      : "";
    return `${current}<p class="muted">Lowercase letters, digits, underscore — 2–24 characters. Your agent's email follows it.</p><form method="post" class="row"><input type="hidden" name="action" value="set_username"><input type="text" name="username" placeholder="username" maxlength="24" autocomplete="off"><button>Save</button></form><div class="row actions">${skipForm("username")}</div>`;
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
  if (step === "connect") {
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
          : `<form method="post" class="inline"><input type="hidden" name="action" value="connect"><input type="hidden" name="toolkit" value="${esc(slug)}"><button>Connect</button></form>`;
      return `<div class="item"><span class="grow">${esc(label)}</span>${chip}${button}</div>`;
    }).join("");
    return `${rows}<p class="muted">Apple Calendar connects via an ICS subscription in the Calendar app — there is no OAuth for it here.</p><div class="row actions"><form method="post" class="inline"><input type="hidden" name="action" value="refresh_connections"><button class="ghost">Refresh status</button></form>${skipForm("connect")}</div>`;
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
    return `<p>${snapshot.onairos.connected ? "Connected — your imported context lives on your computer, and Settings has Re-sync / Disconnect." : "Connect your Onairos context from the main app — the consent flow runs there and your imported context lands on your computer, never on the platform."}</p><div class="row actions">${skipForm("onairos")}</div>`;
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
  if (step === "walkthrough") {
    const tour = `<p>Quick tour:</p><ul><li><strong>Chat</strong> — one conversation with your agent, same on iMessage and the web.</li><li><strong>Needs you</strong> — every action with side effects (emails, payments, publishes) waits here for your approval.</li><li><strong>Apps</strong> — the App Store: calendar, vault, shop, and mini-apps from publishers.</li><li><strong>Settings</strong> — username, speed, memory, context, plugin sessions.</li></ul>`;
    const buttons = WALKTHROUGH_WORKFLOWS.map(
      ([id, label]) =>
        `<form method="post" class="inline"><input type="hidden" name="action" value="run_workflow"><input type="hidden" name="workflow" value="${esc(id)}"><button class="ghost">${esc(label)}</button></form>`
    ).join("");
    return `${tour}<p class="muted">Try a first workflow — all read-only; your agent replies in chat:</p><div class="row">${buttons}</div><div class="row actions">${doneForm("walkthrough", "Finish setup")}</div>`;
  }
  // agent
  return `<p class="muted">Say hello — your agent replies in your chat (iMessage or the web tab), same conversation everywhere.</p><form method="post" class="row"><input type="hidden" name="action" value="ask_agent"><input type="text" name="text" placeholder="e.g. What can you do for me?" maxlength="4000"><button>Send</button></form><div class="row actions">${skipForm("agent")}</div>`;
}

/**
 * Slide-deck shell — one slide per step, painted from theme tokens
 * (../themes.ts, documented in docs/design.md). Everything visual comes from
 * `var(--token)`, so a future Settings theme selector swaps the look without
 * touching this markup. The CSP is derived from the active theme and only
 * widens for what that theme's own first-party assets need; publisher apps
 * keep the strict script-free shell in ../html.
 */
function slides(current: Theme, body: string): NextResponse {
  const headers = baseHeaders();
  headers["Content-Security-Policy"] =
    `${themeCsp(current)}; form-action 'self'; frame-ancestors 'self' ${env.appOrigin()}`;
  return new NextResponse(body, {
    status: 200,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.93' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E";

const SLIDE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;min-height:100svh}
body{background:var(--canvas);color:var(--ink);font-family:var(--font-body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;display:block}
.scrim{position:fixed;inset:0;z-index:1;pointer-events:none;background:var(--scrim)}
.grain{position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:soft-light;opacity:0.15;background-image:url("${GRAIN_SVG}")}
.frame{position:relative;z-index:2;min-height:100svh;display:flex;flex-direction:column;padding:clamp(0.9rem,3.2vw,1.35rem) clamp(1rem,4.5vw,1.7rem)}
header.bar{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;font-family:var(--font-ui)}
.logo-pill{display:inline-flex;align-items:center;height:clamp(2.7rem,9vw,3.4rem);padding:0 clamp(0.85rem,3vw,1.25rem);border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--logo-plate);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow)}
.logo-pill img{display:block;height:clamp(1.2rem,4.4vw,1.6rem);width:auto}
.counter{display:inline-flex;align-items:center;height:2rem;padding:0 0.75rem;border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink)}
main.slide{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(1.2rem,4vw,2.5rem) 0;animation:slideIn var(--slide-in) cubic-bezier(0.22,1,0.36,1)}
@keyframes slideIn{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){main.slide{animation:none}.navlink,button,.dots a{transition:none}}
.kicker{font-family:var(--font-ui);font-size:clamp(0.68rem,0.8vw,0.85rem);letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin:0 0 0.9rem;text-align:center}
h1{font-weight:400;font-size:clamp(1.9rem,5.4vw,3.6rem);letter-spacing:-0.045em;line-height:0.98;margin:0 0 1.4rem;text-align:center;max-width:26ch;text-shadow:0 1px 2px rgba(2,8,20,0.85),0 0.5rem 1.6rem rgba(2,8,20,0.5)}
.panel{width:min(100%,34rem);border-radius:var(--radius-panel);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow);padding:clamp(1rem,3.4vw,1.5rem)}
.notice{width:min(100%,34rem);margin:0 0 0.8rem;font-family:var(--font-ui);font-size:0.72rem;line-height:1.45;letter-spacing:0.04em;color:var(--on-accent);background:var(--accent);border-radius:var(--radius-well);padding:0.55rem 0.8rem}
footer.nav{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;font-family:var(--font-ui)}
.navlink{display:inline-flex;align-items:center;height:2.6rem;padding:0 1.1rem;border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink);text-decoration:none;white-space:nowrap;transition:box-shadow 200ms ease,transform 200ms ease}
.navlink:hover{transform:scale(1.04)}
.navlink.ghosted{opacity:0.35;pointer-events:none}
.dots{display:flex;gap:0.42rem;align-items:center}
.dots a{width:0.5rem;height:0.5rem;border-radius:50%;background:var(--ring);display:block;transition:transform 200ms ease}
.dots a:hover{transform:scale(1.5)}
.dots a.done{background:var(--accent)}
.dots a.skipped{background:var(--ink-muted)}
.dots a.active{outline:1.5px solid var(--accent);outline-offset:2.5px;background:var(--accent)}
p{font-size:0.95rem;line-height:1.5;margin:0 0 0.6rem}
a{color:var(--accent)}
button{font-family:var(--font-ui);background:var(--ink);color:var(--on-ink);border:0;border-radius:var(--radius-pill);padding:0.5rem 1rem;font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;transition:transform 180ms ease}
button:hover{transform:scale(1.05)}
button.ghost{background:transparent;color:var(--ink-muted);border:1px solid var(--ring)}
button.ghost:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
input[type=text],input[type=password],select{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.8rem;flex:1;font-size:0.9rem;font-family:var(--font-body);outline:none;min-width:0}
input[type=text]:focus,input[type=password]:focus{border-color:var(--accent)}
input::placeholder{color:var(--ink-muted)}
.item{display:flex;align-items:center;gap:0.6rem;border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.7rem 0.85rem;margin-bottom:0.55rem;font-size:0.9rem;background:var(--well-bg)}
details{border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.85rem;background:var(--well-bg);margin-bottom:0.6rem}
summary{font-family:var(--font-ui);font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--ink-muted);cursor:pointer}
pre{background:var(--well-bg);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.75rem;font-family:var(--font-ui);font-size:0.68rem;line-height:1.45;white-space:pre-wrap;word-break:break-all;max-height:240px;overflow:auto;color:var(--accent)}
ul{margin:0.2rem 0 0.8rem;padding-left:1.1rem}
li{font-size:0.88rem;line-height:1.5;color:var(--ink-muted)}
li strong{color:var(--ink)}
form{margin:0}
form.inline{display:inline-flex}
form.stack{display:grid;gap:0.5rem;margin-top:0.5rem}
form.stack select{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.8rem;font-size:0.9rem;font-family:var(--font-body)}
.row{display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center}
.row.actions{margin-top:0.85rem}
.grow{flex:1}
.muted{color:var(--ink-muted);font-size:0.85rem}
.chip{font-family:var(--font-ui);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted)}
`;

export function renderOnboarding(
  current: Theme,
  snapshot: OnboardingSnapshot,
  active: OnboardingStepId,
  notice: string | null
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
    backdrop.kind === "shader"
      ? `<script src="${esc(backdrop.script)}" defer></script>`
      : "";
  // The shader element paints itself; if fx.js or WebGL is unavailable it
  // stays an empty inert box and the canvas gradient carries the page.
  const backdropHtml =
    backdrop.kind === "shader"
      ? backdrop.element.replace("<wz-sky", '<wz-sky class="backdrop"')
      : "";
  const grain = backdrop.grain
    ? '<div class="grain" aria-hidden="true"></div>'
    : "";
  const scrim =
    current.tokens.scrim === "none"
      ? ""
      : '<div class="scrim" aria-hidden="true"></div>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Onboarding — ${esc(STEP_TITLES[active])}</title>${fonts}<style>${tokenBlock(current.tokens)}${SLIDE_CSS}</style>${shader}</head><body>${backdropHtml}${scrim}${grain}<div class="frame"><header class="bar"><span class="logo-pill"><img src="/creator-os/wzrd-wordmark-1600.png" alt="WZRD.tech"></span><span class="counter">${pad(index + 1)} / ${pad(ONBOARDING_STEPS.length)}${esc(statusTag)}</span></header><main class="slide">${busy}${noticeHtml}<p class="kicker">${pad(index + 1)} / ${esc(STEP_KICKERS[active])}</p><h1>${esc(STEP_TITLES[active])}</h1><section class="panel">${stepBody(snapshot, active)}</section></main><footer class="nav">${prev ? `<a class="navlink" href="${href(prev)}">← Back</a>` : '<span class="navlink ghosted">← Back</span>'}<nav class="dots" aria-label="Steps">${dots}</nav>${next ? `<a class="navlink" href="${href(next)}">Next →</a>` : '<span class="navlink ghosted">Next →</span>'}</footer></div></body></html>`;
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

async function respond(
  ctx: MiniAppContext,
  step: OnboardingStepId | null,
  notice: string | null
): Promise<NextResponse> {
  const snapshot = await loadSnapshot(ctx.supabase, ctx.session.userId);
  const current = activeTheme(ctx);
  return slides(
    current,
    renderOnboarding(current, snapshot, step ?? firstOpenStep(snapshot), notice)
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
    const current = activeTheme(ctx);
    return slides(
      current,
      renderOnboarding(current, snapshot, activeStep(ctx, snapshot), null)
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
