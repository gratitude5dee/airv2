/**
 * Persona mini-app — a living visualization of who the agent knows you to
 * be: onboarding progress, connected accounts, Onairos context, vault depth,
 * and model preference rendered as an animated constellation (self-hosted
 * canvas script under the shell's `script-src 'self'` CSP — no inline JS,
 * no third-party loads). Data flows one way: server snapshot → JSON data
 * block → canvas. Owner-only; read-only (no actions).
 */
import { esc } from "../html";
import { renderShell, shellHtml } from "../shell";
import {
  effectiveStatus,
  loadOnboardingSnapshot,
  type OnboardingSnapshot,
} from "./onboarding";
import { ONBOARDING_STEPS } from "../onboarding";
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
`;

export const persona: MiniAppModule = {
  async render(ctx: MiniAppContext) {
    const { session, supabase } = ctx;
    const snapshot = await loadOnboardingSnapshot(supabase, session.userId);
    const data = buildPersonaData(snapshot);
    const pct = Math.round(data.completion * 100);
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
<p class="muted" style="text-align:center;margin-top:0.7rem">${pct}% of your context is lit. Connect more accounts and finish onboarding to grow it.</p>`;
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
