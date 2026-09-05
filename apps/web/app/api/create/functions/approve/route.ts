/**
 * V11 §4.1 — the Functions tab's "Enable backend" / "Approve changes". Owner
 * store session only (never the Box). Resolves the pending `miniapp_backend`
 * decision the same way the Needs-you card does and stamps the approved
 * manifest; `action: "dismiss"` just closes the card.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  approvalDeployed,
  approveBackendForOwner,
  resolveBackendDecisionRow,
} from "@/lib/functions/approval";
import { loadFunctions } from "@/lib/functions/backend";
import {
  appOf,
  callerOf,
  functionsErrorResponse,
  jsonBody,
} from "@/lib/functions/createRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, false);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  const action = body["action"] === "dismiss" ? "dismissed" : "approved";
  try {
    const app = await appOf(supabase, caller.userId, body);
    const row = await loadFunctions(supabase, app.id);
    if (!row || !row.declared) {
      return NextResponse.json({ error: "nothing declared to approve" }, { status: 409 });
    }
    await resolveBackendDecisionRow(supabase, caller.userId, app.slug, action);
    if (action === "dismissed") return NextResponse.json({ ok: true, dismissed: true });
    if (approvalDeployed(row)) {
      return NextResponse.json({ ok: true, unchanged: true, status: row.status });
    }
    const approved = await approveBackendForOwner(supabase, caller.userId, app.slug);
    return NextResponse.json({
      ok: true,
      status: approved?.status ?? row.status,
      approved: approved?.approved_manifest ?? null,
    });
  } catch (error) {
    return functionsErrorResponse(error);
  }
}
