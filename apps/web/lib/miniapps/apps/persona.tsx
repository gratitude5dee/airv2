/**
 * Persona mini-app — a living visualization of who the agent knows you to
 * be: onboarding progress, connected accounts, Onairos context, vault depth,
 * and model preference rendered as an animated constellation (self-hosted
 * canvas script under the shell's `script-src 'self'` CSP — no inline JS,
 * no third-party loads), followed by the two memory layers the agent draws
 * on: the user's Cortex (Mitosis) office and the box-local OpenViking deep
 * memory history. Memory data flows box → response only (never persisted);
 * a sleeping box or unconfigured memory renders as a quiet empty state.
 * Owner-only; read-only (no actions).
 */
import { esc } from "../html";
import { renderShell, shellHtml } from "../shell";
import {
  effectiveStatus,
  loadOnboardingSnapshot,
  type OnboardingSnapshot,
} from "./onboarding";
import { ONBOARDING_STEPS } from "../onboarding";
import {
  cortexOverview,
  CORTEX_UNAVAILABLE,
  type CortexOverview,
} from "@/lib/memory/cortex";
import {
  deepMemoryHistory,
  deepMemoryStatus,
  type DeepMemoryHistory,
  type DeepMemoryStatus,
} from "@/lib/memory/deep";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import type { MiniAppContext, MiniAppModule } from "./types";

interface PersonaNode {
  label: string;
  group: "signal" | "account" | "context";
  /** 0..1 — how "lit" the node renders (done vs pending). */
  energy: number;
}

interface PersonaData {
  name: string;
  completion: number;
  nodes: PersonaNode[];
}

const STEP_LABELS: Record<string, string> = {
  username: "Identity",
  email: "Inbox",
  model: "Thinking",
  connect: "Accounts",
  imessage: "iMessage history",
  onairos: "Onairos context",
  secrets: "Vault",
  stripe: "Get paid",
  agent: "First contact",
  walkthrough: "Workflows",
};

function buildPersonaData(snapshot: OnboardingSnapshot): PersonaData {
  const nodes: PersonaNode[] = [];
  let done = 0;
  for (const step of ONBOARDING_STEPS) {
    const status = effectiveStatus(snapshot, step);
    if (status !== "todo") done += 1;
    nodes.push({
      label: STEP_LABELS[step] ?? step,
      group: "signal",
      energy: status === "done" ? 1 : status === "skipped" ? 0.45 : 0.15,
    });
  }
  for (const connection of snapshot.connections) {
    nodes.push({
      label: connection.toolkit,
      group: "account",
      energy: connection.status === "active" ? 1 : 0.3,
    });
  }
  if (snapshot.onairos.available) {
    nodes.push({
      label: "Onairos",
      group: "context",
      energy: snapshot.onairos.connected ? 1 : 0.2,
    });
  }
  if (snapshot.vaultItemCount > 0) {
    nodes.push({
      label: `${snapshot.vaultItemCount} vault ${snapshot.vaultItemCount === 1 ? "key" : "keys"}`,
      group: "context",
      energy: 1,
    });
  }
  if (snapshot.ingest && snapshot.ingest.chunks > 0) {
    nodes.push({
      label: "Message history",
      group: "context",
      energy: 1,
    });
  }
  if (snapshot.speedTier) {
    nodes.push({ label: snapshot.speedTier, group: "context", energy: 0.8 });
  }
  return {
    name: snapshot.username ?? "you",
    completion: done / ONBOARDING_STEPS.length,
    nodes,
  };
}

const PERSONA_CSS = `
.persona-stage{width:min(100%,36rem);aspect-ratio:1/1.15;max-height:62svh;border-radius:var(--radius-panel);border:1px solid var(--ring);background:var(--panel-bg);box-shadow:var(--shadow);overflow:hidden;position:relative}
.persona-stage canvas{display:block;width:100%;height:100%}
.persona-legend{width:min(100%,36rem);display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;margin-top:0.8rem}
.mem{width:min(100%,36rem);margin-top:1.6rem;border-radius:var(--radius-panel);border:1px solid var(--ring);background:var(--panel-bg);box-shadow:var(--shadow);padding:1rem 1.1rem}
.mem-head{display:flex;align-items:baseline;justify-content:space-between;gap:0.6rem;flex-wrap:wrap}
.mem-head h2{margin:0}
.mem-head a{font-family:var(--font-ui);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted);text-decoration:none;border:1px solid var(--ring);border-radius:var(--radius-pill);padding:0.25rem 0.6rem;white-space:nowrap}
.mem-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.5rem;margin:0.75rem 0}
.mem-stat{border:1px solid var(--ring);border-radius:calc(var(--radius-panel)*0.6);padding:0.55rem 0.65rem;background:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))}
.mem-stat b{display:block;font-size:1.15rem;font-weight:600;font-variant-numeric:tabular-nums}
.mem-stat span{font-family:var(--font-ui);font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-muted)}
.mem-list{list-style:none;margin:0.5rem 0 0;padding:0}
.mem-list li{display:flex;flex-direction:column;gap:0.15rem;padding:0.55rem 0;border-top:1px solid var(--ring)}
.mem-list li:first-child{border-top:none}
.mem-title{font-size:0.9rem;line-height:1.45;color:var(--ink);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.mem-meta{font-family:var(--font-ui);font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--ink-muted)}
.mem-chips{display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem}
`;

function timeAgo(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "";
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function humanBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** viking://user/… → the human tail of the memory's URI. */
function uriTail(uri: string): string {
  const tail = uri.replace(/^viking:\/\//, "").split("/").filter(Boolean);
  return tail.slice(-2).join(" / ") || uri;
}

function renderCortexSection(cortex: CortexOverview): string {
  const graphLink = cortex.graphUrl
    ? `<a href="${esc(cortex.graphUrl)}" rel="noreferrer">Open graph</a>`
    : "";
  if (!cortex.configured) {
    return `
<section class="mem">
  <div class="mem-head"><h2>Cortex memory</h2></div>
  <p class="muted">Not connected. Add your Mitosis office to your agent's vault (MITOSIS_OFFICE_ID + MITOSIS_API_KEY) and this section fills with what your memory knows.</p>
</section>`;
  }
  if (!cortex.reachable) {
    return `
<section class="mem">
  <div class="mem-head"><h2>Cortex memory</h2></div>
  <p class="muted">Connected, but your memory didn't answer just now — try again in a minute.</p>
</section>`;
  }
  const sourceChips = cortex.sources.length
    ? `<div class="mem-chips">${cortex.sources
        .map(
          (source) =>
            `<span class="chip on">${esc(source.label)}${source.items ? ` · ${source.items}` : ""}</span>`
        )
        .join("")}</div>`
    : `<p class="muted">No sources connected yet — connect email, calendar, or chats at Mitosis to deepen this memory.</p>`;
  const recent = cortex.recent.length
    ? `<ul class="mem-list">${cortex.recent
        .map(
          (item) => `<li>
  <span class="mem-title">${esc(item.title)}</span>
  <span class="mem-meta">${esc([item.source, timeAgo(item.ageSeconds)].filter(Boolean).join(" · "))}</span>
</li>`
        )
        .join("")}</ul>`
    : `<p class="muted">Nothing recalled yet. As you and your agent work, durable facts land here.</p>`;
  return `
<section class="mem">
  <div class="mem-head"><h2>Cortex memory${cortex.officeName ? ` — ${esc(cortex.officeName)}` : ""}</h2>${graphLink}</div>
  <div class="mem-stats">
    <div class="mem-stat"><b>${cortex.totals.raw}</b><span>items</span></div>
    <div class="mem-stat"><b>${cortex.totals.embedded}</b><span>embedded</span></div>
    <div class="mem-stat"><b>${cortex.totals.entities}</b><span>entities</span></div>
  </div>
  ${sourceChips}
  ${recent}
</section>`;
}

function renderOpenVikingSection(
  status: DeepMemoryStatus | null,
  history: DeepMemoryHistory | null
): string {
  if (!status) {
    return `
<section class="mem">
  <div class="mem-head"><h2>OpenViking history</h2></div>
  <p class="muted">Your agent's computer is asleep — open this again in a minute to browse your deep memory.</p>
</section>`;
  }
  const rows = (history?.memories ?? [])
    .map(
      (memory) => `<li>
  <span class="mem-title">${esc(memory.preview)}</span>
  <span class="mem-meta">${esc(uriTail(memory.uri))}</span>
</li>`
    )
    .join("");
  const list = rows
    ? `<ul class="mem-list">${rows}</ul>`
    : `<p class="muted">No derived memories yet. Finish onboarding ingest or chat with your agent and they'll appear here.</p>`;
  return `
<section class="mem">
  <div class="mem-head"><h2>OpenViking history</h2><span class="chip${status.healthy ? " on" : ""}">${status.healthy ? "healthy" : "degraded"}</span></div>
  <div class="mem-stats">
    <div class="mem-stat"><b>${status.resources}</b><span>resources</span></div>
    <div class="mem-stat"><b>${history?.memories.length ?? 0}</b><span>memories</span></div>
    <div class="mem-stat"><b>${esc(humanBytes(status.workspace_bytes))}</b><span>workspace</span></div>
  </div>
  ${list}
</section>`;
}

export const persona: MiniAppModule = {
  async render(ctx: MiniAppContext) {
    const { session, supabase } = ctx;
    const snapshot = await loadOnboardingSnapshot(supabase, session.userId);
    const data = buildPersonaData(snapshot);
    const pct = Math.round(data.completion * 100);

    // Memory layers live on the box; a box that can't wake must not break
    // the constellation view.
    let cortex: CortexOverview = CORTEX_UNAVAILABLE;
    let ovStatus: DeepMemoryStatus | null = null;
    let ovHistory: DeepMemoryHistory | null = null;
    try {
      const box = await ensureBoxAwake(supabase, session.userId);
      [cortex, ovStatus, ovHistory] = await Promise.all([
        cortexOverview(box.boxId),
        deepMemoryStatus(box.boxId).catch(() => null),
        deepMemoryHistory(box.boxId).catch(() => null),
      ]);
    } catch {
      // sleeping/limited box — render the empty states below
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }

    const chips = data.nodes
      .filter((node) => node.energy >= 0.45)
      .slice(0, 10)
      .map((node) => `<span class="chip on">${esc(node.label)}</span>`)
      .join("");
    const body = `
<style>${PERSONA_CSS}</style>
<div class="persona-stage"><canvas id="persona-canvas" aria-label="Living visualization of your persona"></canvas></div>
<script type="application/json" id="persona-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script src="/creator-os/persona.js" defer></script>
<div class="persona-legend">${chips}</div>
<p class="muted" style="text-align:center;margin-top:0.7rem">${pct}% of your context is lit. Connect more accounts and finish onboarding to grow it.</p>
${renderCortexSection(cortex)}
${renderOpenVikingSection(ovStatus, ovHistory)}`;
    return shellHtml(
      renderShell({
        title: "Persona",
        kicker: "Who air knows",
        body,
        lite: session.via === "card",
      })
    );
  },
};
