/**
 * Owner learning status (goal.md V10 §5): mode, budgets, Box daemon health,
 * content-free counts, active profile pointer. Everything in this response
 * is opaque IDs, enums, and aggregates — no learning content.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { getStatus } from "@/lib/learning/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const status = await getStatus(serviceClient(), userId);
  return NextResponse.json(status);
}
