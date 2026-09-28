/**
 * "Needs you" queue (M6 task 2): list pending decisions; resolve one.
 * Approving an email_draft sends it via the control-plane key — the only
 * send path that exists (C10). All kind logic lives in lib/decisions
 * (R-ARCH-07); this handler authenticates, parses, and shapes the response.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { batchApproveEmailDrafts } from "@/lib/decisions/batch";
import { EmailDraftError, sendHeldDraft } from "@/lib/decisions/email";
import {
  approveAdWrite,
  dismissAdWrite,
  AdWriteError,
} from "@/lib/ads/approvals";
import { approveContentPlan, dismissContentPlan } from "@/lib/publish/propose";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { approveRun, HermesApiError } from "@/lib/hermes/client";
import { approveInboxEvent, dismissInboxEvent } from "@/lib/calendar/store";
import {
  denyMasterkeyRun,
  executeMasterkeyRun,
  findPendingMasterkeyRun,
  MasterkeyRunError,
} from "@/lib/masterkey/runs";
import {
  hostedErrorResponse,
  resolveHostedDecision,
  type HostedDecision,
} from "@/lib/approvals/hosted";
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
import { approveCatalogPublish } from "@/lib/commerce/catalog";
import { CommerceError } from "@/lib/commerce/merchants";
import {
  approveBackendForOwner,
  isBackendError,
  resolveBackendDecisionRow,
} from "@/lib/functions/approval";
import { BACKEND_DECISION_KIND } from "@/lib/functions/backend";
import { AppOriginRefusedError } from "@/lib/functions/deploy";
import { PublishError, setPublishStatus } from "@/lib/miniapps/publish";
import { onPublishDecision, PUBLISH_DECISION_KIND } from "@/lib/create/finalize";
import { recordOpsEvent } from "@/lib/security/limits";
import {
  MuseCapabilityError,
  resolveMuseActionDecision,
} from "@/lib/muse/capabilities";
import { log } from "@/lib/log";
import { listDecisions } from "@/lib/decisions/queue";
import { resolveDecision } from "@/lib/decisions/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// content_plan approval wakes the user's box (ensureBoxAwake), which can
// exceed the default function timeout.
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const status = request.nextUrl.searchParams.get("status") === "resolved"
    ? "resolved"
    : "pending";
  const decisions = await listDecisions(serviceClient(), userId, status);
  return NextResponse.json({ decisions });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await sessionUserId(request);
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
  // by batching. Every other kind resolves one at a time in lib.
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
  return resolveDecision(
    supabase,
    userId,
    decision,
    body.action as "approve" | "dismiss",
    body.method,
  );
}
