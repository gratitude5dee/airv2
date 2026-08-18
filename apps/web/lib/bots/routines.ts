/**
 * Bot routines (V7): Hermes cron jobs inside the bot's profile — the box-cron
 * half of V3's split, no delivery adapter (deliver stays "local", so a
 * routine never wakes iMessage). Job names are namespaced `[bot:<name>] …`
 * for `hermes cron list` parity; prompt bodies live only in the box (C4).
 *
 * Escalation: every routine prompt carries the exact marker instruction, and
 * the control plane string-matches `[NEEDS-USER] <one line>` in the last run
 * output, converting it into a Needs-you decision (run_approval — no new
 * kind).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HermesJob } from "../hermes/client";
import { createDecision } from "../routing/trust";
import type { BotRow } from "./store";

export function routineJobName(botName: string, routine: string): string {
  return `[bot:${botName}] ${routine}`;
}

export function isBotRoutineJob(botName: string, jobName: string | undefined): boolean {
  return (jobName ?? "").startsWith(`[bot:${botName}] `);
}

export function displayRoutineName(botName: string, jobName: string | undefined): string {
  const prefix = `[bot:${botName}] `;
  const name = jobName ?? "";
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/** The exact escalation instruction appended to every routine prompt. */
export function routinePrompt(prompt: string, userLabel: string): string {
  const marker = `if this needs ${userLabel}, say \`[NEEDS-USER] <one line>\``;
  return prompt.includes("[NEEDS-USER]") ? prompt : `${prompt}\n\n${marker}`;
}

const NEEDS_USER_LINE = /\[NEEDS-USER\][ \t]*(.*)/;

/** Extract the one-line escalation from a routine's output, if present. */
export function needsUserLine(output: string | null | undefined): string | null {
  if (!output) return null;
  const match = NEEDS_USER_LINE.exec(output);
  if (!match) return null;
  return (match[1] ?? "").split("\n")[0]?.trim() || "This routine needs you";
}

/**
 * Post-run string-match: convert `[NEEDS-USER]` markers in routine outputs
 * into run_approval Needs-you decisions. Deduped per (job, last_run_at) via
 * decisions.ref, so re-scans never double-post the same escalation.
 */
export async function scanRoutineEscalations(
  supabase: SupabaseClient,
  userId: string,
  bot: BotRow,
  jobs: HermesJob[]
): Promise<void> {
  for (const job of jobs) {
    if (!isBotRoutineJob(bot.name, job.name)) continue;
    const line = needsUserLine(job.last_output);
    if (!line) continue;
    const ref = `bot:${bot.name}:${job.id}:${job.last_run_at ?? "latest"}`;
    const { data } = await supabase
      .from("decisions")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "run_approval")
      .eq("ref", ref)
      .limit(1);
    if (data && data.length > 0) continue;
    await createDecision(supabase, {
      userId,
      kind: "run_approval",
      ref,
      label: `@${bot.name} · ${displayRoutineName(bot.name, job.name)}: ${line}`.slice(
        0,
        200
      ),
    }).catch(() => undefined);
  }
}
