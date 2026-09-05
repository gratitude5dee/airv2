/**
 * V11 §11.2 `POST /api/create/functions/rotate` — owner store session only.
 * Mints a new runtime token, revokes the old one, writes the secret to the
 * Outbound Worker's KV and re-signs the manifest with the new opaque ref.
 * The response carries the ref, never the token (CR6).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { rotateBackendToken } from "@/lib/functions/approval";
import {
  appOf,
  callerOf,
  functionsErrorResponse,
  jsonBody,
} from "@/lib/functions/createRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, false);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  try {
    const app = await appOf(supabase, caller.userId, body);
    const { tokenRef } = await rotateBackendToken(supabase, caller.userId, app.slug);
    return NextResponse.json({ ok: true, token_ref: tokenRef });
  } catch (error) {
    return functionsErrorResponse(error);
  }
}
