import type { SupabaseClient } from "@supabase/supabase-js";
import { isIP } from "node:net";

export type CheckoutHandoffStatus =
  | "preparing" | "needs_human" | "ready_for_review" | "payment_pending"
  | "requires_action" | "completed" | "failed" | "expired" | "cancelled" | "unknown_outcome";

const TERMINAL_STATUSES: ReadonlySet<CheckoutHandoffStatus> = new Set([
  "completed",
  "failed",
  "expired",
  "cancelled",
  "unknown_outcome",
]);

const ALLOWED_TRANSITIONS: Readonly<Record<CheckoutHandoffStatus, ReadonlySet<CheckoutHandoffStatus>>> = {
  preparing: new Set(["preparing", "needs_human", "ready_for_review", "failed", "expired", "cancelled"]),
  needs_human: new Set(["needs_human", "ready_for_review", "payment_pending", "failed", "expired", "cancelled"]),
  ready_for_review: new Set(["ready_for_review", "payment_pending", "needs_human", "failed", "expired", "cancelled"]),
  payment_pending: new Set(["payment_pending", "requires_action", "completed", "failed", "expired", "cancelled", "unknown_outcome"]),
  requires_action: new Set(["requires_action", "payment_pending", "completed", "failed", "expired", "cancelled", "unknown_outcome"]),
  completed: new Set(["completed"]),
  failed: new Set(["failed"]),
  expired: new Set(["expired"]),
  cancelled: new Set(["cancelled"]),
  unknown_outcome: new Set(["unknown_outcome"]),
};

export function checkoutTransitionAllowed(
  from: CheckoutHandoffStatus,
  to: CheckoutHandoffStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

export interface CheckoutHandoff {
  id: string; user_id: string; space_id: string; phone: string; task_id: string | null;
  status: CheckoutHandoffStatus; merchant_host: string; merchant_url: string;
  item_summary: string; quantity: number | null; amount_cents: number | null;
  currency: string | null; blocker: string | null; verified_at: string | null;
  expires_at: string | null; same_session: boolean; payment_request_id: string | null;
  version: number; created_at: string; updated_at: string;
}

const COLUMNS = "id, user_id, space_id, phone, task_id, status, merchant_host, merchant_url, item_summary, quantity, amount_cents, currency, blocker, verified_at, expires_at, same_session, payment_request_id, version, created_at, updated_at";
const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCheckoutHandoffId(value: string): boolean {
  return UUID_RE.test(value);
}

/** Only public HTTPS merchant URLs are valid destinations. */
export function safeCheckoutUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const literalHost = host.replace(/^\[|\]$/g, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !HOST_RE.test(host) ||
      host.includes("..") ||
      isIP(literalHost) !== 0
    ) return null;
    if (host === "localhost" || host.endsWith(".localhost")) return null;
    return url;
  } catch { return null; }
}

export interface CreateCheckoutHandoffInput {
  userId: string; spaceId: string; phone: string; taskId?: string | null;
  merchantUrl: string; itemSummary: string; quantity?: number | null;
  amountCents?: number | null; currency?: string | null; blocker?: string | null;
  status?: CheckoutHandoffStatus; verifiedAt?: string | null; expiresAt?: string | null;
  sameSession?: boolean; paymentRequestId?: string | null;
}

export interface UpdateCheckoutHandoffInput {
  status?: CheckoutHandoffStatus;
  blocker?: string | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  paymentRequestId?: string | null;
  /** Optional optimistic-concurrency check supplied by a retrying worker. */
  expectedVersion?: number;
}

export async function createCheckoutHandoff(supabase: SupabaseClient, input: CreateCheckoutHandoffInput): Promise<CheckoutHandoff> {
  const url = safeCheckoutUrl(input.merchantUrl);
  if (!url) throw new Error("merchant checkout URL must be HTTPS and public");
  const itemSummary = input.itemSummary.trim().slice(0, 500);
  if (!itemSummary) throw new Error("checkout item summary is required");
  const quantity = input.quantity ?? null;
  if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10_000)) {
    throw new Error("checkout quantity is invalid");
  }
  const amountCents = input.amountCents ?? null;
  if (amountCents !== null && (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 2_147_483_647)) {
    throw new Error("checkout amount is invalid");
  }
  const currency = input.currency?.trim().toLowerCase() ?? null;
  if (currency !== null && !/^[a-z]{3}$/.test(currency)) throw new Error("checkout currency is invalid");
  const taskId = input.taskId?.trim().slice(0, 200) || null;
  if (input.taskId && !taskId) throw new Error("checkout task id is invalid");
  if (taskId) {
    const { data: existing, error: existingError } = await supabase
      .from("checkout_handoffs")
      .select(COLUMNS)
      .eq("user_id", input.userId)
      .eq("task_id", taskId)
      .maybeSingle();
    if (existingError) throw new Error("could not read existing checkout handoff");
    if (existing) {
      const prior = existing as CheckoutHandoff;
      const sameQuote =
        prior.merchant_url === url.toString() &&
        prior.item_summary === itemSummary &&
        prior.quantity === quantity &&
        prior.amount_cents === amountCents &&
        prior.currency === currency;
      if (!sameQuote) throw new Error("checkout task already has a different handoff");
      return prior;
    }
  }
  const { data, error } = await supabase.from("checkout_handoffs").insert({
    user_id: input.userId, space_id: input.spaceId, phone: input.phone,
    task_id: taskId, status: input.status ?? "ready_for_review",
    merchant_host: url.hostname.toLowerCase(), merchant_url: url.toString(), item_summary: itemSummary,
    quantity, amount_cents: amountCents,
    currency, blocker: input.blocker?.trim().slice(0, 500) ?? null,
    verified_at: input.verifiedAt ?? null, expires_at: input.expiresAt ?? null,
    same_session: input.sameSession ?? true, payment_request_id: input.paymentRequestId ?? null,
  }).select(COLUMNS).single();
  if (error) {
    // A concurrent retry can win the partial unique (user_id, task_id)
    // index after the read above. Re-read that task and return the same
    // quote when it is an idempotent retry; never mint a second card.
    if (error.code === "23505" && taskId) {
      const { data: raced, error: racedError } = await supabase
        .from("checkout_handoffs")
        .select(COLUMNS)
        .eq("user_id", input.userId)
        .eq("task_id", taskId)
        .maybeSingle();
      if (!racedError && raced) {
        const prior = raced as CheckoutHandoff;
        const sameQuote =
          prior.merchant_url === url.toString() &&
          prior.item_summary === itemSummary &&
          prior.quantity === quantity &&
          prior.amount_cents === amountCents &&
          prior.currency === currency;
        if (sameQuote) return prior;
      }
    }
    throw new Error("could not create checkout handoff");
  }
  if (!data) throw new Error("could not create checkout handoff");
  return data as CheckoutHandoff;
}

export async function getCheckoutHandoff(supabase: SupabaseClient, userId: string, id: string): Promise<CheckoutHandoff | null> {
  if (!isCheckoutHandoffId(id)) return null;
  const { data, error } = await supabase.from("checkout_handoffs").select(COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("checkout handoff lookup failed");
  return (data as CheckoutHandoff | null) ?? null;
}

/**
 * Advance a handoff without changing its quoted merchant facts. The version
 * predicate prevents a late worker from overwriting a newer payment outcome.
 */
export async function updateCheckoutHandoff(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateCheckoutHandoffInput
): Promise<CheckoutHandoff> {
  const current = await getCheckoutHandoff(supabase, userId, id);
  if (!current) throw new Error("checkout handoff not found");
  if (
    input.expectedVersion !== undefined &&
    (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion !== current.version)
  ) {
    throw new Error("checkout handoff version conflict");
  }
  const nextStatus = input.status ?? current.status;
  if (!checkoutTransitionAllowed(current.status, nextStatus)) {
    throw new Error("invalid checkout handoff transition");
  }
  if (TERMINAL_STATUSES.has(current.status) && nextStatus !== current.status) {
    throw new Error("checkout handoff is terminal");
  }
  const patch: Record<string, unknown> = {};
  if (nextStatus !== current.status) patch["status"] = nextStatus;
  if (input.blocker !== undefined) patch["blocker"] = input.blocker === null ? null : input.blocker.trim().slice(0, 500) || null;
  if (input.verifiedAt !== undefined) patch["verified_at"] = input.verifiedAt;
  if (input.expiresAt !== undefined) patch["expires_at"] = input.expiresAt;
  if (input.paymentRequestId !== undefined) patch["payment_request_id"] = input.paymentRequestId;
  if (Object.keys(patch).length === 0) return current;
  const { data, error } = await supabase
    .from("checkout_handoffs")
    .update({ ...patch, version: current.version + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("version", current.version)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error("could not update checkout handoff");
  if (!data) throw new Error("checkout handoff version conflict");
  return data as CheckoutHandoff;
}

export async function cancelCheckoutHandoff(supabase: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await supabase.from("checkout_handoffs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).in("status", ["preparing", "needs_human", "ready_for_review", "payment_pending", "requires_action"]).select("id");
  if (error) throw new Error("could not cancel checkout handoff");
  return (data?.length ?? 0) > 0;
}
