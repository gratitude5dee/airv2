/**
 * Fail-closed policy gate for a future Link delegated-payment adapter.
 *
 * This module is deliberately pure: it does not call Link, mint a payment
 * credential, reserve money, or infer consent from chat text. A caller must
 * still perform an atomic budget reservation and re-check the cart immediately
 * before provider submission. Until the installed provider advertises the
 * required capability, every production call should pass
 * `providerSupportsDelegatedApproval: false`.
 */

export interface DelegatedApprovalPolicy {
  ownerId: string;
  enabled: boolean;
  providerSupportsDelegatedApproval: boolean;
  /** Exact normalized merchant hostnames; wildcards are not accepted. */
  merchantHosts: readonly string[];
  currency: string;
  maxTransactionCents: number;
  aggregateBudgetCents: number;
  /** Already spent plus currently reserved amounts for this policy period. */
  aggregateUsedCents: number;
  categories: readonly string[];
  cartFingerprint: string;
  expiresAt: string;
  revokedAt?: string | null;
}

export interface DelegatedApprovalCandidate {
  ownerId: string;
  merchantHost: string;
  currency: string;
  amountCents: number;
  category: string;
  cartFingerprint: string;
}

export type ApprovalRejectCode =
  | "policy_disabled"
  | "provider_unsupported"
  | "owner_mismatch"
  | "merchant_not_allowed"
  | "currency_not_allowed"
  | "amount_invalid"
  | "transaction_limit"
  | "aggregate_limit"
  | "category_not_allowed"
  | "cart_changed"
  | "policy_expired"
  | "policy_revoked";

export type DelegatedApprovalResult =
  | { approved: true; reason: "policy_match" }
  | { approved: false; code: ApprovalRejectCode };

function host(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function currency(value: string): string {
  return value.trim().toLowerCase();
}

/** Evaluate the immutable request/policy facts immediately before a reserve. */
export function evaluateDelegatedApproval(
  policy: DelegatedApprovalPolicy,
  candidate: DelegatedApprovalCandidate,
  nowMs = Date.now()
): DelegatedApprovalResult {
  if (!policy.enabled) return { approved: false, code: "policy_disabled" };
  if (!policy.providerSupportsDelegatedApproval) {
    return { approved: false, code: "provider_unsupported" };
  }
  if (!policy.ownerId || candidate.ownerId !== policy.ownerId) {
    return { approved: false, code: "owner_mismatch" };
  }
  const merchantHost = host(candidate.merchantHost);
  if (!merchantHost || !policy.merchantHosts.map(host).includes(merchantHost)) {
    return { approved: false, code: "merchant_not_allowed" };
  }
  const candidateCurrency = currency(candidate.currency);
  const policyCurrency = currency(policy.currency);
  if (!/^[a-z]{3}$/.test(candidateCurrency) || candidateCurrency !== policyCurrency) {
    return { approved: false, code: "currency_not_allowed" };
  }
  if (!Number.isSafeInteger(candidate.amountCents) || candidate.amountCents < 0) {
    return { approved: false, code: "amount_invalid" };
  }
  if (!Number.isSafeInteger(policy.maxTransactionCents) || candidate.amountCents > policy.maxTransactionCents) {
    return { approved: false, code: "transaction_limit" };
  }
  if (!Number.isSafeInteger(policy.aggregateUsedCents) ||
      !Number.isSafeInteger(policy.aggregateBudgetCents) ||
      policy.aggregateUsedCents < 0 ||
      policy.aggregateBudgetCents < 0 ||
      policy.aggregateUsedCents + candidate.amountCents > policy.aggregateBudgetCents) {
    return { approved: false, code: "aggregate_limit" };
  }
  const category = candidate.category.trim().toLowerCase();
  if (!category || !policy.categories.map((value) => value.trim().toLowerCase()).includes(category)) {
    return { approved: false, code: "category_not_allowed" };
  }
  if (!candidate.cartFingerprint || candidate.cartFingerprint !== policy.cartFingerprint) {
    return { approved: false, code: "cart_changed" };
  }
  const expiresAt = Date.parse(policy.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return { approved: false, code: "policy_expired" };
  }
  if (policy.revokedAt !== undefined && policy.revokedAt !== null) {
    return { approved: false, code: "policy_revoked" };
  }
  return { approved: true, reason: "policy_match" };
}
