/**
 * Fleet-wide operator settings — the `platform_settings` table (migration
 * 0108). Metadata-only knobs (C4): service-role reads/writes, no user-facing
 * surface.
 */
import { serviceClient } from "../supabase";

/** platform_settings key for which provider brand-new boxes land on. */
export const BOX_DEFAULT_PROVIDER_KEY = "box_default_provider";

/**
 * The stored value of a platform setting, or undefined when unset. Never
 * throws — a provisioning path must still reach its default if the settings
 * table cannot be read.
 */
export async function readPlatformSetting(
  key: string
): Promise<string | undefined> {
  try {
    const { data, error } = await serviceClient()
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return typeof data?.value === "string" ? data.value : undefined;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "platform setting read failed",
        key,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return undefined;
  }
}

/** Sets a platform setting. Throws on write failure — a silent no-op write
 * would show the operator a setting that never took effect. */
export async function writePlatformSetting(
  key: string,
  value: string
): Promise<void> {
  const { error } = await serviceClient()
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) {
    throw new Error(`platform setting write failed: ${error.message}`);
  }
}
