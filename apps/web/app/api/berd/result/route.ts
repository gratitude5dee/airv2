/**
 * Envelope result (berd.goal.md §MA-B3). Berd posts the outcome of a claimed
 * envelope: the ledger row flips to done/failed (names and states only — the
 * result content goes to the box document, not Postgres, C4) and the
 * reported lists are merged into the mirror through the normalizer, which
 * bounds every field and drops anything key-shaped (C9/C18). A result for an
 * envelope that is not this user's, or was already completed, is refused —
 * replays land there.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { BERD_LANE, completeEnvelope, laneLink } from "@/lib/miniapps/commandLane";
import {
  getBerdDoc,
  markBerdPending,
  mergeBerdResult,
  putBerdDoc,
} from "@/lib/miniapps/berd/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const supabase = serviceClient();
  const link = token
    ? await laneLink(supabase, BERD_LANE, token, "berd_", "paired")
    : null;
  if (!link) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    ok?: boolean;
    note?: string;
    data?: unknown;
  };
  if (typeof body.id !== "string" || typeof body.ok !== "boolean") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const note =
    typeof body.note === "string" ? body.note.slice(0, 200) : null;
  const completed = await completeEnvelope(
    supabase,
    BERD_LANE,
    link,
    body.id,
    body.ok,
    note
  );
  if (!completed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let doc = await getBerdDoc(supabase, link.user_id, completed.resourceId);
  doc = markBerdPending(
    doc,
    completed.id,
    body.ok ? "done" : "failed",
    note ?? undefined
  );
  if (body.ok) doc = mergeBerdResult(doc, body.data);
  await putBerdDoc(supabase, link.user_id, completed.resourceId, doc);
  return NextResponse.json({ ok: true });
}
