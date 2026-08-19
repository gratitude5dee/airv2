/**
 * MA10 prompt bar backend. An owner session inside a mini-app posts a
 * message; it runs in MAIN_SESSION (the one durable Hermes conversation)
 * with metadata { app, resource, surface: "miniapp" } — the agent never
 * learns mini-apps as a special subsystem, it just acts and the view
 * refetches its normal agent-backed state on completion.
 *
 * Owner sessions only: guests and anonymous visitors have no path here.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { createRun, MAIN_SESSION } from "@/lib/hermes/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    app?: string;
    resource?: string;
    text?: string;
  };
  const app = body.app ?? "";
  const resource = body.resource ?? "default";
  const text = (body.text ?? "").trim();
  if (!app || !text || text.length > 4000) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  // The owner's store session (path "/", mini origin) is the credential —
  // per-app cookies are path-scoped to their app and never reach /api.
  // Guests and anonymous visitors have no store session, so no path here.
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const supabase = serviceClient();
  const box = await ensureBoxAwake(supabase, userId);
  const run = await createRun(box.target, {
    input: text,
    sessionId: MAIN_SESSION,
    metadata: { app, resource, surface: "miniapp" },
  });
  await supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: "web",
  });
  await armStopAfter(supabase, userId);
  return NextResponse.json({ ok: true, run_id: run.run_id });
}
