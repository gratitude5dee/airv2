/**
 * Typed owner feedback on a completed run (goal.md V10 §9). The reason enum
 * and optional 1–5 rating are the only things stored centrally; a free-text
 * correction is written to a Box-private file and forwarded by path only.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { isFeedbackReason, recordFeedback } from "@/lib/learning/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    trace_id?: string;
    reason?: string;
    rating?: number;
    correction?: string;
  };
  if (!body.trace_id || typeof body.trace_id !== "string") {
    return NextResponse.json({ error: "trace_id required" }, { status: 400 });
  }
  if (!body.reason || !isFeedbackReason(body.reason)) {
    return NextResponse.json({ error: "invalid reason" }, { status: 400 });
  }
  if (
    body.rating !== undefined &&
    (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
  ) {
    return NextResponse.json({ error: "invalid rating" }, { status: 400 });
  }
  if (body.correction !== undefined && typeof body.correction !== "string") {
    return NextResponse.json({ error: "invalid correction" }, { status: 400 });
  }
  const result = await recordFeedback(serviceClient(), userId, {
    trace_id: body.trace_id,
    reason: body.reason,
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.correction ? { correction: body.correction } : {}),
  });
  return NextResponse.json(result);
}
