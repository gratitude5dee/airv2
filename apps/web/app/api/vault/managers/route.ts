/**
 * V2 BYO managers (C23). GET returns the parsed status mirror only. POST
 * enable transports the bootstrap token to the box .env / config.yaml and
 * never persists or echoes it; POST disable removes the binding. The token
 * exists in this process only for the life of the request.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import {
  disableManager,
  enableManager,
  listManagers,
  ManagerInputError,
  MANAGER_IDS,
  refreshManager,
  type ManagerId,
} from "@/lib/vault/managers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const managers = await listManagers(supabase, session.userId);
    return NextResponse.json({ managers }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "list failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    manager?: string;
    token?: string;
    project_id?: string;
    helper_command?: string;
    mappings?: Record<string, string>;
  } | null;
  const manager = body?.manager as ManagerId | undefined;
  const action = body?.action;
  if (
    !manager ||
    !MANAGER_IDS.includes(manager) ||
    !action ||
    !["enable", "disable", "refresh"].includes(action)
  ) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    let managers;
    try {
      if (action === "enable") {
        managers = await enableManager(supabase, session.userId, box.boxId, {
          manager,
          token: body?.token,
          project_id: body?.project_id,
          helper_command: body?.helper_command,
          mappings: body?.mappings,
        });
      } else if (action === "disable") {
        managers = await disableManager(supabase, session.userId, box.boxId, manager);
      } else {
        managers = await refreshManager(supabase, session.userId, box.boxId, manager);
      }
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }
    return NextResponse.json({ managers }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429 }
      );
    }
    if (error instanceof ManagerInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(
      JSON.stringify({
        msg: "vault manager action failed",
        user_id: session.userId,
        manager,
        action,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "manager action failed" }, { status: 502 });
  }
}
