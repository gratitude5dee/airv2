import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MUSE_SETTINGS, type MuseSettings, type MuseSettingsPatch } from "./contracts";

function validHour(value: unknown, fallback: string): string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

function validCap(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 120 ? parsed : fallback;
}

export function normalizeMuseSettings(value: unknown): MuseSettings {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const quiet = candidate["quiet_hours"] && typeof candidate["quiet_hours"] === "object"
    ? candidate["quiet_hours"] as Record<string, unknown>
    : {};
  const mode = candidate["mode_default"];
  return {
    updates_enabled: typeof candidate["updates_enabled"] === "boolean"
      ? candidate["updates_enabled"]
      : DEFAULT_MUSE_SETTINGS.updates_enabled,
    quiet_hours: {
      start: validHour(quiet["start"], DEFAULT_MUSE_SETTINGS.quiet_hours.start),
      end: validHour(quiet["end"], DEFAULT_MUSE_SETTINGS.quiet_hours.end),
    },
    daily_cap: validCap(candidate["daily_cap"], DEFAULT_MUSE_SETTINGS.daily_cap),
    mode_default: mode === "off" || mode === "30m" || mode === "until_off" ? mode : "off",
    wake_email: typeof candidate["wake_email"] === "boolean" ? candidate["wake_email"] : false,
  };
}

export async function getMuseSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<MuseSettings> {
  const { data, error } = await supabase
    .from("users")
    .select("muse_settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Muse settings read failed: ${error.message}`);
  return normalizeMuseSettings(data?.muse_settings);
}

export async function saveMuseSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: MuseSettingsPatch,
): Promise<MuseSettings> {
  const current = await getMuseSettings(supabase, userId);
  const settings = normalizeMuseSettings({
    ...current,
    ...patch,
    quiet_hours: { ...current.quiet_hours, ...(patch.quiet_hours ?? {}) },
  });
  const { error } = await supabase
    .from("users")
    .update({ muse_settings: settings })
    .eq("id", userId);
  if (error) throw new Error(`Muse settings save failed: ${error.message}`);
  return settings;
}
