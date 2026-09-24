/**
 * V13 §9.1 `POST /api/internal/create/notify` — the job's last step:
 * `{job_id, outcome}` sends exactly one iMessage for the build's result
 * (§0 — the card and the result are the only two bubbles). The web half is
 * the job's own state: the progress mini-app and the studio read it and
 * show the same outcome as a toast, so nothing content-bearing is stored
 * here beyond the ops event.
 *
 * `outcome` ∈ `live | stuck | failed`; `cancelled`/`superseded` send
 * nothing (the owner asked, or a newer job already took over the slot).
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { adapterErrorResponse, adapterJob, AdapterError } from "@/lib/create/adapter";
import { applyJobFact, isJobState } from "@/lib/create/job";
import { getRegistryAppById } from "@/lib/miniapps/registry";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { recordOpsEvent } from "@/lib/security/limits";

export const maxDuration = 60;

const NOTIFY_OUTCOMES = new Set(["live", "stuck", "failed"]);

function notifyText(appName: string, devUrl: string | null, outcome: string): string {
  switch (outcome) {
    case "live":
      return `${appName} is live: ${devUrl ?? "your dev link"}\nshare it with anyone. tell me what to change, or say ship it.`;
    case "stuck":
      return `${appName} hit something it couldn't fix itself — open the progress view and tell me what to change, or tap try again.`;
    default:
      return `${appName}'s build didn't make it this time. tell me what you saw and I'll take another run at it.`;
  }
}

async function ownerDestination(
  supabase: SupabaseClient,
  userId: string
): Promise<{ space_id: string; phone: string } | null> {
  // C13: imessage_destinations is written only after the owner's first
  // inbound — an owner who never texted gets no unsolicited bubble.
  const { data } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.space_id || !data.phone) return null;
  return { space_id: String(data.space_id), phone: String(data.phone) };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = serviceClient();
    const { job, body } = await adapterJob<{ job_id?: unknown; outcome?: unknown }>(
      supabase,
      request
    );
    if (typeof body.outcome !== "string" || !isJobState(body.outcome)) {
      throw new AdapterError("invalid outcome", 400);
    }
    const outcome = body.outcome;

    // The notify call is the row's terminal write for non-terminal crashes
    // too — a workflow that ended without a fact patch still lands `live`
    // or `failed` here (D3/CF2 through the same code path).
    await applyJobFact(supabase, job.id, { state: outcome });

    if (!NOTIFY_OUTCOMES.has(outcome)) {
      return Response.json({ ok: true, sent: false });
    }
    const app = await getRegistryAppById(supabase, job.app_id).catch(() => null);
    const destination = await ownerDestination(supabase, job.user_id);
    if (!destination) {
      return Response.json({ ok: true, sent: false, reason: "owner_has_not_texted" });
    }
    const sender = await createSpectrumSender();
    try {
      await sender.sendText(
        destination.space_id,
        destination.phone,
        notifyText(app?.name ?? "your app", job.dev_url, outcome)
      );
    } finally {
      await sender.close().catch(() => undefined);
    }
    await recordOpsEvent(supabase, "create.notify", job.user_id, app?.slug ?? job.app_id);
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    const mapped = adapterErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
