import type { SupabaseClient } from "@supabase/supabase-js";
import { createSpectrumSender } from "../spectrum/sender";
import { env } from "../env";
import { recordMuseEvent } from "./events";
import { getMuseSettings } from "./settings";

export type MuseUpdateKind = "info" | "question" | "done" | "alert";

export interface MuseDelivery {
  delivered: boolean;
  deferred: boolean;
  remaining_today: number;
  reason?: "owner_has_not_texted" | "updates_paused" | "quiet_hours" | "daily_cap";
}

interface Destination {
  space_id: string;
  phone: string;
}

async function ownerDestination(
  supabase: SupabaseClient,
  userId: string,
): Promise<Destination | null> {
  // imessage_destinations is written only after the owner's first inbound
  // message, so this is C13 rather than a new history table with content.
  const { data } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.space_id || !data.phone) return null;
  return { space_id: String(data.space_id), phone: String(data.phone) };
}

function localMinutes(now: Date, timezone: string): number {
  const pieces = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(pieces.find((piece) => piece.type === "hour")?.value ?? "0");
  const minute = Number(pieces.find((piece) => piece.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function inQuietHours(now: Date, timezone: string, start: string, end: string): boolean {
  try {
    const current = localMinutes(now, timezone);
    const from = minutes(start);
    const to = minutes(end);
    return from === to ? false : from < to ? current >= from && current < to : current >= from || current < to;
  } catch {
    // A malformed historical timezone must not bypass owner-configured limits.
    return true;
  }
}

function localDayStart(now: Date, timezone: string): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // This is an upper-bound implementation for the cap: querying since UTC
  // midnight can only count more, never leak an extra update to a user.
  return `${formatted}T00:00:00.000Z`;
}

export async function sendMuseUpdate(
  supabase: SupabaseClient,
  input: { userId: string; agent: string; text: string; kind: MuseUpdateKind },
): Promise<MuseDelivery> {
  const destination = await ownerDestination(supabase, input.userId);
  if (!destination) return { delivered: false, deferred: false, remaining_today: 0, reason: "owner_has_not_texted" };

  const settings = await getMuseSettings(supabase, input.userId);
  const dailyCap = Math.min(settings.daily_cap, env.museUpdatesDailyCap());
  if (!settings.updates_enabled) {
    return { delivered: false, deferred: true, remaining_today: dailyCap, reason: "updates_paused" };
  }
  // Air has no profile-level timezone yet; scheduling owns its own timezone.
  // We use UTC until that platform-level preference exists rather than reading
  // a non-existent field or guessing from a phone number.
  const timezone = "UTC";
  const now = new Date();
  if (input.kind !== "alert" && inQuietHours(now, timezone, settings.quiet_hours.start, settings.quiet_hours.end)) {
    await recordMuseEvent(supabase, { userId: input.userId, kind: "notify", agent: input.agent, chars: input.text.length, status: "deferred_quiet_hours" });
    return { delivered: false, deferred: true, remaining_today: dailyCap, reason: "quiet_hours" };
  }

  const cap = input.kind === "alert" ? Math.min(dailyCap, env.museUpdatesAlertCap()) : dailyCap;
  const { count, error } = await supabase
    .from("muse_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("kind", "notify")
    .gte("created_at", localDayStart(now, timezone));
  if (error) throw new Error(`Muse update cap read failed: ${error.message}`);
  const used = count ?? 0;
  if (used >= cap) {
    await recordMuseEvent(supabase, { userId: input.userId, kind: "notify", agent: input.agent, chars: input.text.length, status: "rejected_daily_cap" });
    return { delivered: false, deferred: false, remaining_today: 0, reason: "daily_cap" };
  }

  const sender = await createSpectrumSender();
  try {
    await sender.sendText(
      destination.space_id,
      destination.phone,
      `Muse · ${input.agent}  ${input.text.slice(0, 900)}`,
    );
  } finally {
    await sender.close().catch(() => undefined);
  }
  await recordMuseEvent(supabase, { userId: input.userId, kind: "notify", agent: input.agent, chars: input.text.length, status: "delivered" });
  return { delivered: true, deferred: false, remaining_today: Math.max(0, cap - used - 1) };
}

export async function sendMuseReply(
  supabase: SupabaseClient,
  input: { userId: string; agent: string; text: string },
): Promise<boolean> {
  const destination = await ownerDestination(supabase, input.userId);
  if (!destination) return false;
  const sender = await createSpectrumSender();
  try {
    await sender.sendText(
      destination.space_id,
      destination.phone,
      `Muse · ${input.agent}  ${input.text.slice(0, 900)}`,
    );
  } finally {
    await sender.close().catch(() => undefined);
  }
  await recordMuseEvent(supabase, { userId: input.userId, kind: "reply", agent: input.agent, chars: input.text.length, status: "delivered" });
  return true;
}
