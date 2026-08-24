/**
 * Intent result (buzz.goal.md §MA-Z3). The signer posts the outcome of a
 * claimed intent with `buzz`'s exit-code semantics: the ledger row flips to
 * done/failed (names and states only — content goes to the box document,
 * not Postgres, C4) and reported lists merge into the mirror through the
 * normalizer, which drops anything key-shaped (C9/C18). Exit code 3 means
 * the signer's relay auth failed, which the pending note surfaces as a
 * re-bind hint; 5 is a write conflict the signer retries once itself before
 * reporting.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { BUZZ_LANE, completeEnvelope, laneLink } from "@/lib/miniapps/commandLane";
import {
  getBuzzDoc,
  markBuzzPending,
  mergeBuzzResult,
  putBuzzDoc,
} from "@/lib/miniapps/buzz/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const supabase = serviceClient();
  const link = token
    ? await laneLink(supabase, BUZZ_LANE, token, "buzz_", "connected")
    : null;
  if (!link) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    ok?: boolean;
    exitCode?: number;
    note?: string;
    data?: unknown;
  };
  if (typeof body.id !== "string" || typeof body.ok !== "boolean") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let note = typeof body.note === "string" ? body.note.slice(0, 160) : null;
  if (!body.ok && body.exitCode === 3) {
    note = `${note ? `${note} — ` : ""}relay auth failed: re-bind this community`;
  }
  const completed = await completeEnvelope(
    supabase,
    BUZZ_LANE,
    link,
    body.id,
    body.ok,
    note
  );
  if (!completed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let doc = await getBuzzDoc(supabase, link.user_id, completed.resourceId);
  doc = markBuzzPending(
    doc,
    completed.id,
    body.ok ? "done" : "failed",
    note ?? undefined
  );
  if (body.ok) doc = mergeBuzzResult(doc, body.data);
  await putBuzzDoc(supabase, link.user_id, completed.resourceId, doc);
  return NextResponse.json({ ok: true });
}
