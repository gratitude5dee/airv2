/**
 * Model family: writes entitlements.model_family — a family name, never a
 * model ID (the family→model mapping lives in the gateway, C2). The two free
 * Inkling endpoints only save with explicit consent, enforced here as well as
 * in the UI. The write is shared with the MA5 settings mini-app
 * (lib/settings/account.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { isModelFamily, requiresConsent } from "@/lib/entitlements/models";
import { setModelFamily } from "@/lib/settings/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    model_family?: string;
    agree_tml?: boolean;
  };
  if (!body.model_family || !isModelFamily(body.model_family)) {
    return NextResponse.json({ error: "invalid family" }, { status: 400 });
  }
  if (requiresConsent(body.model_family) && body.agree_tml !== true) {
    return NextResponse.json({ error: "consent required" }, { status: 400 });
  }
  const ok = await setModelFamily(serviceClient(), userId, body.model_family);
  if (!ok) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
