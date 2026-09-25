/**
 * V6 shopping (purchase_review): the offer-the-fill gate and the approval
 * that mints/redeems a fill ticket and delivers it to the box.
 *
 * Choreography (§V6, fixed): the agent reaches checkout-ready, serves the
 * summary + URL (that path is never degraded), and MAY offer to fill a
 * vault card. The offer files a purchase_review decision; the owner's
 * approval mints a single-use fill ticket (C20), redeems its jti in the
 * ledger, writes the ticket to the box, and resumes the paused run. The
 * agent then types card fields via `air-vault type` (which requires and
 * burns the ticket, box-side); the human clicks Place order / Pay.
 *
 * Nothing here ever sees or stores a card value — payloads and receipts
 * carry item ids, masked tails, hosts, and amount bands only (C18/C19).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, writeFile } from "../box/client";
import {
  approveRun,
  HermesApiError,
  type HermesBoxTarget,
} from "../hermes/client";
import { hostSupportsLink } from "../payments/link";
import { appendVaultEvent, VaultCliError } from "./client";
import {
  amountBand,
  mintFillTicket,
  redeemFillTicket,
  type FillTicketClaims,
} from "./tickets";

export const PURCHASE_OUTCOMES = [
  "purchase_completed",
  "purchase_abandoned",
] as const;
export type PurchaseOutcome = (typeof PURCHASE_OUTCOMES)[number];

const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;

export class PurchaseError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = "PurchaseError";
    this.code = code;
    this.status = status;
  }
}

/**
 * A failed query is not an empty result. Collapsing one into `data ?? []` (or
 * a falsy `card`) turned a vault schema drift into "no such card in the
 * vault", which reads as a legitimate owner-facing answer — so every read on
 * this path raises instead.
 */
function assertQueryOk(
  error: { message: string } | null,
  what: string
): void {
  if (!error) return;
  throw new PurchaseError(
    "query_failed",
    `could not read ${what}: ${error.message}`,
    502
  );
}

export function normalizeHost(raw: string): string {
  const host = raw.trim().toLowerCase().replace(/^www\./, "");
  if (!HOST_RE.test(host)) {
    throw new PurchaseError("bad_host", "invalid site host", 400);
  }
  return host;
}

export interface PurchaseReviewPayload {
  host: string;
  summary: string;
  item_id: string;
  amount_band: string;
  card_name: string;
  card_masked: string | null;
  link_supported?: boolean;
}

/**
 * The originating turn, resolved server-side (the box never names a run):
 * an open web/desktop/voice run is the owner's own composer; an active
 * iMessage flush chain carries the burst's sender tier. Offer-the-fill is
 * owner-initiated ONLY — a tier-1 conversation can never open one (C20).
 */
export async function resolveActiveTurn(
  supabase: SupabaseClient,
  userId: string
): Promise<{ runId: string | null; ownerInitiated: boolean }> {
  const { data: openRun, error: runError } = await supabase
    .from("agent_runs")
    .select("hermes_run_id, started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .not("hermes_run_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: flushJob, error: flushError } = await supabase
    .from("flush_jobs")
    .select("hermes_run_id, chain_started_at, sender_tier")
    .eq("user_id", userId)
    .not("hermes_run_id", "is", null)
    .not("chain_started_at", "is", null)
    .order("chain_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertQueryOk(runError, "the active run");
  assertQueryOk(flushError, "the active flush job");

  const runStarted = openRun?.started_at
    ? Date.parse(String(openRun.started_at))
    : Number.NEGATIVE_INFINITY;
  const flushStarted = flushJob?.chain_started_at
    ? Date.parse(String(flushJob.chain_started_at))
    : Number.NEGATIVE_INFINITY;

  if (flushJob && flushStarted >= runStarted) {
    return {
      runId: (flushJob.hermes_run_id as string) ?? null,
      // Unknown tier (legacy rows) is NOT owner — fail closed.
      ownerInitiated: flushJob.sender_tier === 0,
    };
  }
  if (openRun) {
    return { runId: openRun.hermes_run_id as string, ownerInitiated: true };
  }
  return { runId: null, ownerInitiated: false };
}

/**
 * File the purchase_review decision (offer-the-fill). Enforced here, not in
 * the prompt: the named item must be one of the owner's own card items,
 * the turn must be owner-initiated, and at most one purchase_review may be
 * open per site at a time. Writes the fill_requested receipt.
 */
export async function proposePurchaseReview(
  supabase: SupabaseClient,
  userId: string,
  input: {
    host: string;
    itemId: string;
    summary: string;
    amountUsd: number;
  }
): Promise<{ decisionId: string; amountBand: string; cardName: string }> {
  const host = normalizeHost(input.host);

  const turn = await resolveActiveTurn(supabase, userId);
  if (!turn.ownerInitiated) {
    throw new PurchaseError(
      "owner_only",
      "card fill offers are owner-initiated only"
    );
  }

  const { data: card, error: cardError } = await supabase
    .from("vault_items")
    .select("id, kind, name, masked")
    .eq("user_id", userId)
    .eq("id", input.itemId)
    .eq("kind", "card")
    .is("deleted_at", null)
    .maybeSingle();
  assertQueryOk(cardError, "the vault");
  if (!card) {
    throw new PurchaseError(
      "no_card",
      "no such card in the vault — serve the checkout URL instead",
      404
    );
  }

  const { data: open, error: openError } = await supabase
    .from("decisions")
    .select("id, payload")
    .eq("user_id", userId)
    .eq("kind", "purchase_review")
    .eq("status", "pending");
  assertQueryOk(openError, "the open purchase reviews");
  const alreadyOpen = (open ?? []).some((row) => {
    const payload = row.payload as { host?: unknown } | null;
    return typeof payload?.host === "string" && payload.host === host;
  });
  if (alreadyOpen) {
    throw new PurchaseError(
      "review_open",
      `a purchase review for ${host} is already waiting on the owner`,
      409
    );
  }

  const band = amountBand(input.amountUsd);
  await appendVaultEvent(
    supabase,
    userId,
    "fill_requested",
    card.id as string,
    `${host}:${band}`
  );

  const payload: PurchaseReviewPayload = {
    host,
    summary: input.summary,
    item_id: card.id as string,
    amount_band: band,
    card_name: card.name as string,
    card_masked: (card.masked as string | null) ?? null,
    link_supported: await hostSupportsLink(host),
  };
  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "purchase_review",
      ref: turn.runId,
      label: `Fill ${payload.card_name}${payload.card_masked ? ` ${payload.card_masked}` : ""} on ${host} (${band})`,
      payload,
    })
    .select("id")
    .single();
  if (error || !decision) {
    throw new PurchaseError("decision_failed", "could not file the review", 502);
  }
  return {
    decisionId: decision.id as string,
    amountBand: band,
    cardName: payload.card_name,
  };
}

/** Write the ticket to the box, 600 inside a 700 dir, mirroring the vault
 * inbox discipline. The file carries claims only — no HMAC key, no value. */
async function deliverTicket(
  boxId: string,
  claims: FillTicketClaims,
  dryRunHosts: string[]
): Promise<void> {
  const relative = `.hermes/vault/.tickets/${claims.itemId}.json`;
  const absolute = `/home/user/${relative}`;
  const prepared = await command(
    boxId,
    `mkdir -p /home/user/.hermes/vault/.tickets && chmod 700 /home/user/.hermes/vault /home/user/.hermes/vault/.tickets && install -m 600 /dev/null ${JSON.stringify(absolute)}`
  );
  if (prepared.exitCode !== 0) {
    throw new VaultCliError(
      "ticket_delivery_failed",
      "could not prepare the ticket directory"
    );
  }
  await writeFile(
    boxId,
    relative,
    JSON.stringify({
      version: 1,
      item_id: claims.itemId,
      host: claims.host,
      amount_band: claims.amountBand,
      jti: claims.jti,
      exp: claims.exp,
      dry_run_hosts: dryRunHosts,
      typed: [],
    })
  );
  const tightened = await command(
    boxId,
    `chmod 600 ${JSON.stringify(absolute)}`
  );
  if (tightened.exitCode !== 0) {
    throw new VaultCliError(
      "ticket_delivery_failed",
      "could not tighten the ticket file mode"
    );
  }
}

/** Optional control-plane allowlist of staging store hosts (§8). */
export function dryRunHosts(): string[] {
  return (process.env["SHOPPING_DRY_RUN_HOSTS"] ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^www\./, ""))
    .filter((h) => h.length > 0);
}

/**
 * R-SEC-05 — an approve/dismiss that fails to reach the paused run must
 * not be swallowed: mark the decision relay_failed (the sweeper retries
 * via retryFailedApprovalRelays) and log it with user_id + box_id. The
 * local receipts (fill_denied / fill_approved + the ticket ledger) are
 * already durable at this point, so the retry only resumes the run.
 * Status flips only from "pending" — a resolver that lost its race never
 * clobbers the receipt another path already wrote (CA-23).
 */
async function relayApproval(
  supabase: SupabaseClient,
  userId: string,
  box: { boxId: string; target: HermesBoxTarget },
  decision: { id: string; ref: string | null; payload: unknown },
  approved: boolean
): Promise<void> {
  if (!decision.ref) return;
  try {
    await approveRun(box.target, decision.ref, approved);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "purchase_review approval relay failed",
        user_id: userId,
        box_id: box.boxId,
        decision_id: decision.id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    const { error: updateError } = await supabase
      .from("decisions")
      .update({
        status: "relay_failed",
        payload: {
          ...((decision.payload ?? {}) as Record<string, unknown>),
          relay_approved: approved,
        },
      })
      .eq("id", decision.id)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (updateError) {
      console.error(
        JSON.stringify({
          msg: "purchase_review relay_failed mark failed",
          user_id: userId,
          decision_id: decision.id,
          error: updateError.message,
        })
      );
    }
  }
}

/**
 * The cron half of R-SEC-05: resume the run every relay_failed decision is
 * still holding. The run the relay lost may be gone entirely (404/410) —
 * the local receipts already landed, so close the decision rather than
 * retry forever. Returns the count of decisions closed this tick.
 */
export async function retryFailedApprovalRelays(
  supabase: SupabaseClient,
  wake: (userId: string) => Promise<{
    boxId: string;
    target: HermesBoxTarget;
  } | null>,
  rearm: (userId: string) => Promise<void>
): Promise<{ retried: number; closed: number }> {
  const { data: stuck, error } = await supabase
    .from("decisions")
    .select("id, user_id, ref, payload")
    .eq("kind", "purchase_review")
    .eq("status", "relay_failed");
  if (error || !stuck) return { retried: 0, closed: 0 };

  let retried = 0;
  let closed = 0;
  for (const row of stuck as {
    id: string;
    user_id: string;
    ref: string | null;
    payload: unknown;
  }[]) {
    try {
      if (!row.ref) {
        // Nothing to resume — close the decision.
        await supabase
          .from("decisions")
          .update({ status: "dismissed", resolved_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("status", "relay_failed");
        closed += 1;
        continue;
      }
      const approved =
        (row.payload as { relay_approved?: unknown } | null)?.relay_approved ===
        true;
      const box = await wake(row.user_id).catch(() => null);
      if (!box) continue;
      try {
        await approveRun(box.target, row.ref, approved);
      } catch (relayError) {
        // A paused run that no longer exists cannot be resumed — the
        // receipts already landed, so close the decision out.
        if (
          relayError instanceof HermesApiError &&
          [404, 409, 410].includes(relayError.status)
        ) {
          await supabase
            .from("decisions")
            .update({
              status: approved ? "approved" : "dismissed",
              resolved_at: new Date().toISOString(),
            })
            .eq("id", row.id)
            .eq("status", "relay_failed");
          closed += 1;
        } else {
          throw relayError;
        }
        continue;
      } finally {
        await rearm(row.user_id).catch(() => undefined);
      }
      await supabase
        .from("decisions")
        .update({
          status: approved ? "approved" : "dismissed",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "relay_failed");
      retried += 1;
      closed += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "sweeper approval relay retry failed",
          user_id: row.user_id,
          decision_id: row.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  return { retried, closed };
}

/**
 * Resolve an owner decision on a purchase_review. Approve mints the fill
 * ticket, redeems its jti in the ledger (single use), delivers it to the
 * box, and resumes the paused run; deny writes the fill_denied receipt and
 * resumes the run with approved=false. The serve-the-URL path is untouched
 * either way — the owner can always finish manually.
 */
export async function resolvePurchaseReview(
  supabase: SupabaseClient,
  userId: string,
  decision: { id: string; ref: string | null; payload: unknown },
  approve: boolean,
  box: { boxId: string; target: HermesBoxTarget } | null,
  method: "fill" | "link" = "fill"
): Promise<void> {
  const payload = decision.payload as Partial<PurchaseReviewPayload> | null;
  const host = typeof payload?.host === "string" ? payload.host : "";
  const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";

  if (approve && method === "link") {
    // Pay with Link (MA6 #5): the review card only offers this when the
    // proposal recorded host support. NO fill happens — no ticket is minted
    // and the run is resumed with approved=false so the agent never types
    // card fields; the owner completes the merchant's Link flow in the
    // headed browser. The stop-before-submission invariant is untouched.
    if (payload?.link_supported !== true) {
      throw new PurchaseError(
        "link_unsupported",
        "this checkout was not offered with Link",
        409
      );
    }
    await appendVaultEvent(
      supabase,
      userId,
      "fill_denied",
      itemId || null,
      host ? `${host}:link_selected` : "link_selected"
    );
    if (box) {
      await relayApproval(supabase, userId, box, decision, false);
    }
    return;
  }

  if (!approve) {
    await appendVaultEvent(
      supabase,
      userId,
      "fill_denied",
      itemId || null,
      host ? `${host}:owner_denied` : "owner_denied"
    );
    if (box) {
      await relayApproval(supabase, userId, box, decision, false);
    }
    return;
  }

  if (!host || !itemId || !box) {
    throw new PurchaseError("bad_decision", "malformed purchase review", 409);
  }
  // The card must still exist at approval time.
  const { data: card, error: cardError } = await supabase
    .from("vault_items")
    .select("id")
    .eq("user_id", userId)
    .eq("id", itemId)
    .eq("kind", "card")
    .is("deleted_at", null)
    .maybeSingle();
  assertQueryOk(cardError, "the vault");
  if (!card) {
    throw new PurchaseError("no_card", "the card is no longer in the vault", 409);
  }

  const band =
    typeof payload?.amount_band === "string"
      ? payload.amount_band
      : "unknown amount";
  const { claims } = mintFillTicket(userId, itemId, host, band);
  await appendVaultEvent(
    supabase,
    userId,
    "ticket_minted",
    itemId,
    `${claims.host}:${claims.jti}`
  );
  if (!(await redeemFillTicket(supabase, claims))) {
    throw new PurchaseError("ticket_replayed", "ticket was already redeemed", 409);
  }
  await appendVaultEvent(
    supabase,
    userId,
    "ticket_redeemed",
    itemId,
    `${claims.host}:${claims.jti}`
  );
  await deliverTicket(box.boxId, claims, dryRunHosts());
  await appendVaultEvent(
    supabase,
    userId,
    "fill_approved",
    itemId,
    `${claims.host}:${band}`
  );
  await relayApproval(supabase, userId, box, decision, true);
}

/**
 * Post-purchase confirmation: record the outcome on agent_runs using the
 * existing free-text outcome column (no schema widening). Updates the
 * turn's own row when one exists (web runs insert at start); otherwise —
 * mid-flight iMessage runs have no row yet — inserts one keyed by the
 * hermes run id so the flush's closer updates it instead of duplicating.
 */
export async function recordPurchaseOutcome(
  supabase: SupabaseClient,
  userId: string,
  outcome: PurchaseOutcome
): Promise<void> {
  const turn = await resolveActiveTurn(supabase, userId);
  if (turn.runId) {
    const { data: updated } = await supabase
      .from("agent_runs")
      .update({ outcome })
      .eq("user_id", userId)
      .eq("hermes_run_id", turn.runId)
      .select("id");
    if (updated && updated.length > 0) return;
    await supabase.from("agent_runs").insert({
      user_id: userId,
      hermes_run_id: turn.runId,
      trigger: "imessage",
      outcome,
    });
    return;
  }
  // No resolvable run (e.g. the run closed between fill and confirmation):
  // still keep the receipt as its own value-free row.
  await supabase.from("agent_runs").insert({
    user_id: userId,
    ended_at: new Date().toISOString(),
    outcome,
  });
}
