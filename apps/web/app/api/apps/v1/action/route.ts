/**
 * Apps API (MA3): POST a typed action the bundle's manifest.json declares.
 * Guests may only invoke actions the manifest lists as guest-safe. Actions
 * never execute side effects directly — they append to the app's own action
 * log (.hermes/miniapps/<slug>/actions.json) for the user's agent to pick up
 * through the normal decision-gated tool paths (MA10: the agent sees a file,
 * not a special subsystem; no gate is bypassed because nothing fires here).
 * The Functions runtime API appends to the same log through the same leased
 * helper, so neither writer can drop the other's entry.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  appsApiSession,
  bundleManifest,
  stateUserId,
} from "@/lib/miniapps/appsApi";
import {
  ActionLogBusyError,
  appendActionLogEntry,
} from "@/lib/miniapps/actionLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACTION_NAME_RE = /^[a-z0-9_.-]{1,64}$/;
const PAYLOAD_MAX_BYTES = 16 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await appsApiSession(request, supabase);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > PAYLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  let body: { action?: unknown; payload?: unknown };
  try {
    body = JSON.parse(raw) as { action?: unknown; payload?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTION_NAME_RE.test(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  const manifest = await bundleManifest(auth.app);
  if (!manifest.actions.includes(action)) {
    return NextResponse.json({ error: "undeclared action" }, { status: 403 });
  }
  if (
    auth.session.role === "guest" &&
    !manifest.guestActions.includes(action)
  ) {
    return NextResponse.json(
      { error: "guests can't do that here" },
      { status: 403 }
    );
  }
  const userId = stateUserId(auth);
  if (!userId) {
    return NextResponse.json({ error: "no app owner" }, { status: 403 });
  }
  try {
    await appendActionLogEntry(supabase, userId, auth.app.slug, {
      action,
      payload: body.payload ?? null,
      role: auth.session.role,
      at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ActionLogBusyError) {
      return NextResponse.json(
        { error: "busy, try again" },
        { status: 503, headers: { "Retry-After": "1" } }
      );
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
