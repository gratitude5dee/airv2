/**
 * Batch approval for same-kind tier-1 email drafts (V8 Needs-you). The only
 * batchable kind is email_draft: its approval is a pure control-plane send
 * (C10) with no box wake or run resume, so N approvals compose safely. Every
 * other kind resolves one at a time through the single-decision path.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDraft } from "../mail/client";

export interface BatchResult {
  approved: string[];
  skipped: { id: string; reason: string }[];
}

const BATCH_LIMIT = 20;

interface DecisionRow {
  id: string;
  kind: string;
  ref: string | null;
  status: string;
  sender: string | null;
  platform: string | null;
}

export async function batchApproveEmailDrafts(
  supabase: SupabaseClient,
  userId: string,
  ids: string[]
): Promise<BatchResult> {
  const deduped = Array.from(new Set(ids));
  const unique = deduped.slice(0, BATCH_LIMIT);
  const result: BatchResult = { approved: [], skipped: [] };
  // Over-limit ids stay pending and are reported, never silently dropped.
  for (const id of deduped.slice(BATCH_LIMIT)) {
    result.skipped.push({ id, reason: "batch limit reached" });
  }
  if (unique.length === 0) return result;

  const { data: rows } = await supabase
    .from("decisions")
    .select("id, kind, ref, status, sender, platform")
    .in("id", unique)
    .eq("user_id", userId);
  const decisions = new Map(
    ((rows ?? []) as DecisionRow[]).map((row) => [row.id, row])
  );

  const { data: address } = await supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  const inboxId = address?.agentmail_inbox_id as string | undefined;

  // Tier check once per batch: a draft only batch-approves when its
  // counterparty is a known (tier-1) email sender. Tier-2 drafts keep the
  // one-at-a-time path where the owner sees each card individually.
  const { data: tierRows } = await supabase
    .from("senders")
    .select("address, trust_tier")
    .eq("user_id", userId)
    .eq("platform", "email");
  const tierByAddress = new Map(
    (tierRows ?? []).map((row) => [
      (row.address as string).toLowerCase(),
      row.trust_tier as number,
    ])
  );

  for (const id of unique) {
    const decision = decisions.get(id);
    if (!decision) {
      result.skipped.push({ id, reason: "not found" });
      continue;
    }
    if (decision.status !== "pending") {
      result.skipped.push({ id, reason: "already resolved" });
      continue;
    }
    if (decision.kind !== "email_draft" || !decision.ref) {
      result.skipped.push({ id, reason: "not a batchable email draft" });
      continue;
    }
    const tier = decision.sender
      ? tierByAddress.get(decision.sender.toLowerCase())
      : undefined;
    if (tier !== 1) {
      result.skipped.push({ id, reason: "sender is not tier 1" });
      continue;
    }
    if (!inboxId) {
      result.skipped.push({ id, reason: "no inbox" });
      continue;
    }
    try {
      await sendDraft(inboxId, decision.ref, decision.id);
    } catch {
      result.skipped.push({ id, reason: "send failed" });
      continue;
    }
    await supabase
      .from("decisions")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", decision.id)
      .eq("user_id", userId)
      .eq("status", "pending");
    result.approved.push(decision.id);
  }
  return result;
}
