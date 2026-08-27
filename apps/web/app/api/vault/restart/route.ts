/**
 * V2 restart prompt target. An env-injection binding takes effect on the
 * next gateway boot; the Vault tab offers "takes effect next boot — restart
 * now?" and this route performs the restart via a box command.
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
import { restartGateway } from "@/lib/vault/managers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden origin" }, { status: 403 });
  }
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    try {
      await restartGateway(box.boxId);
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429 }
      );
    }
    console.error(
      JSON.stringify({
        msg: "vault restart failed",
        user_id: session.userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "restart failed" }, { status: 502 });
  }
}
