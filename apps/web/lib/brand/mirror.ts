/**
 * Mirror, don't sync (CM0 task 3): the control plane owns the brand source;
 * the box gets a compiled copy on write and on resume. The box copies are
 * derived artifacts and always safe to overwrite — nothing ever merges back.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeFile, command } from "../box/client";
import { compileBrand, validateBrandSource } from "./compile";

interface BrandKitRow {
  source: unknown;
  rev: number;
  mirrored_rev: number;
}

/** Paths are relative to the box work directory (/home/user). */
const THEME_DIR = ".hermes/dashboard-themes";
const BRAND_MD_PATH = "BRAND.md";

/**
 * Compile the user's brand kit and write theme.yaml + BRAND.md into the box.
 * Assumes the box is already awake; callers on the wake path invoke this
 * fire-and-forget after health, like the dashboard route refresh.
 */
export async function mirrorBrandToBox(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
  options?: { onlyIfStale?: boolean }
): Promise<void> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("source, rev, mirrored_rev")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`brand kit lookup failed: ${error.message}`);
  }
  if (!data) return; // no brand kit yet — nothing to mirror
  const row = data as BrandKitRow;
  if (options?.onlyIfStale && row.mirrored_rev >= row.rev) return;

  const source = validateBrandSource(row.source);
  const compiled = compileBrand(source);
  await command(boxId, `mkdir -p /home/user/${THEME_DIR}`);
  await writeFile(boxId, `${THEME_DIR}/${source.name}.yaml`, compiled.themeYaml);
  await writeFile(boxId, BRAND_MD_PATH, compiled.brandMd);

  // Conditional on rev so a concurrent newer write is never marked mirrored.
  await supabase
    .from("brand_kits")
    .update({ mirrored_rev: row.rev })
    .eq("user_id", userId)
    .eq("rev", row.rev);
}

/** Best-effort wrapper for the wake path — never blocks or fails a turn. */
export async function mirrorBrandIfStale(
  supabase: SupabaseClient,
  userId: string,
  boxId: string
): Promise<void> {
  try {
    await mirrorBrandToBox(supabase, userId, boxId, { onlyIfStale: true });
  } catch (error) {
    console.log(
      JSON.stringify({
        msg: "brand mirror failed",
        box_id: boxId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
