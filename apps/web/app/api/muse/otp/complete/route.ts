import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { completeMuseOtp, MuseIdentityError } from "@/lib/muse/identity";
import { guardResponse, requireWorker } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const Body = z.object({ phone: z.string().trim().min(7).max(32), code: z.string().trim().regex(/^\d{6}$/) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireWorker(request, "muse").catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const identity = await completeMuseOtp(serviceClient(), parsed.data.phone, parsed.data.code);
    // The opaque user ID becomes Worker session state. The invite deep-link is
    // rendered only in this verified user's consent page; neither value is
    // written to a grant, event, Worker log, or command queue.
    return NextResponse.json({
      user_id: identity.userId,
      provisioned: identity.provisioned,
      invite_url: identity.inviteUrl,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof MuseIdentityError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof MuseIdentityError ? error.code : "signup_unavailable" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
