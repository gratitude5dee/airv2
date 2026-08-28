/**
 * Hosted approval API for app.wzrd.tech/approve/<decision>. Auth is either
 * the short-TTL signed deep link token (`k`, minted at send time for the
 * iMessage link) or the owner's web session — both resolve to the same
 * user, and the decision's own status machine (pending-only, single flip)
 * gates every action. GET returns the sanitized value-free view; POST
 * resolves through the SAME rails as /api/decisions (lib/approvals/hosted).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { verifyApprovalToken } from "@/lib/approvals/token";
import {
  HOSTED_KINDS,
  hostedErrorResponse,
  loadHostedApproval,
  resolveHostedDecision,
  type HostedDecision,
} from "@/lib/approvals/hosted";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// purchase_review approval wakes the user's box (ensureBoxAwake), which can
// exceed the default function timeout.
export const maxDuration = 300;

interface Authed {
  userId: string;
  tokenExp: number | null;
}

function authenticate(
  request: NextRequest,
  decisionId: string,
  bodyToken?: string
): Authed | null {
  const token =
    bodyToken ?? request.nextUrl.searchParams.get("k") ?? undefined;
  if (token) {
    const claims = verifyApprovalToken(token, decisionId);
    if (claims) return { userId: claims.userId, tokenExp: claims.exp };
  }
  const userId = sessionUserId(request);
  return userId ? { userId, tokenExp: null } : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const auth = authenticate(request, id);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const view = await loadHostedApproval(supabase, auth.userId, id, auth.tokenExp);
  if (!view) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    method?: string;
    k?: string;
  };
  const auth = authenticate(
    request,
    id,
    typeof body.k === "string" ? body.k : undefined
  );
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!["approve", "dismiss"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status, payload")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (
    !decision ||
    !(HOSTED_KINDS as readonly string[]).includes(decision.kind as string)
  ) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (decision.status !== "pending") {
    return NextResponse.json(
      { error: "already resolved", status: decision.status },
      { status: 409 }
    );
  }
  try {
    const result = await resolveHostedDecision(
      supabase,
      auth.userId,
      decision as HostedDecision,
      body.action === "approve" ? "approve" : "dismiss",
      body.method === "link" ? "link" : "fill"
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const mapped = hostedErrorResponse(error);
    if (mapped) return mapped;
    console.error(
      JSON.stringify({
        msg: "hosted approval resolution failed",
        user_id: auth.userId,
        decision_id: id,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json(
      { error: "could not resolve this approval — try again" },
      { status: 502 }
    );
  }
}
