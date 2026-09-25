/**
 * Live sign-in code lane (box-auth, gateway_token bearer like
 * /api/browser/purchase). When a site sends a one-time code to the owner's
 * phone/email instead of using a TOTP seed, the box files a request, texts
 * the owner a vault miniapp card, then polls until the owner pastes the
 * code, denies, or the request expires (4 min). The code is returned to the
 * box exactly once — an atomic pop wipes it — and never lands in
 * decisions.payload or logs.
 *
 *  - request: create otp_requests row + otp_request decision + iMessage card.
 *  - poll:    pending | expired | denied | resolved+code (once) | popped.
 *  - cancel:  box gives up → decision dismissed, row closed.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { registerVaultValue } from "@/lib/vault/scrub";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" } as const;
const OTP_TTL_MS = 4 * 60 * 1000;
const REQUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST_RE = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;
const RUN_ID_RE = /^[\w.-]{1,200}$/;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function callingBox(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? { userId: box.user_id as string } : null;
}

async function sendOtpCard(
  supabase: SupabaseClient,
  userId: string,
  host: string
): Promise<void> {
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!dest?.space_id || !dest?.phone) return;
  let claim: CardClaim | undefined;
  try {
    claim = await claimCardSend(supabase, userId, "vault");
    if (!claim) return;
    await sendMiniAppCard(
      supabase,
      String(dest.space_id),
      String(dest.phone),
      userId,
      "vault",
      "default",
      {
        caption: "Code needed",
        subcaption: `${host} sent you a sign-in code — paste it here`,
        summary: `Code needed — ${host} sent you a sign-in code. Open the card and paste it to hand it to your agent (4 min).`,
      }
    );
  } catch (error) {
    await claim?.release().catch(() => undefined);
    log.error("otp card send failed", {user_id: userId,
        error: error instanceof Error ? error.message : "unknown",});
  }
}

async function requestOtp(
  supabase: SupabaseClient,
  userId: string,
  host: string,
  runId: string | null
): Promise<{ requestId: string; decisionId: string; expiresInS: number }> {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const { data: row, error } = await supabase
    .from("otp_requests")
    .insert({ user_id: userId, host, run_id: runId, expires_at: expiresAt })
    .select("id")
    .single();
  if (error || !row) {
    throw new Error(
      `otp_requests insert failed: ${error?.message ?? "unknown"}`
    );
  }
  const requestId = row.id as string;
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "otp_request",
      ref: requestId,
      label: `Sign-in code needed for ${host}`,
      payload: { host },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    await supabase
      .from("otp_requests")
      .delete()
      .eq("id", requestId)
      .eq("user_id", userId);
    throw new Error(
      `decisions insert failed: ${decisionError?.message ?? "unknown"}`
    );
  }
  await supabase
    .from("otp_requests")
    .update({ decision_id: decision.id as string })
    .eq("id", requestId);
  return {
    requestId,
    decisionId: decision.id as string,
    expiresInS: OTP_TTL_MS / 1000,
  };
}

async function pollOtp(
  supabase: SupabaseClient,
  userId: string,
  requestId: string
): Promise<{ status: string; code?: string }> {
  const { data: row } = await supabase
    .from("otp_requests")
    .select("id, status, expires_at")
    .eq("id", requestId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { status: "not_found" };
  const status = row.status as string;
  const expiresAt = row.expires_at as string;
  if (status === "pending" && new Date(expiresAt).getTime() <= Date.now()) {
    await supabase
      .from("otp_requests")
      .update({ status: "expired" })
      .eq("id", requestId)
      .eq("status", "pending");
    return { status: "expired" };
  }
  if (status !== "resolved") {
    return { status };
  }
  // Exactly-once pop: whoever wins this update owns the code; it is wiped in
  // the same write so a retry or second caller can never re-read it.
  const { data: claimed } = await supabase
    .from("otp_requests")
    .update({
      status: "popped",
      popped_at: new Date().toISOString(),
      code: null,
    })
    .eq("id", requestId)
    .eq("user_id", userId)
    .eq("status", "resolved")
    .select("code")
    .maybeSingle();
  if (!claimed?.code) {
    return { status: "popped" };
  }
  const code = claimed.code as string;
  registerVaultValue(code);
  return { status: "resolved", code };
}

async function cancelOtp(
  supabase: SupabaseClient,
  userId: string,
  requestId: string
): Promise<{ status: string }> {
  const { data: row } = await supabase
    .from("otp_requests")
    .update({ status: "denied", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("decision_id")
    .maybeSingle();
  if (row?.decision_id) {
    await supabase
      .from("decisions")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", row.decision_id as string);
  }
  return { status: row ? "denied" : "not_pending" };
}

function validRequestId(raw: unknown): string | null {
  return typeof raw === "string" && REQUEST_ID_RE.test(raw) ? raw : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) return json({ error: "unauthorized" }, 401);
  const requestId = validRequestId(
    request.nextUrl.searchParams.get("request_id")
  );
  if (!requestId) return json({ error: "invalid request" }, 400);
  const result = await pollOtp(supabase, box.userId, requestId);
  return json({ ok: true, ...result });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) return json({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    host?: unknown;
    run_id?: unknown;
    request_id?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "request") {
    const host =
      typeof body?.host === "string" && HOST_RE.test(body.host.trim())
        ? body.host.trim().toLowerCase()
        : null;
    if (!host) return json({ error: "invalid request" }, 400);
    const runId =
      typeof body?.run_id === "string" && RUN_ID_RE.test(body.run_id)
        ? body.run_id
        : null;
    try {
      const result = await requestOtp(supabase, box.userId, host, runId);
      await sendOtpCard(supabase, box.userId, host);
      return json({
        ok: true,
        request_id: result.requestId,
        decision_id: result.decisionId,
        expires_in_s: result.expiresInS,
      });
    } catch (error) {
      return json(
        {
          error: "otp_store_error",
          message: error instanceof Error ? error.message : "unknown",
        },
        500
      );
    }
  }

  const requestId = validRequestId(body?.request_id);
  if (!requestId) return json({ error: "invalid request" }, 400);

  if (action === "poll") {
    const result = await pollOtp(supabase, box.userId, requestId);
    return json({ ok: true, ...result });
  }

  if (action === "cancel") {
    const result = await cancelOtp(supabase, box.userId, requestId);
    return json({ ok: true, ...result });
  }

  return json({ error: "invalid request" }, 400);
}
