/**
 * Runtime API (goal-create-v11 §11.3): append a typed action to the app's
 * `actions.json` for the owner's agent — the same log the MA3 Apps API
 * writes, so the agent sees a file, not a subsystem, and no gate is bypassed.
 * Only names the running version's manifest declares; guests only the
 * guest-safe ones. 16 KiB. The append itself is leased (actionLog.ts) so a
 * concurrent Apps API write can't drop it.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  ActionLogBusyError,
  appendActionLogEntry,
} from "@/lib/miniapps/actionLog";
import {
  ACTION_NAME_RE,
  ACTIONS_MAX_BYTES,
  declaredActions,
  handleRuntime,
  parseJson,
  readBoundedText,
  RuntimeApiError,
  runtimeJson,
  type RuntimeCall,
} from "@/lib/functions/runtimeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  return handleRuntime(request, supabase, async (call: RuntimeCall) => {
    const body = parseJson(await readBoundedText(request, ACTIONS_MAX_BYTES));
    const record =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const action = typeof record["action"] === "string" ? record["action"] : "";
    if (!ACTION_NAME_RE.test(action)) throw new RuntimeApiError(400, "invalid_action");
    const declared = await declaredActions(call.principal.slug, call.version);
    if (!declared.actions.includes(action)) {
      throw new RuntimeApiError(403, "undeclared_action");
    }
    if (call.role !== "owner" && !declared.guestActions.includes(action)) {
      throw new RuntimeApiError(403, "guest_forbidden");
    }
    const { userId, slug } = call.principal;
    try {
      await appendActionLogEntry(supabase, userId, slug, {
        action,
        payload: record["payload"] ?? null,
        role: call.role,
        at: new Date().toISOString(),
        source: "functions",
      });
    } catch (error) {
      if (error instanceof ActionLogBusyError) {
        throw new RuntimeApiError(503, "state_busy");
      }
      throw error;
    }
    return runtimeJson({ ok: true });
  });
}
