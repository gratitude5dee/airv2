/**
 * V11 §11.4 secrets — owner store session only. `POST {slug|app, name,
 * value}` sets a `secret_text` binding on both the live and draft scripts;
 * `DELETE {slug|app, name}` removes it. Postgres keeps names and set-at
 * dates only; the value is consumed by the vendor call and appears in no
 * log, finding, bundle or Box file. Adding or removing a name changes what
 * the owner approved, so the pending decision is refreshed.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { fileBackendDecision } from "@/lib/functions/backend";
import {
  appOf,
  callerOf,
  functionsErrorResponse,
  jsonBody,
} from "@/lib/functions/createRoute";
import { removeSecret, setSecret, summarizeSecrets } from "@/lib/functions/secrets";
import { recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, false);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  const name = typeof body["name"] === "string" ? body["name"] : "";
  const value = typeof body["value"] === "string" ? body["value"] : "";
  try {
    const app = await appOf(supabase, caller.userId, body);
    const row = await setSecret(supabase, app, name, value);
    const decision = await fileBackendDecision(supabase, app, row);
    await recordOpsEvent(supabase, "fn_secret", caller.userId, `${app.slug}:set`);
    return NextResponse.json({
      ok: true,
      secrets: summarizeSecrets(row),
      decision_id: decision,
    });
  } catch (error) {
    return functionsErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, false);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  const name = typeof body["name"] === "string" ? body["name"] : "";
  try {
    const app = await appOf(supabase, caller.userId, body);
    const row = await removeSecret(supabase, app, name);
    const decision = await fileBackendDecision(supabase, app, row);
    await recordOpsEvent(supabase, "fn_secret", caller.userId, `${app.slug}:removed`);
    return NextResponse.json({
      ok: true,
      secrets: summarizeSecrets(row),
      decision_id: decision,
    });
  } catch (error) {
    return functionsErrorResponse(error);
  }
}
