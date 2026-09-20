import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { recordMuseEvent } from "./events";
import { callMuseWorker } from "./worker";

export interface MuseInboundResult {
  handled: boolean;
  reply?: string;
}

interface MuseInbound {
  userId: string;
  text: string;
  messageId: string;
  agentHint?: string;
}

function explicitMuseText(text: string): string | null {
  const match = /^\/muse(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? (match[1]?.trim() ?? "") : null;
}

/** A non-empty /muse instruction can be intercepted before queueing any agent work. */
export function isMuseInstruction(text: string): boolean {
  const explicit = explicitMuseText(text);
  return explicit !== null && explicit.length > 0;
}

/** Read-only preflight for temporary normal-message relay mode. */
export async function museModeIsActive(supabase: SupabaseClient, userId: string): Promise<boolean> {
  if (!env.museEnabled() || !(await isConnected(supabase, userId))) return false;
  const { data } = await supabase.from("users").select("muse_mode_until").eq("id", userId).maybeSingle();
  const until = typeof data?.muse_mode_until === "string" ? Date.parse(data.muse_mode_until) : 0;
  return Number.isFinite(until) && until > Date.now();
}

async function isConnected(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("connections")
    .select("status")
    .eq("user_id", userId)
    .eq("provider", "muse")
    .eq("toolkit", "muse")
    .maybeSingle();
  return data?.status === "active";
}

async function enqueue(supabase: SupabaseClient, input: MuseInbound): Promise<MuseInboundResult> {
  const response = await callMuseWorker("/internal/commands", {
    user_id: input.userId,
    text: input.text,
    message_id: input.messageId,
    agent_hint: input.agentHint,
  }).catch(() => null);
  if (!response?.ok) return { handled: true, reply: "Muse is temporarily unavailable. Try again shortly." };
  await recordMuseEvent(supabase, { userId: input.userId, kind: "nudge", status: "queued" }).catch(() => undefined);
  return { handled: true, reply: "Sent to Muse." };
}

/**
 * Box-originated hand-off. The marker is emitted only by the owner's own
 * Hermes run, and the instruction travels directly to the Worker DO; it is
 * never placed in the shared database or sent on the owner's behalf.
 */
export async function enqueueMuseHandoff(
  supabase: SupabaseClient,
  input: MuseInbound,
): Promise<boolean> {
  if (!env.museEnabled() || !(await isConnected(supabase, input.userId))) return false;
  const result = await enqueue(supabase, input);
  return result.handled && !result.reply?.startsWith("Muse is temporarily unavailable");
}

/**
 * Owner-only command relay. This module never writes text to Postgres: it
 * transports it directly to the per-user Worker Durable Object, which expires
 * it after 24 hours. A bare /muse intentionally falls through to the mini-app
 * card handler rather than creating a second command UI.
 */
export async function maybeHandleMuseInbound(
  supabase: SupabaseClient,
  input: MuseInbound,
): Promise<MuseInboundResult> {
  if (!env.museEnabled()) return { handled: false };
  const explicit = explicitMuseText(input.text);
  if (explicit === "") return { handled: false };
  const connected = await isConnected(supabase, input.userId);
  if (explicit !== null) {
    if (!connected) return { handled: true, reply: "Connect Muse in Air first, then text /muse followed by your instruction." };
    if (explicit.toLowerCase() === "on") {
      const minutes = env.museModeTtlMinutes();
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      await supabase.from("users").update({ muse_mode_until: until }).eq("id", input.userId);
      return { handled: true, reply: `Muse relay is on for the next ${minutes} minutes. Text normally to steer it, or send /muse off.` };
    }
    if (explicit.toLowerCase() === "off") {
      await supabase.from("users").update({ muse_mode_until: null }).eq("id", input.userId);
      return { handled: true, reply: "Muse relay is off." };
    }
    return enqueue(supabase, { ...input, text: explicit });
  }
  if (!connected) return { handled: false };
  if (!(await museModeIsActive(supabase, input.userId))) return { handled: false };
  return enqueue(supabase, input);
}
