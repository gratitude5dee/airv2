/**
 * "Needs you" queue (M6 task 2): list pending decisions; resolve one.
 * Approving an email_draft sends it via the control-plane key — the only
 * send path that exists (C10).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { sendDraft } from "@/lib/agentmail/client";
import { batchApproveEmailDrafts } from "@/lib/decisions/batch";
import {
  approveAdWrite,
  dismissAdWrite,
  AdWriteError,
} from "@/lib/ads/approvals";
import { approveContentPlan, dismissContentPlan } from "@/lib/publish/propose";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { approveRun, HermesApiError } from "@/lib/hermes/client";
import { approveInboxEvent, dismissInboxEvent } from "@/lib/calendar/store";
import { resolvePurchaseReview, PurchaseError } from "@/lib/vault/purchase";
import { applyPatchOnBox, sanitizePatch } from "@/lib/crm/store";
import {
  denyTransfer,
  executeTransfer,
  findPendingTransfer,
  WalletSendError,
  WalletSubmitUnknownError,
} from "@/lib/wallet/send";
import {
  clampToWakingHours,
  nextRunAt,
  SCHEDULE_COLUMNS,
  parseAgentSchedule,
} from "@/lib/calendar/schedule";
import {
  approvePaymentRequest,
  dismissPaymentRequest,
} from "@/lib/commerce/paymentRequests";
import { applyCatalogPublish } from "@/lib/commerce/catalog";
import { CommerceError } from "@/lib/commerce/merchants";
import { env } from "@/lib/env";
import { updateMiniAppCard } from "@/lib/miniapps/cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// content_plan approval wakes the user's box (ensureBoxAwake), which can
// exceed the default function timeout.
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  if (request.nextUrl.searchParams.get("status") === "resolved") {
    // V8: resolved history — the last 30 days of receipts (C22), so an
    // approval or dismissal is always findable after the fact.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("decisions")
      .select(
        "id, kind, platform, sender, ref, label, status, created_at, resolved_at, payload",
      )
      .eq("user_id", userId)
      .in("status", ["approved", "dismissed"])
      .gte("resolved_at", since)
      .order("resolved_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ decisions: data ?? [] });
  }
  const { data } = await supabase
    .from("decisions")
    .select(
      "id, kind, platform, sender, ref, label, status, created_at, payload",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ decisions: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    ids?: unknown;
    action?: string;
    method?: string;
  };
  // V8: batch approval, email_draft only — each approval is a pure
  // control-plane send (C10), so no box wake or run resume gets skipped
  // by batching. Every other kind resolves one at a time below.
  if (Array.isArray(body.ids)) {
    if (
      body.action !== "approve" ||
      !body.ids.every((value) => typeof value === "string")
    ) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const result = await batchApproveEmailDrafts(
      serviceClient(),
      userId,
      body.ids as string[],
    );
    return NextResponse.json(result);
  }
  if (!body.id || !["approve", "dismiss"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status, payload")
    .eq("id", body.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!decision || decision.status !== "pending") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (
    body.action === "approve" &&
    decision.kind === "email_draft" &&
    decision.ref
  ) {
    const { data: address } = await supabase
      .from("agent_addresses")
      .select("agentmail_inbox_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .is("retired_at", null)
      .maybeSingle();
    if (!address?.agentmail_inbox_id) {
      return NextResponse.json({ error: "no inbox" }, { status: 409 });
    }
    await sendDraft(
      address.agentmail_inbox_id as string,
      decision.ref as string,
      decision.id as string,
    );
  }

  if (decision.kind === "ad_write" && decision.ref) {
    // CC0: the decision is the gate. Approval runs the ceiling check and
    // executes (or releases) the write; a refusal leaves it pending.
    try {
      if (body.action === "approve") {
        await approveAdWrite(supabase, userId, decision.ref as string);
      } else {
        await dismissAdWrite(supabase, userId, decision.ref as string);
      }
    } catch (error) {
      if (error instanceof AdWriteError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      return NextResponse.json({ error: "ad write failed" }, { status: 502 });
    }
  }

  if (decision.kind === "content_plan" && decision.ref) {
    // CM7 task 4: the plan is a proposal until this moment — approval flips
    // its slots to scheduled and briefs the agent; dismissal cancels them.
    if (body.action === "approve") {
      await approveContentPlan(
        supabase,
        userId,
        decision.ref as string,
        (decision.payload ?? null) as Record<string, unknown> | null,
      );
    } else {
      await dismissContentPlan(supabase, userId, decision.ref as string);
    }
  }

  if (decision.kind === "calendar_add" && decision.ref) {
    // V3: approve confirms the pending event in the box store; dismiss
    // tombstones the invite so a later re-sync cannot resurrect it.
    try {
      const box = await ensureBoxAwake(supabase, userId);
      if (body.action === "approve") {
        await approveInboxEvent(box.boxId, decision.ref as string);
      } else {
        await dismissInboxEvent(box.boxId, decision.ref as string);
      }
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  if (
    decision.kind === "social_post" &&
    !decision.ref &&
    body.action === "approve"
  ) {
    // The proposal carried no paused-run reference, so there is nothing to
    // resume — approving would mark the card done while nothing posts.
    // Refuse so the card stays actionable; dismiss can still clear it.
    return NextResponse.json(
      { error: "the agent is no longer waiting on this — dismiss it instead" },
      { status: 409 },
    );
  }

  if (decision.kind === "social_post" && decision.ref) {
    // V5: the agent's run is paused on this decision. Approve resumes it via
    // /v1/runs/{id}/approval; dismiss resumes it with approved=false so the
    // agent is told no. Either way the card stays in Needs-you history.
    try {
      const box = await ensureBoxAwake(supabase, userId);
      await approveRun(
        box.target,
        decision.ref as string,
        body.action === "approve",
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "social_post approval relay failed",
          user_id: userId,
          action: body.action,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      // The referenced run may have already ended (the ref is the newest open
      // run at proposal time). A gone run can't post, so a dismiss may finish
      // anyway — the card must be clearable. Everything else (box wake
      // failures, transport errors, Hermes 5xx) fails loudly for both actions:
      // the run may still be paused, and this card is its only resume path.
      const runGone =
        error instanceof HermesApiError &&
        (error.status === 404 || error.status === 409 || error.status === 410);
      if (body.action === "approve" || !runGone) {
        return NextResponse.json(
          { error: "could not reach the agent — try again" },
          { status: 502 },
        );
      }
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  if (decision.kind === "purchase_review") {
    // V6 (C20): approving mints + redeems the single-use fill ticket,
    // delivers it to the box, and resumes the paused run; denying writes
    // the fill_denied receipt and resumes the run with approved=false.
    try {
      // Denying needs no box — the fill_denied receipt must always be
      // writable, even while the box is start-limited; the run resume on
      // deny is already best-effort inside resolvePurchaseReview.
      // Link selection mints no ticket, so like deny it must resolve even
      // while the box is start-limited (its run resume is best-effort too).
      const box =
        body.action === "approve" && body.method !== "link"
          ? await ensureBoxAwake(supabase, userId)
          : await ensureBoxAwake(supabase, userId).catch(() => null);
      await resolvePurchaseReview(
        supabase,
        userId,
        decision as { id: string; ref: string | null; payload: unknown },
        body.action === "approve",
        box,
        body.method === "link" ? "link" : "fill",
      );
    } catch (error) {
      if (error instanceof PurchaseError) {
        return NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.status },
        );
      }
      console.error(
        JSON.stringify({
          msg: "purchase_review resolution failed",
          user_id: userId,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      return NextResponse.json(
        { error: "could not resolve the purchase review — try again" },
        { status: 502 },
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  if (decision.kind === "payment_request" && decision.ref) {
    // MA8 #12: approval resolves through rails with their own invariants —
    // fiat mints a Stripe Checkout (Link) session on the payee's connected
    // account (the response carries the URL to open); USDC files the
    // existing wallet transfer intent whose own approval executes the send.
    try {
      if (body.action === "approve") {
        const result = await approvePaymentRequest(
          supabase,
          userId,
          decision.ref as string,
          `${env.appOrigin()}/home`,
        );
        await supabase
          .from("decisions")
          .update({ status: "approved", resolved_at: new Date().toISOString() })
          .eq("id", decision.id)
          .eq("user_id", userId);
        return NextResponse.json({ ok: true, ...result });
      }
      await dismissPaymentRequest(supabase, userId, decision.ref as string);
    } catch (error) {
      if (error instanceof CommerceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      throw error;
    }
  }

  if (decision.kind === "shop_publish" && body.action === "approve") {
    // MA8 #13: owner approval projects the box-side catalog into the public
    // storefront_products rows — the agent can only stage.
    try {
      await applyCatalogPublish(supabase, userId);
    } catch {
      return NextResponse.json(
        { error: "couldn't reach your agent's computer — try again" },
        { status: 502 },
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  if (decision.kind === "crm_update" && body.action === "approve") {
    // MA6 #9: a tier-derived CRM edit the agent proposed. Approval applies
    // the stored patch to the box-side people store with agent provenance;
    // dismissal leaves the store untouched.
    try {
      await applyPatchOnBox(
        supabase,
        userId,
        sanitizePatch((decision.payload ?? {}) as Record<string, unknown>),
        {
          source: "agent",
          at: new Date().toISOString(),
          note: "owner-approved",
        },
      );
    } catch {
      return NextResponse.json(
        { error: "couldn't reach your agent's computer — try again" },
        { status: 502 },
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  if (decision.kind === "run_approval" && decision.ref) {
    // V8: a wallet send intent — approve executes server-side via thirdweb
    // from the server-stored owner wallet; dismiss marks it denied and no
    // transaction ever exists. A failure before the provider is reached
    // leaves BOTH the intent and the decision pending so approval can be
    // retried; an ambiguous submit is terminal (submit_unknown) and resolves
    // the decision — re-approval could double-send (P0-1/C23).
    const transfer = await findPendingTransfer(
      supabase,
      userId,
      decision.ref as string,
    );
    if (transfer) {
      if (body.action === "approve") {
        try {
          await executeTransfer(supabase, userId, transfer);
        } catch (error) {
          if (error instanceof WalletSubmitUnknownError) {
            await supabase
              .from("decisions")
              .update({
                status: "approved",
                resolved_at: new Date().toISOString(),
              })
              .eq("id", decision.id)
              .eq("user_id", userId);
            return NextResponse.json(
              { error: error.message },
              { status: error.status },
            );
          }
          if (error instanceof WalletSendError) {
            return NextResponse.json(
              { error: error.message },
              { status: error.status },
            );
          }
          console.error(
            JSON.stringify({
              msg: "wallet transfer execution failed",
              user_id: userId,
              transfer_id: transfer.id,
              error: error instanceof Error ? error.message : "unknown",
            }),
          );
          return NextResponse.json(
            { error: "the send failed — nothing moved; try again" },
            { status: 502 },
          );
        }
      } else {
        await denyTransfer(supabase, userId, transfer.id);
      }
    }
  }

  if (
    decision.kind === "run_approval" &&
    decision.ref &&
    body.action === "approve"
  ) {
    // V3: the auto-pause notice — approving resumes the paused schedule.
    const { data: scheduleRow } = await supabase
      .from("agent_schedules")
      .select(SCHEDULE_COLUMNS)
      .eq("id", decision.ref)
      .eq("user_id", userId)
      .eq("status", "paused")
      .maybeSingle();
    if (scheduleRow) {
      const schedule = parseAgentSchedule(scheduleRow);
      if (schedule) {
        let next: Date;
        try {
          next = nextRunAt(schedule.cron, schedule.timezone);
        } catch {
          next = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        await supabase
          .from("agent_schedules")
          .update({
            status: "active",
            failure_count: 0,
            next_run_at: clampToWakingHours(
              next,
              schedule.timezone,
              schedule.deliver,
            ).toISOString(),
          })
          .eq("id", schedule.id);
      }
    }
  }

  if (
    body.action === "approve" &&
    ["reconnect", "revise"].includes(decision.kind as string) &&
    decision.ref
  ) {
    // Approving re-queues the parked slot; the next sweep publishes it.
    await supabase
      .from("content_slots")
      .update({
        status: "scheduled",
        scheduled_at: new Date().toISOString(),
        attempt: 0,
        last_verdict: null,
        error_message: null,
      })
      .eq("id", decision.ref)
      .eq("user_id", userId)
      .eq("status", "parked");
  }

  await supabase
    .from("decisions")
    .update({
      status: body.action === "approve" ? "approved" : "dismissed",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", decision.id)
    .eq("user_id", userId);
  if (decision.kind === "purchase_review") {
    await updateMiniAppCard(supabase, userId, "vault", "default");
  }
  return NextResponse.json({ ok: true });
}
