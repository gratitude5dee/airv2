/**
 * V2 per-field reveal. Owner session only, exactly one field per call,
 * Cache-Control: no-store on every response that carries a value, and each
 * reveal is audited as vault_events.reveal by the V1 client (C19 — the value
 * itself is returned to the owner's browser once and never logged, stored,
 * or streamed). `field=totp` returns the current ephemeral code instead of
 * the seed.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/http/origin";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { reveal, totp, VaultCliError } from "@/lib/vault/client";
import { vaultItemIdSchema, vaultRevealBodySchema } from "@/lib/vault/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "forbidden origin" },
      { status: 403, headers: NO_STORE }
    );
  }
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }
  const { id } = await params;
  const body = vaultRevealBodySchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!vaultItemIdSchema.safeParse(id).success || !body.success) {
    return NextResponse.json(
      { error: "invalid request" },
      { status: 400, headers: NO_STORE }
    );
  }
  const field = body.data.field;
  // Ownership check against the metadata mirror — no box wake for a 404.
  const { data: item } = await supabase
    .from("vault_items")
    .select("id, kind")
    .eq("user_id", session.userId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) {
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: NO_STORE }
    );
  }
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    let value: string;
    try {
      value =
        field === "totp"
          ? await totp(box.boxId, session.userId, id, "web")
          : await reveal(box.boxId, session.userId, id, field, "web");
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }
    return NextResponse.json({ field, value }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429, headers: NO_STORE }
      );
    }
    if (error instanceof VaultCliError) {
      return NextResponse.json(
        { error: error.code },
        { status: 400, headers: NO_STORE }
      );
    }
    console.error(
      JSON.stringify({
        msg: "vault reveal failed",
        user_id: session.userId,
        item_id: id,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json(
      { error: "reveal failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}
