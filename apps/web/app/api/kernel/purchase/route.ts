/**
 * Kernel purchase lane (box-auth, GATEWAY_TOKEN bearer like
 * /api/browser/purchase). The box proposes, polls, submits, and reconciles;
 * every verification, decision, authorize, and provider URL happens
 * control-plane-side (C26–C30).
 *  - propose: backend-verified quote → frozen kernel_purchases row →
 *    purchase_review decision → iMessage approval card (owner only).
 *  - poll: status + aliases ONLY while the purchase is ready and
 *    un-submitted — the one moment card digits are allowed to move.
 *  - submit: submit-once marker; a second submit is a 409, never a re-try.
 *  - outcome: item-event reconciliation; ambiguity lands on
 *    unknown_outcome, not another attempt.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { KernelError, kernelAvailable } from "@/lib/kernel/client";
import {
  getKernelPurchase,
  pollKernelPurchase,
  proposeKernelPurchase,
  reconcileKernelPurchase,
  reportKernelSubmit,
} from "@/lib/kernel/purchases";
import { PurchaseError } from "@/lib/vault/purchase";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { guardResponse, requireBox } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;
const PURCHASE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}


function mapError(error: unknown): NextResponse | null {
  if (error instanceof PurchaseError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  if (error instanceof KernelError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  return null;
}

function kernelGate(): NextResponse | null {
  if (!kernelAvailable() || !env.kernelVaultsEnabled()) {
    return json(
      {
        error: "kernel_vaults_disabled",
        message: "Kernel card payments are not enabled",
      },
      403
    );
  }
  return null;
}

async function sendKernelPurchaseCard(
  supabase: SupabaseClient,
  userId: string,
  review: { band: string; host: string; approvalUrl: string }
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
        caption: "Approve payment",
        subcaption: `${review.band} on ${review.host}`,
        summary: `Approve payment — ${review.band} on ${review.host}. Review and approve: ${review.approvalUrl}`,
      }
    );
  } catch (error) {
    await claim?.release().catch(() => undefined);
    console.error(
      JSON.stringify({
        msg: "kernel purchase card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;const gated = kernelGate();
  if (gated) return gated;
  const purchaseId = request.nextUrl.searchParams.get("purchase_id") ?? "";
  if (!PURCHASE_ID_RE.test(purchaseId)) {
    return json({ error: "invalid request" }, 400);
  }
  try {
    const result = await pollKernelPurchase(supabase, box.userId, purchaseId);
    return json({ ok: true, ...result });
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;const gated = kernelGate();
  if (gated) return gated;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    kernel_session_id?: unknown;
    task_id?: unknown;
    purchase_id?: unknown;
    purchase?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "propose") {
    const purchase =
      body?.purchase && typeof body.purchase === "object"
        ? (body.purchase as Record<string, unknown>)
        : null;
    if (!purchase) return json({ error: "invalid request" }, 400);
    try {
      const result = await proposeKernelPurchase(supabase, box.userId, {
        kernel_session_id:
          typeof body?.kernel_session_id === "string"
            ? body.kernel_session_id
            : null,
        task_id:
          typeof body?.task_id === "string" ? body.task_id.slice(0, 200) : null,
        purchase,
      });
      const staged = await getKernelPurchase(supabase, box.userId, result.purchaseId);
      const host = staged ? new URL(staged.purchase.merchant_url).hostname : "";
      await sendKernelPurchaseCard(supabase, box.userId, {
        band: result.amountBand,
        host,
        approvalUrl: result.approvalUrl,
      });
      return json({
        ok: true,
        purchase_id: result.purchaseId,
        decision_id: result.decisionId,
        amount_band: result.amountBand,
      });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  const purchaseId =
    typeof body?.purchase_id === "string" ? body.purchase_id : "";
  if (!PURCHASE_ID_RE.test(purchaseId)) {
    return json({ error: "invalid request" }, 400);
  }

  if (action === "poll") {
    try {
      const result = await pollKernelPurchase(supabase, box.userId, purchaseId);
      return json({ ok: true, ...result });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  if (action === "submit") {
    try {
      const purchase = await reportKernelSubmit(supabase, box.userId, purchaseId);
      return json({ ok: true, status: purchase.status });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  if (action === "outcome") {
    try {
      const result = await reconcileKernelPurchase(
        supabase,
        box.userId,
        purchaseId
      );
      return json({ ok: true, status: result.status });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  return json({ error: "invalid request" }, 400);
}
