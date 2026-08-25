/**
 * MA10 shared prompt bar for the server-rendered mini-app surface. Every
 * owner-session app renders the same `action=prompt` form; `runPrompt`
 * routes the text to the owner's agent as a MAIN_SESSION run (same contract
 * as /api/mini/agent). Owner-only by construction: "prompt" is never in any
 * module's guestActions, so the loader 403s guests before dispatch.
 */
import { createRun, MAIN_SESSION } from "@/lib/hermes/client";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { esc } from "./html";
import type { MiniAppContext } from "./apps/types";

export const PROMPT_MAX_CHARS = 4000;

/** The shared prompt-bar form. Render for owner sessions only. Ships the
 * shared ui.js helper so highlighted text grows an "Ask agent" chip that
 * quotes the selection into this input (the script self-deduplicates). */
export function promptBar(placeholder = "Ask your agent…"): string {
  return `<form method="post" class="addrow"><input type="hidden" name="action" value="prompt"><input type="text" name="text" placeholder="${esc(placeholder)}" maxlength="${PROMPT_MAX_CHARS}"><button>Send</button></form><script src="/creator-os/ui.js" defer></script>`;
}

/** Start a MAIN_SESSION agent run for the owner's prompt-bar text. */
export async function runPrompt(
  ctx: MiniAppContext,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > PROMPT_MAX_CHARS) return;
  const userId = ctx.session.userId;
  const box = await ensureBoxAwake(ctx.supabase, userId);
  const run = await createRun(box.target, {
    input: trimmed,
    sessionId: MAIN_SESSION,
    metadata: {
      app: ctx.app.slug,
      resource: ctx.session.resourceId,
      surface: "miniapp",
    },
  });
  await ctx.supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: "web",
  });
  await armStopAfter(ctx.supabase, userId);
}
