/**
 * MA3 status flip — always the owner, always from an owner surface. The
 * agent's route can only stage drafts + decisions; this is the only code
 * path that sets status=published, and it requires an uploaded bundle.
 * Resolves any pending miniapp_publish decision for the app on flip.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import {
  PublishError,
  setPublishStatus,
  type PublishStatusFlip,
} from "@/lib/miniapps/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    status?: unknown;
    visibility?: unknown;
  } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const status = body?.status;
  if (status !== "published" && status !== "draft") {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const visibility = body?.visibility;
  const visibilityValue =
    visibility === "public" || visibility === "unlisted" || visibility === "private"
      ? visibility
      : undefined;
  const supabase = serviceClient();
  try {
    await setPublishStatus(
      supabase,
      userId,
      slug,
      status as PublishStatusFlip,
      visibilityValue
    );
    // The owner acted: settle any pending agent-staged publish decision.
    await supabase
      .from("decisions")
      .update({
        status: status === "published" ? "approved" : "dismissed",
        resolved_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("kind", "miniapp_publish")
      .eq("ref", slug)
      .eq("status", "pending");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
