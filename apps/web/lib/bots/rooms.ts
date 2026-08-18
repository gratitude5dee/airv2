/**
 * Rooms (V7): multi-bot group chats orchestrated by the control plane with
 * hard-coded reference caps. Sequential /p/<member>/v1/runs into per-member
 * "Group: <name>" sessions carrying the labelled accumulating transcript;
 * Postgres holds membership metadata only — the transcript lives in each
 * member's own session on the box (C4). Every bot turn rides the gateway, so
 * it meters into entitlements.spend_mtd_usd like any other run; a round
 * never starts once spend threatens the monthly cap.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRun,
  ensureSession,
  runEvents,
  type HermesBoxTarget,
} from "../hermes/client";
import { hermesDeltas } from "../orchestrator/flush";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { createDecision } from "../routing/trust";
import { botTarget } from "./client";
import type { BotRow } from "./store";

// Hard caps (reference values from the spec — deliberately not configurable).
export const ROOM_MIN_MEMBERS = 2;
export const ROOM_MAX_MEMBERS = 6;
export const ROOM_MAX_ROUNDS = 3;
export const ROOM_MAX_MESSAGES = 10;
export const ROOM_PASS_TOKEN = "[PASS]";

/** Spend headroom (USD) a round must have before it is allowed to start. */
const ROUND_BUDGET_HEADROOM_USD = 0.25;

export interface RoomRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface RoomTurnMessage {
  from: string;
  text: string;
}

export interface RoomTurnResult {
  messages: RoomTurnMessage[];
  stopped: "completed" | "budget" | "message_cap" | "needs_user";
}

export function roomSessionId(roomId: string): string {
  return `room-${roomId}`;
}

const USER_MENTION = /(?:^|\s)@user\b/i;

function memberPrompt(
  roomName: string,
  member: string,
  others: string[],
  transcript: string
): string {
  return (
    `You are @${member} in the group "${roomName}" with ${others
      .map((name) => `@${name}`)
      .join(", ")} and the user.\n` +
    `Conversation so far:\n${transcript}\n\n` +
    `Reply as @${member} with one short message for the group. ` +
    `If you have nothing to add, say exactly ${ROOM_PASS_TOKEN}. ` +
    `If this needs the user, include @user in your message.`
  );
}

async function runMemberTurn(
  supabase: SupabaseClient,
  userId: string,
  target: HermesBoxTarget,
  sessionId: string,
  prompt: string
): Promise<string> {
  const run = await createRun(target, { input: prompt, sessionId });
  const startedAt = new Date().toISOString();
  const events = await runEvents(target, run.run_id);
  let streamed = "";
  let final = "";
  for await (const delta of hermesDeltas(events, (output) => {
    final = output;
  })) {
    streamed += delta;
  }
  // Token spend meters at the gateway; this is the run-metadata mirror.
  await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      hermes_run_id: run.run_id,
      trigger: "web",
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      outcome: "completed",
    })
    .then(() => undefined);
  return (final || streamed).trim();
}

/**
 * Run one user send through the room: up to ROOM_MAX_ROUNDS serial rounds of
 * sequential member turns, stopping early when every member passes, the
 * message cap is reached, a member escalates with @user, or the next round
 * would threaten the spend cap.
 */
export async function orchestrateRoomTurn(
  supabase: SupabaseClient,
  userId: string,
  room: RoomRow,
  members: BotRow[],
  userMessage: string
): Promise<RoomTurnResult> {
  const box = await ensureBoxAwake(supabase, userId);
  const sessionId = roomSessionId(room.id);
  const sessionTitle = `Group: ${room.name}`;

  const targets = new Map(
    members.map((bot) => [
      bot.name,
      botTarget(box.target, bot.name, bot.api_server_key),
    ])
  );
  for (const target of targets.values()) {
    await ensureSession(target, sessionId, sessionTitle);
  }

  const messages: RoomTurnMessage[] = [];
  const lines: string[] = [`user: ${userMessage}`];
  let stopped: RoomTurnResult["stopped"] = "completed";

  rounds: for (let round = 0; round < ROOM_MAX_ROUNDS; round++) {
    if (!(await roundBudgetOk(supabase, userId))) {
      stopped = "budget";
      break;
    }
    let anySpoke = false;
    for (const bot of members) {
      if (messages.length >= ROOM_MAX_MESSAGES) {
        stopped = "message_cap";
        break rounds;
      }
      const target = targets.get(bot.name);
      if (!target) continue;
      const others = members.map((m) => m.name).filter((n) => n !== bot.name);
      let reply: string;
      try {
        reply = await runMemberTurn(
          supabase,
          userId,
          target,
          sessionId,
          memberPrompt(room.name, bot.name, others, lines.join("\n"))
        );
      } catch {
        continue; // a failing member forfeits its turn, the room goes on
      }
      if (!reply || reply.includes(ROOM_PASS_TOKEN)) continue;
      anySpoke = true;
      lines.push(`${bot.name}: ${reply}`);
      messages.push({ from: bot.name, text: reply });
      if (USER_MENTION.test(reply)) {
        await createDecision(supabase, {
          userId,
          kind: "run_approval",
          ref: `room:${room.id}:${Date.now()}`,
          label: `Group ${room.name} · @${bot.name} needs you: ${reply}`.slice(
            0,
            200
          ),
        }).catch(() => undefined);
        stopped = "needs_user";
        break rounds;
      }
    }
    if (!anySpoke) break; // everyone passed — the round has settled
  }
  return { messages, stopped };
}

async function roundBudgetOk(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("entitlements")
    .select("monthly_cap_usd, spend_mtd_usd")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  return (
    Number(data.spend_mtd_usd) + ROUND_BUDGET_HEADROOM_USD <
    Number(data.monthly_cap_usd)
  );
}
