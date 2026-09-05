/**
 * Runtime API (goal-create-v11 §11.3): append a typed action to the app's
 * `actions.json` for the owner's agent — the same log the MA3 Apps API
 * writes, so the agent sees a file, not a subsystem, and no gate is bypassed.
 * Only names the running version's manifest declares; guests only the
 * guest-safe ones. 16 KiB.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { readAppState, writeAppState } from "@/lib/miniapps/store";
import {
  ACTION_LOG_MAX_ENTRIES,
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

interface ActionEntry {
  action: string;
  payload: unknown;
  role: string;
  at: string;
  source: "functions";
}

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
    const existing = await readAppState(supabase, userId, slug, "actions");
    const entries: ActionEntry[] = Array.isArray(existing)
      ? (existing as ActionEntry[])
      : [];
    entries.push({
      action,
      payload: record["payload"] ?? null,
      role: call.role,
      at: new Date().toISOString(),
      source: "functions",
    });
    await writeAppState(
      supabase,
      userId,
      slug,
      "actions",
      entries.slice(-ACTION_LOG_MAX_ENTRIES)
    );
    return runtimeJson({ ok: true });
  });
}
