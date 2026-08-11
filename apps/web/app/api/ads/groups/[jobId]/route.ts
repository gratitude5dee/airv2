/**
 * CM5: one asset group's state and conformance. While the job runs this
 * returns progress; when done it returns the group plus the per-asset
 * conformance matrix (asset × spec slot) — the gaps are the work (task 5).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { pluginFetch, AssetPipelineError } from "@/lib/assets/pipeline";
import { AD_SPECS } from "@/lib/publish/specs/ads";
import {
  groupConformance,
  type AdGroupAsset,
} from "@/lib/ads/conformance";
import { validateBrandSource } from "@/lib/brand/compile";
import type { BrandSource } from "@/lib/brand/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PluginAdGroup {
  job_id: string;
  spec_id: string;
  brand_rev: number | null;
  headlines: string[];
  long_headlines: string[];
  descriptions: string[];
  final_url: string | null;
  image_asset_ids: string[];
  logo_asset_ids: string[];
  video_asset_ids: string[];
  assets: Array<{
    id: string;
    kind: string;
    w: number | null;
    h: number | null;
    duration: number | null;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  if (!/^[a-f0-9]{32}$/.test(jobId)) {
    return NextResponse.json({ error: "bad job id" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const jobRes = await pluginFetch(supabase, box, "GET", `jobs/${jobId}`);
    if (!jobRes.ok) {
      await jobRes.body?.cancel();
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    const job = (await jobRes.json()) as { state: string; error: string | null };
    if (job.state !== "done") {
      return NextResponse.json({ state: job.state, error: job.error });
    }

    const groupRes = await pluginFetch(
      supabase,
      box,
      "GET",
      `ad-groups/${jobId}`
    );
    if (!groupRes.ok) {
      await groupRes.body?.cancel();
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }
    const group = (await groupRes.json()) as PluginAdGroup;
    const spec = AD_SPECS[group.spec_id];
    if (!spec) {
      return NextResponse.json(
        { error: `unknown spec ${group.spec_id}` },
        { status: 409 }
      );
    }

    let brand: BrandSource | null = null;
    const { data: kit } = await supabase
      .from("brand_kits")
      .select("source")
      .eq("user_id", userId)
      .maybeSingle();
    if (kit?.source) {
      try {
        brand = validateBrandSource(kit.source);
      } catch {
        brand = null;
      }
    }

    const logoIds = new Set(group.logo_asset_ids);
    const videoIds = new Set(group.video_asset_ids);
    const assets: AdGroupAsset[] = group.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      w: asset.w,
      h: asset.h,
      duration: asset.duration,
      role: logoIds.has(asset.id)
        ? "logo"
        : videoIds.has(asset.id)
          ? "video"
          : "image",
    }));

    const report = groupConformance(
      spec,
      {
        headlines: group.headlines,
        longHeadlines: group.long_headlines,
        descriptions: group.descriptions,
        finalUrl: group.final_url,
      },
      assets,
      brand
    );
    return NextResponse.json({ state: "done", group, conformance: report });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "box start limit" }, { status: 429 });
    }
    if (error instanceof AssetPipelineError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
