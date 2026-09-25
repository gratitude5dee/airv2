/**
 * Resolve one pending decision. The kind dispatch owns every side effect:
 * approve/dismiss work for each decision kind, then the still-pending
 * claim update that records the owner's choice. A concurrent request that
 * resolved the row first owns the recorded choice — the same choice reads
 * as done, the opposite one as a conflict, never as success.
 *
 * Moved verbatim out of app/api/decisions/route.ts (R-ARCH-07) so the
 * dispatch unit-tests without NextRequest; returns the shaped response.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asRecord } from "../records";
import { EmailDraftError, sendHeldDraft } from "./email";
import { approveAdWrite, dismissAdWrite, AdWriteError } from "../ads/approvals";
import { approveContentPlan, dismissContentPlan } from "../publish/propose";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { approveRun, HermesApiError } from "../hermes/client";
import { approveInboxEvent, dismissInboxEvent } from "../calendar/store";
import {
  denyMasterkeyRun,
  executeMasterkeyRun,
  findPendingMasterkeyRun,
  MasterkeyRunError,
} from "../masterkey/runs";
import {
  hostedErrorResponse,
  resolveHostedDecision,
  type HostedDecision,
} from "../approvals/hosted";
import { applyPatchOnBox, sanitizePatch } from "../crm/store";
import {
  denyTransfer,
  executeTransfer,
  findPendingTransfer,
  WalletSendError,
  WalletSubmitUnknownError,
} from "../wallet/send";
import {
  clampToWakingHours,
  nextRunAt,
  SCHEDULE_COLUMNS,
  parseAgentSchedule,
} from "../calendar/schedule";
import { approveCatalogPublish } from "../commerce/catalog";
import { CommerceError } from "../commerce/merchants";
import {
  approveBackendForOwner,
  isBackendError,
  resolveBackendDecisionRow,
} from "../functions/approval";
import { BACKEND_DECISION_KIND } from "../functions/backend";
import { AppOriginRefusedError } from "../functions/deploy";
import { PublishError, setPublishStatus } from "../miniapps/publish";
import { onPublishDecision, PUBLISH_DECISION_KIND } from "../create/finalize";
import { recordOpsEvent } from "../security/limits";
import {
  MuseCapabilityError,
  resolveMuseActionDecision,
} from "../muse/capabilities";

/** The decision row as the route fetches it for resolution. */
export interface PendingDecisionRow {
  id: string;
  kind: string;
  ref: string | null;
  status: string;
  payload: unknown;
}

export async function resolveDecision(
  supabase: SupabaseClient,
  userId: string,
  decision: PendingDecisionRow,
  action: "approve" | "dismiss",
  method?: string,
): Promise<NextResponse> {
  if (action === "approve" && decision.kind === "email_draft" && decision.ref) {
    try {
      await sendHeldDraft(
        supabase,
        userId,
        decision.ref as string,
        decision.id as string,
      );
    } catch (error) {
      if (error instanceof EmailDraftError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      throw error;
    }
  }

  if (decision.kind === "ad_write" && decision.ref) {
    // CC0: the decision is the gate. Approval runs the ceiling check and
    // executes (or releases) the write; a refusal leaves it pending.
    try {
      if (action === "approve") {
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
    if (action === "approve") {
      await approveContentPlan(
        supabase,
        userId,
        decision.ref as string,
        asRecord(decision.payload),
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
      if (action === "approve") {
        await approveInboxEvent(box.boxId, decision.ref as string);
      } else {
        await dismissInboxEvent(box.boxId, decision.ref as string);
      }
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  const isMuseCalendarAction = decision.kind === "calendar_add" &&
    asRecord(decision.payload)?.["muse_action"] === "calendar_add";
  if (decision.kind === "muse_action" || isMuseCalendarAction) {
    // Muse may propose a calendar write or a recurring run, but the complete
    // proposal lives only on the owner's Box. This is the sole execution
    // point, after the owner has approved the decision; a failure leaves the
    // row pending so it can be safely retried.
    try {
      await resolveMuseActionDecision(
        supabase,
        userId,
        { id: decision.id as string, payload: decision.payload },
        action === "approve",
      );
    } catch (error) {
      if (error instanceof MuseCapabilityError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json(
        { error: "could not complete the Muse request — try again" },
        { status: 502 },
      );
    }
  }

  if (
    decision.kind === "social_post" &&
    !decision.ref &&
    action === "approve"
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
        action === "approve",
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "social_post approval relay failed",
          user_id: userId,
          action,
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
      if (action === "approve" || !runGone) {
        return NextResponse.json(
          { error: "could not reach the agent — try again" },
          { status: 502 },
        );
      }
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }

  if (
    decision.kind === "purchase_review" ||
    decision.kind === "payment_request" ||
    decision.kind === "trade_order" ||
    decision.kind === "trade_cancel" ||
    decision.kind === "trade_settings"
  ) {
    // Shared with the hosted approval page (lib/approvals/hosted) so both
    // surfaces resolve through the same rails and can never disagree.
    try {
      const result = await resolveHostedDecision(
        supabase,
        userId,
        decision as HostedDecision,
        action === "approve" ? "approve" : "dismiss",
        method === "link" ? "link" : "fill",
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const mapped = hostedErrorResponse(error);
      if (mapped) return mapped;
      if (decision.kind === "payment_request") throw error;
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
    }
  }

  if (decision.kind === "shop_publish" && action === "approve") {
    // MA8 #13: owner approval projects the box-side catalog into the public
    // storefront_products rows — the agent can only stage. approveCatalogPublish
    // claims the decision before it projects, so a dismissal that wins the
    // race publishes nothing and a staging that lands after files a new card.
    let approval;
    try {
      approval = await approveCatalogPublish(supabase, userId, {
        id: decision.id as string,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "shop_publish approval failed",
          user_id: userId,
          decision_id: decision.id,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      if (error instanceof CommerceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      return NextResponse.json(
        { error: "couldn't reach your agent's computer — try again" },
        { status: 502 },
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
    if (approval.outcome === "resolved") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, published: approval.published });
  }

  if (decision.kind === PUBLISH_DECISION_KIND && decision.ref) {
    // V12 §9.3 (and §18: only the decision tap flips status). The row is
    // claimed first, so a racing dismissal publishes nothing; the flip then
    // points live at the staged version and the hook lists the app, moves
    // the intake and kicks the mirror. The hook never throws (CR20).
    const slug = decision.ref as string;
    const resolution = action === "approve" ? "approved" : "dismissed";
    const { data: claimed } = await supabase
      .from("decisions")
      .update({ status: resolution, resolved_at: new Date().toISOString() })
      .eq("id", decision.id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id, payload");
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (action === "approve") {
      try {
        await setPublishStatus(supabase, userId, slug, "published");
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "miniapp_publish approval failed",
            user_id: userId,
            app: slug,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
        if (error instanceof PublishError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json(
          { error: "approved, but publishing failed — try again from the app's Share tab" },
          { status: 502 }
        );
      }
      await recordOpsEvent(supabase, "publish", userId, slug);
    }
    await onPublishDecision(
      supabase,
      userId,
      slug,
      action === "approve" ? "approved" : "declined",
      (claimed as { id: string; payload?: unknown }[]).map((row) => ({ id: row.id, payload: row.payload }))
    );
    return NextResponse.json({ ok: true, published: action === "approve" });
  }

  if (decision.kind === BACKEND_DECISION_KIND && decision.ref) {
    // MC5 (goal-create-v11 §4.1, CR4): the owner's tap is the only thing
    // that turns a declared backend into an approved manifest. The row is
    // claimed first so a racing dismissal approves nothing; approval then
    // stamps, redeploys the live Worker and re-signs the manifest.
    const slug = decision.ref as string;
    const claimed = await resolveBackendDecisionRow(
      supabase,
      userId,
      slug,
      action === "approve" ? "approved" : "dismissed",
    );
    if (!claimed) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (action !== "approve") return NextResponse.json({ ok: true });
    try {
      const row = await approveBackendForOwner(supabase, userId, slug);
      return NextResponse.json({
        ok: true,
        backend: row ? { status: row.status, approved: row.approved_manifest } : null,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "miniapp_backend approval failed",
          user_id: userId,
          app: slug,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      if (isBackendError(error) || error instanceof PublishError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      if (error instanceof AppOriginRefusedError) {
        return NextResponse.json({ error: "app is being deleted" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "approved, but the backend could not be deployed — try again from the Functions tab" },
        { status: 502 },
      );
    }
  }

  if (decision.kind === "crm_update" && action === "approve") {
    // MA6 #9: a tier-derived CRM edit the agent proposed. Approval applies
    // the stored patch to the box-side people store with agent provenance;
    // dismissal leaves the store untouched.
    try {
      await applyPatchOnBox(
        supabase,
        userId,
        sanitizePatch(asRecord(decision.payload) ?? {}),
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
      if (action === "approve") {
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

  if (decision.kind === "run_approval" && decision.ref) {
    // Store "Pay & run": approve executes MasterKey run_service server-side
    // from the user's per-user wallet; dismiss denies it and nothing is
    // charged. A spend-gate refusal at execution time resolves the run as
    // failed but leaves the decision to fall through and close normally.
    const run = await findPendingMasterkeyRun(
      supabase,
      userId,
      decision.ref as string,
    );
    if (run) {
      if (action === "approve") {
        try {
          await executeMasterkeyRun(supabase, userId, run);
        } catch (error) {
          if (error instanceof MasterkeyRunError) {
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
          throw error;
        }
      } else {
        await denyMasterkeyRun(supabase, userId, run.id);
      }
    }
  }

  if (
    decision.kind === "run_approval" &&
    decision.ref &&
    action === "approve"
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
    action === "approve" &&
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

  // Only a still-pending row takes this resolution. A concurrent request
  // that resolved it first owns the recorded choice: the same choice is
  // reported as done, the opposite one as a conflict, never as success.
  const status = action === "approve" ? "approved" : "dismissed";
  const { data: resolved, error: resolveError } = await supabase
    .from("decisions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", decision.id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id");
  if (resolveError) {
    return NextResponse.json(
      { error: "could not record the decision — try again" },
      { status: 500 },
    );
  }
  if (!resolved || resolved.length === 0) {
    const { data: current } = await supabase
      .from("decisions")
      .select("status")
      .eq("id", decision.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (current?.status !== status) {
      return NextResponse.json(
        { error: "this was already resolved the other way" },
        { status: 409 },
      );
    }
  }
  return NextResponse.json({ ok: true });
}
