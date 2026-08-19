/**
 * MA4/MA8 public export seam. Publishing a creative flat or render to a
 * durable public URL goes through the shared media lane (Session C's MA4
 * work + the MA8 public media guard) — not through a second storage path
 * invented here. Until that lane lands, the editors surface private
 * short-TTL deliveries only and this interface reports unavailability.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicExportResult {
  ok: boolean;
  /** Durable public URL when ok. */
  url: string | null;
  /** Honest user-facing line when not ok. */
  line: string;
}

export interface PublicExporter {
  publishAsset(
    supabase: SupabaseClient,
    userId: string,
    assetId: string
  ): Promise<PublicExportResult>;
}

/** Placeholder until the MA4 media lane merges (Session C). */
export const publicExporter: PublicExporter = {
  async publishAsset(): Promise<PublicExportResult> {
    return {
      ok: false,
      url: null,
      line: "public link export arrives with the shared media lane — use a private link for now.",
    };
  },
};
