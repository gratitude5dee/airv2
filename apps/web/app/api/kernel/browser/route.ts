/**
 * Kernel browser lane, called by the user's own Hermes (gateway-token auth,
 * same pattern as /api/browser/purchase). The box never touches Kernel: this
 * route is the only Kernel client anywhere near the agent (C26).
 *  - POST action=create: one cloud session. The cdp_ws_url is returned once
 *    over TLS — the box stores it in ~/.hermes/kernel/session.json (0600)
 *    and the relay uses it; it is never in argv, logs, or Postgres (C27).
 *  - POST action=end / GET ?session_id: lifecycle + the human-control flag
 *    the CDP guard polls (fail-closed while an owner lease is live, C31).
 * All responses are Cache-Control: no-store; a query failure is a 502, never
 * an empty success the agent could misread as "no sessions".
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import {
  KernelError,
  kernelAvailable,
} from "@/lib/kernel/client";
import {
  createKernelSession,
  endKernelSession,
  getKernelSession,
  isKernelSessionId,
  kernelHumanControlActive,
  type CreateKernelSessionInput,
} from "@/lib/kernel/browsers";
import { ensureKernelVault } from "@/lib/kernel/vaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function callingBox(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<{ userId: string; boxId: string } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id, provider_box_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return null;
  return {
    userId: box.user_id as string,
    boxId: box.provider_box_id as string,
  };
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function kernelStatus(
  session: Awaited<ReturnType<typeof getKernelSession>>
): { active: boolean; human_control: boolean; status: string | null } {
  if (!session) return { active: false, human_control: false, status: null };
  return {
    active: session.status === "active",
    human_control: kernelHumanControlActive(session),
    status: session.status,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) return json({ error: "unauthorized" }, 401);
  const params = request.nextUrl.searchParams;

  // Guard poll: is any Kernel session of this user under owner control?
  // With session_id it's scoped; without it the lease guard fails closed on
  // ANY live Kernel lease — the box can't distinguish which cloud browser
  // the owner is driving.
  if (params.get("active_human_control") === "1") {
    const sessionId = params.get("session_id") ?? "";
    if (isKernelSessionId(sessionId)) {
      const session = await getKernelSession(supabase, box.userId, sessionId);
      const active = session ? kernelHumanControlActive(session) : false;
      return json({ active, human_control: active });
    }
    const now = new Date().toISOString();
    const { data: leases, error } = await supabase
      .from("kernel_sessions")
      .select("id")
      .eq("user_id", box.userId)
      .eq("status", "active")
      .is("human_control_returned_at", null)
      .gt("human_control_expires_at", now)
      .limit(1);
    if (error) {
      return json({ error: "query_failed", message: error.message }, 502);
    }
    const active = (leases ?? []).length > 0;
    return json({ active, human_control: active });
  }

  const sessionId = params.get("session_id") ?? "";
  if (!isKernelSessionId(sessionId)) {
    return json({ error: "invalid request" }, 400);
  }
  try {
    const session = await getKernelSession(supabase, box.userId, sessionId);
    return json({ ok: true, ...kernelStatus(session) });
  } catch (error) {
    if (error instanceof KernelError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) return json({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    purpose?: unknown;
    task_id?: unknown;
    start_url?: unknown;
    stealth?: unknown;
    save_profile?: unknown;
    attach_vault?: unknown;
    timeout_seconds?: unknown;
    kiosk?: unknown;
    session_id?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "create") {
    if (!kernelAvailable()) {
      return json(
        {
          error: "kernel_unavailable",
          message: env.kernelEnabled()
            ? "Kernel browser lane is not configured"
            : "Kernel browser lane is not enabled",
        },
        env.kernelEnabled() ? 503 : 403
      );
    }
    const purpose =
      body?.purpose === "checkout" || body?.purpose === "watch"
        ? body.purpose
        : "errand";
    const input: CreateKernelSessionInput = {
      purpose,
      taskId:
        typeof body?.task_id === "string" && body.task_id.trim()
          ? body.task_id.trim().slice(0, 200)
          : null,
      startUrl:
        typeof body?.start_url === "string" ? body.start_url : undefined,
      stealth: body?.stealth === undefined ? undefined : body.stealth === true,
      // Box callers cannot opt themselves into persistent login state. An
      // owner-facing keep-login control can enable this in a later session.
      saveProfile: false,
      timeoutSeconds:
        typeof body?.timeout_seconds === "number" ? body.timeout_seconds : undefined,
      kiosk: body?.kiosk === true,
    };
    if (body?.attach_vault === true) {
      if (!env.kernelVaultsEnabled()) {
        return json(
          { error: "kernel_vaults_disabled", message: "Kernel vaults are not enabled" },
          403
        );
      }
      const vault = await ensureKernelVault(supabase, box.userId);
      input.vaultId = vault.vault_id;
    }
    try {
      const result = await createKernelSession(supabase, box.userId, input);
      return json({
        ok: true,
        session_id: result.session.id,
        kernel_session_id: result.session.kernel_session_id,
        cdp_url: result.cdpUrl,
        live_view_available: result.liveViewUrl !== null,
      });
    } catch (error) {
      if (error instanceof KernelError) {
        return json(
          { error: error.code, message: error.message },
          error.status
        );
      }
      throw error;
    }
  }

  if (action === "end") {
    const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
    if (!isKernelSessionId(sessionId)) {
      return json({ error: "invalid request" }, 400);
    }
    try {
      const session = await endKernelSession(supabase, box.userId, sessionId);
      if (!session) return json({ error: "not_found" }, 404);
      return json({ ok: true, status: session.status });
    } catch (error) {
      if (error instanceof KernelError) {
        return json({ error: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }

  return json({ error: "invalid request" }, 400);
}
