/**
 * Operator-only provisioning endpoint (goal.md M1/M3 — no public onboarding).
 * Guarded by ADMIN_API_KEY; never exposed to end users.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { provisionUser } from "@/lib/provisioning/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = env.adminApiKey();
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      display_name?: string;
      bound_phone?: string;
      line_phone?: string;
      operator?: string;
    };
    const result = await provisionUser({
      displayName: body.display_name,
      boundPhone: body.bound_phone,
      linePhone: body.line_phone,
      operator: body.operator,
    });
    return NextResponse.json({
      user_id: result.userId,
      box_id: result.boxId,
      invite_link: result.inviteLink ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
