/**
 * Standing automation rules (V5, C22): likes/reactions may run without a
 * per-action approval, but only under a rule the owner enabled, inside a
 * daily cap whose counter lives HERE in control-plane Postgres — a box
 * restart cannot reset it — and outside the user's quiet hours. Every
 * claimed unit writes a value-light receipt into Needs-you history.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WAKING_END_HOUR,
  WAKING_START_HOUR,
  isValidTimeZone,
} from "../calendar/schedule";

export const DEFAULT_DAILY_CAP = 25;
export const RULE_PLAYBOOKS = ["social-engage"] as const;
export const RULE_PLATFORMS = [
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
  "linkedin",
] as const;

export interface AutomationRule {
  id: string;
  playbook: string;
  platform: string;
  enabled: boolean;
  daily_cap: number;
  used_today: number;
  last_reset_at: string;
}

export type ClaimResult =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: "rule_disabled" | "cap_reached" | "quiet_hours" };

/**
 * Quiet hours are the user's off-hours — the complement of the V3 waking
 * window (8:00–22:00) in their timezone. The best per-user timezone signal
 * the control plane has is the one their schedules were authored in.
 */
export async function userTimezone(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("agent_schedules")
    .select("timezone")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const timezone = typeof data?.timezone === "string" ? data.timezone : "";
  return timezone && isValidTimeZone(timezone) ? timezone : "UTC";
}

export function inQuietHours(now: Date, timezone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  return hour < WAKING_START_HOUR || hour >= WAKING_END_HOUR;
}

/** Local calendar date in the given timezone, for the daily-cap window. */
function localDay(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Atomically claim one unit against the rule's daily cap. The rule row is
 * the source of truth: disabled rules and exhausted caps refuse, the
 * counter resets when the local day rolls over, and each allowed claim
 * appends an auto-resolved `social_post` receipt so the action shows up in
 * Needs-you history either way (C22).
 */
export async function claimRuleUnit(
  supabase: SupabaseClient,
  userId: string,
  playbook: string,
  platform: string,
  target: string,
  now: Date = new Date()
): Promise<ClaimResult> {
  const { data } = await supabase
    .from("automation_rules")
    .select("id, playbook, platform, enabled, daily_cap, used_today, last_reset_at")
    .eq("user_id", userId)
    .eq("playbook", playbook)
    .eq("platform", platform)
    .maybeSingle();
  const rule = data as AutomationRule | null;
  if (!rule || !rule.enabled) {
    return { allowed: false, reason: "rule_disabled" };
  }
  const timezone = await userTimezone(supabase, userId);
  if (inQuietHours(now, timezone)) {
    return { allowed: false, reason: "quiet_hours" };
  }
  const rolled =
    localDay(new Date(rule.last_reset_at), timezone) !== localDay(now, timezone);
  const used = rolled ? 0 : rule.used_today;
  if (used >= rule.daily_cap) {
    return { allowed: false, reason: "cap_reached" };
  }
  // Guarded update: the used_today match makes concurrent claims serialize —
  // a loser re-reads and retries at the caller (or simply refuses).
  const { data: updated } = await supabase
    .from("automation_rules")
    .update({
      used_today: used + 1,
      ...(rolled ? { last_reset_at: now.toISOString() } : {}),
    })
    .eq("id", rule.id)
    .eq("used_today", rule.used_today)
    .select("id");
  if (!updated || updated.length === 0) {
    return { allowed: false, reason: "cap_reached" };
  }
  // The Needs-you receipt (auto-resolved): target only, never content.
  await supabase.from("decisions").insert({
    user_id: userId,
    kind: "social_post",
    label: `Standing rule: ${playbook} acted on ${platform}`,
    status: "approved",
    resolved_at: now.toISOString(),
    payload: { rule: true, playbook, platform, target: target.slice(0, 500) },
  });
  return { allowed: true, remaining: rule.daily_cap - used - 1 };
}
