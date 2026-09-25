/**
 * Kernel vault lane for /shop, box-auth (GATEWAY_TOKEN bearer like
 * /api/browser/purchase). Returns value-free item state only — masks,
 * providers, states. Provider action URLs never leave this route: they are
 * staged into kernel_actions and reach the owner via an iMessage card, not
 * the agent transcript (C27/C28).
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { KernelError, kernelAvailable } from "@/lib/kernel/client";
import {
  ensureKernelVault,
  listKernelVaultItems,
  syncKernelVaultItems,
} from "@/lib/kernel/vaults";
import { stageKernelAction } from "@/lib/kernel/actions";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { ACTION_LABELS } from "@/lib/kernel/actions";
import { guardResponse, requireBox } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}


async function vaultEnabledOrThrow(): Promise<void> {
  if (!kernelAvailable() || !env.kernelVaultsEnabled()) {
    throw new KernelError(
      "kernel_vaults_disabled",
      "Kernel vault payments are not enabled",
      403
    );
  }
}

/**
 * A pending provider action goes to the OWNER only, as an iMessage card
 * carrying the single-use presenter link. The box learns only that an action
 * is pending — never the URL.
 */
async function notifyOwnerOfAction(
  supabase: SupabaseClient,
  userId: string,
  actionName: string,
  actionUrl: string
): Promise<void> {
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!dest?.space_id || !dest?.phone) return;
  let claim: CardClaim | undefined;
  try {
    claim = await claimCardSend(supabase, userId, "watch");
    if (!claim) return;
    const label = ACTION_LABELS[actionName] ?? "finish a payment step";
    await sendMiniAppCard(
      supabase,
      String(dest.space_id),
      String(dest.phone),
      userId,
      "watch",
      "default",
      {
        caption: "Payment setup",
        subcaption: `Tap to ${label}`,
        summary: `Payment setup — tap to ${label}: ${actionUrl}`,
      }
    );
  } catch (error) {
    await claim?.release().catch(() => undefined);
    console.error(
      JSON.stringify({
        msg: "kernel action card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;try {
    await vaultEnabledOrThrow();
  } catch (error) {
    if (error instanceof KernelError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    throw error;
  }
  const { data: vaultRow } = await supabase
    .from("kernel_vaults")
    .select("user_id")
    .eq("user_id", box.userId)
    .maybeSingle();
  const items = vaultRow ? await listKernelVaultItems(supabase, box.userId) : [];
  return json({
    ok: true,
    enabled: true,
    provisioned: vaultRow !== null,
    items: items.map((item) => ({
      item_key: item.item_key,
      provider: item.provider,
      kind: item.kind,
      state: item.state,
      brand: item.brand,
      last4: item.last4,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    await vaultEnabledOrThrow();
  } catch (error) {
    if (error instanceof KernelError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    throw error;
  }

  if (action === "enroll" || action === "sync") {
    try {
      const vault = await ensureKernelVault(supabase, box.userId);
      const { action: pending } = await syncKernelVaultItems(
        supabase,
        box.userId,
        vault
      );
      let actionRequired = false;
      if (pending) {
        const staged = await stageKernelAction(supabase, box.userId, pending, null);
        actionRequired = true;
        await notifyOwnerOfAction(
          supabase,
          box.userId,
          pending.name,
          staged.url
        );
      }
      const items = await listKernelVaultItems(supabase, box.userId);
      return json({
        ok: true,
        pending_action: actionRequired,
        items: items.map((item) => ({
          item_key: item.item_key,
          provider: item.provider,
          kind: item.kind,
          state: item.state,
          brand: item.brand,
          last4: item.last4,
        })),
      });
    } catch (error) {
      if (error instanceof KernelError) {
        return json({ error: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }

  return json({ error: "invalid request" }, 400);
}
