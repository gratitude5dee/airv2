/**
 * Operator-only provisioning endpoint (goal.md M1/M3 — no public onboarding).
 * Guarded by ADMIN_API_KEY; never exposed to end users.
 */
import { NextRequest, NextResponse } from "next/server";
import type { BoxProviderKind } from "@/lib/box/client";
import { z } from "zod";
import { parseBody } from "@/lib/http/body";
import { provisionUser } from "@/lib/provisioning/provision";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isBoxProvider(value: string): value is BoxProviderKind {
  return value === "ascii" || value === "tenki";
}

const Body = z.object({
  display_name: z.string().optional(),
  bound_phone: z.string().optional(),
  line_phone: z.string().optional(),
  operator: z.string().optional(),
  /** Linux box provider; omitted = ascii. Tenki is ubuntu-only. */
  provider: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = await parseBody(request, Body);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    if (body.provider !== undefined && !isBoxProvider(body.provider)) {
      return NextResponse.json(
        { error: "provider must be ascii or tenki" },
        { status: 400 }
      );
    }
    const result = await provisionUser({
      displayName: body.display_name,
      boundPhone: body.bound_phone,
      linePhone: body.line_phone,
      operator: body.operator,
      provider: body.provider,
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
