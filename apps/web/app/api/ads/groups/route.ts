/**
 * CM5: ad asset groups. POST submits one job that must return one complete,
 * conformant group (kind "ad_asset_group" against a placement spec); GET
 * lists the spec registry with stale-spec flags, so the UI can name every
 * placement and warn when a constant is past its re-verify window.
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
import { AD_SPECS, staleSpecs } from "@/lib/publish/specs/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stale = new Set(staleSpecs().map((spec) => spec.id));
  return NextResponse.json({
    specs: Object.values(AD_SPECS).map((spec) => ({
      ...spec,
      stale: stale.has(spec.id),
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    spec_id?: string;
    offer?: string;
    brand_rev?: number;
  };
  if (!body.spec_id || !AD_SPECS[body.spec_id]) {
    return NextResponse.json({ error: "unknown spec_id" }, { status: 400 });
  }
  if (!body.offer || typeof body.offer !== "string" || body.offer.length > 8000) {
    return NextResponse.json({ error: "offer required" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const response = await pluginFetch(supabase, box, "POST", "jobs", {
      kind: "ad_asset_group",
      brief: body.offer,
      spec_id: body.spec_id,
      // The generator gets the full spec it is graded against — ratios,
      // asset counts, and character limits — not just an opaque id.
      spec: AD_SPECS[body.spec_id],
      ...(typeof body.brand_rev === "number"
        ? { brand_rev: body.brand_rev }
        : {}),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return NextResponse.json(
        { error: `job submit failed (${response.status})` },
        { status: 502 }
      );
    }
    const job = (await response.json()) as {
      job_id: string;
      cost_estimate: number;
    };
    // Every expansion shows its cost estimate before it runs (CM1 task 4).
    return NextResponse.json({
      job_id: job.job_id,
      cost_estimate: job.cost_estimate,
      spec_id: body.spec_id,
    });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "box start limit" }, { status: 429 });
    }
    if (error instanceof AssetPipelineError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "submit failed" }, { status: 502 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
