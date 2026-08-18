/**
 * V6 shopping gates, called by the user's own Hermes (gateway-token auth,
 * same pattern as /api/browser/social). Actions:
 *  - GET: offer eligibility — the owner's card items (metadata only) and the
 *    hosts with a purchase_review already open. The agent offers the fill
 *    ONLY when at least one card exists and the site has no open review.
 *  - propose: file the purchase_review decision (offer-the-fill). The
 *    control plane enforces owner-initiation, card existence, and the
 *    one-open-review-per-site rule — never the prompt (C20).
 *  - report: value-free per-field-group audit lines after the fields were
 *    typed box-side (field GROUP NAMES only — a value can never fit).
 *  - outcome: post-purchase confirmation → agent_runs outcome
 *    ('purchase_completed' | 'purchase_abandoned').
 * On iMessage-originated turns, propose also sends the owner a live vault
 * card (cooldown-governed) so approve/deny works in place.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { appendVaultEvent } from "@/lib/vault/client";
import {
  proposePurchaseReview,
  recordPurchaseOutcome,
  PurchaseError,
  PURCHASE_OUTCOMES,
  type PurchaseOutcome,
} from "@/lib/vault/purchase";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
// The card-field groups `air-vault type` can deliver — a closed set, so a
// report line can never smuggle a value into the audit trail (C18).
const FIELD_GROUPS = new Set(["number", "expiry", "cvv", "zip"]);

async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? (box.user_id as string) : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [{ data: cards }, { data: open }] = await Promise.all([
    supabase
      .from("vault_items")
      .select("id, name, masked")
      .eq("user_id", userId)
      .eq("kind", "card")
      .is("deleted_at", null),
    supabase
      .from("decisions")
      .select("payload")
      .eq("user_id", userId)
      .eq("kind", "purchase_review")
      .eq("status", "pending"),
  ]);
  const openHosts = (open ?? [])
    .map((row) => {
      const payload = row.payload as { host?: unknown } | null;
      return typeof payload?.host === "string" ? payload.host : null;
    })
    .filter((host): host is string => host !== null);
  return NextResponse.json(
    { cards: cards ?? [], open_review_hosts: openHosts },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Best-effort iMessage live card so approve/deny works in place. */
async function sendPurchaseCard(
  supabase: SupabaseClient,
  userId: string
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
    if (!claim) return; // cooldown — the Needs-you queue still has it
    await sendMiniAppCard(
      String(dest.space_id),
      String(dest.phone),
      userId,
      "vault",
      "default"
    );
  } catch (error) {
    await claim?.release().catch(() => undefined);
    console.error(
      JSON.stringify({
        msg: "purchase card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    host?: unknown;
    item_id?: unknown;
    summary?: unknown;
    amount_usd?: unknown;
    field_groups?: unknown;
    outcome?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "propose") {
    const host = typeof body?.host === "string" ? body.host : "";
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const summary =
      typeof body?.summary === "string" ? body.summary.trim() : "";
    const amountUsd =
      typeof body?.amount_usd === "number" ? body.amount_usd : NaN;
    if (!host || !ID_RE.test(itemId) || !summary || summary.length > 2000) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    try {
      const result = await proposePurchaseReview(supabase, userId, {
        host,
        itemId,
        summary,
        amountUsd,
      });
      await sendPurchaseCard(supabase, userId);
      return NextResponse.json({
        ok: true,
        decision_id: result.decisionId,
        amount_band: result.amountBand,
      });
    } catch (error) {
      if (error instanceof PurchaseError) {
        return NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.status }
        );
      }
      throw error;
    }
  }

  if (action === "report") {
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const host = typeof body?.host === "string" ? body.host : "";
    const groups = Array.isArray(body?.field_groups)
      ? body.field_groups.filter(
          (g): g is string => typeof g === "string" && FIELD_GROUPS.has(g)
        )
      : [];
    if (!ID_RE.test(itemId) || groups.length === 0) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    // One value-free audit line per typed field group (§V6 receipts).
    for (const group of groups) {
      await appendVaultEvent(
        supabase,
        userId,
        "fill_approved",
        itemId,
        host ? `${group}@${host}` : group
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "outcome") {
    const outcome = typeof body?.outcome === "string" ? body.outcome : "";
    if (!(PURCHASE_OUTCOMES as readonly string[]).includes(outcome)) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    await recordPurchaseOutcome(supabase, userId, outcome as PurchaseOutcome);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid request" }, { status: 400 });
}
