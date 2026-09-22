/**
 * Box-filed calendar invites (comms skill): the agent extracts an
 * externally-sourced booking or event — a flight confirmation, a hotel
 * reservation, an invite inside a message — and files it exactly the way
 * inbound .ics drops land: raw bytes into the box calendar inbox plus one
 * pending `calendar_add` decision for the owner. Writes reach the calendar
 * only through that decision, never directly.
 *
 * Box Bearer auth only — the owner's surfaces never call this.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callingBox } from "@/lib/box/auth";
import { command } from "@/lib/box/client";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
import { extractInviteSummary, inviteLabel } from "@/lib/calendar/ics";
import { materializeIcs } from "@/lib/calendar/store";
import { createDecision } from "@/lib/routing/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

const FileInviteSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  // A full .ics document synthesized from the extracted booking details.
  ics: z.string().min(1).max(256 * 1024),
  sender: z.string().trim().max(200).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }
  const parsed = await parseBody(request, FileInviteSchema);
  if (!parsed.ok) return parsed.response;
  const { filename, ics, sender } = parsed.data;

  if (!ics.includes("BEGIN:VEVENT")) {
    return NextResponse.json(
      { error: "not an invite" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ref = await materializeIcs(
    box.boxId,
    filename,
    Buffer.from(ics, "utf8")
  );
  const summary = extractInviteSummary(ics);
  await createDecision(supabase, {
    userId: box.userId,
    kind: "calendar_add",
    platform: "email",
    sender: sender || undefined,
    ref,
    label: inviteLabel(summary),
    ...(summary.uid ? { payload: { event_uid: summary.uid } } : {}),
  });
  // Pending until the owner decides — but the store should already show
  // it, so run the sync job's box-side fallback directly (the caller is
  // the box, so it is awake by definition).
  await command(
    box.boxId,
    "python3 /home/user/.hermes/calendar/sync.py pull",
    120
  ).catch(() => undefined);

  return NextResponse.json(
    { ok: true, status: "pending_approval", ref },
    { headers: NO_STORE }
  );
}
