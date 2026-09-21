import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { hasMuseWorkerToken, museEnabled } from "@/lib/muse/auth";
import { completeMuseWzrdmailIdentity, MuseIdentityError } from "@/lib/muse/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const Body = z.object({
  subject: z.string().min(12).max(180),
  phone: z.string().trim().min(7).max(32),
});

/** Called only after the Muse Worker redeems WZRDMail's one-use Thirdweb handoff. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled() || !hasMuseWorkerToken(request)) return new NextResponse(null, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const identity = await completeMuseWzrdmailIdentity(
      serviceClient(),
      parsed.data.subject,
      parsed.data.phone,
    );
    return NextResponse.json(
      { user_id: identity.userId, provisioned: identity.provisioned, invite_url: identity.inviteUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof MuseIdentityError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof MuseIdentityError ? error.code : "signup_unavailable" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
