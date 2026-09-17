/**
 * V12 §14.1 `POST /api/create/finalize` — the owner (store session) or the
 * owner's Box (gateway bearer) applies the finalize answers for one app:
 *   { app, name, description, icon_key?, mirror = true, store = "listed" }
 * Metadata is written through the publisher helpers, the `miniapp_publish`
 * decision is filed with the V12 payload (§9.3) and the intake moves to
 * `decision_sent`. 409 `not_ready` with reasons when the app has no dev
 * release or the intake is not in `dev_ready`/`finalizing`. Nothing here
 * flips status — only the owner's tap does.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { PublishError } from "@/lib/miniapps/publish";
import { IntakeError } from "@/lib/create/intake";
import { applyFinalize, FinalizeError, FinalizeInputSchema } from "@/lib/create/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = storeSessionUserId(request) ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = FinalizeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid request",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await applyFinalize(supabase, userId, parsed.data));
  } catch (error) {
    if (error instanceof FinalizeError) {
      return NextResponse.json(
        error.reasons.length > 0 ? { error: error.message, reasons: error.reasons } : { error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof PublishError || error instanceof IntakeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
