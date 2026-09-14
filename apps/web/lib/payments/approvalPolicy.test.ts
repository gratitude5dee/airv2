import { describe, expect, it } from "vitest";
import {
  evaluateDelegatedApproval,
  type DelegatedApprovalCandidate,
  type DelegatedApprovalPolicy,
} from "./approvalPolicy";

const now = Date.parse("2026-09-14T16:00:00.000Z");
const policy: DelegatedApprovalPolicy = {
  ownerId: "user-1",
  enabled: true,
  providerSupportsDelegatedApproval: true,
  merchantHosts: ["tickets.example"],
  currency: "usd",
  maxTransactionCents: 50_000,
  aggregateBudgetCents: 100_000,
  aggregateUsedCents: 10_000,
  categories: ["events"],
  cartFingerprint: "cart-v1",
  expiresAt: "2026-09-15T00:00:00.000Z",
};
const candidate: DelegatedApprovalCandidate = {
  ownerId: "user-1",
  merchantHost: "tickets.example",
  currency: "USD",
  amountCents: 20_000,
  category: "events",
  cartFingerprint: "cart-v1",
};

describe("delegated payment approval policy", () => {
  it("approves only an exact, unexpired policy match", () => {
    expect(evaluateDelegatedApproval(policy, candidate, now)).toEqual({
      approved: true,
      reason: "policy_match",
    });
  });

  it.each([
    ["owner differs", { ownerId: "user-2" }, "owner_mismatch"],
    ["merchant differs", { merchantHost: "evil.example" }, "merchant_not_allowed"],
    ["currency differs", { currency: "eur" }, "currency_not_allowed"],
    ["transaction exceeds ceiling", { amountCents: 50_001 }, "transaction_limit"],
    ["category differs", { category: "weapons" }, "category_not_allowed"],
    ["cart changed", { cartFingerprint: "cart-v2" }, "cart_changed"],
  ] as const)("fails closed when %s", (_label, override, code) => {
    expect(evaluateDelegatedApproval(policy, { ...candidate, ...override }, now)).toEqual({
      approved: false,
      code,
    });
  });

  it("fails closed when the provider capability or policy opt-in is absent", () => {
    expect(evaluateDelegatedApproval(
      { ...policy, providerSupportsDelegatedApproval: false }, candidate, now
    )).toEqual({ approved: false, code: "provider_unsupported" });
    expect(evaluateDelegatedApproval(
      { ...policy, enabled: false }, candidate, now
    )).toEqual({ approved: false, code: "policy_disabled" });
  });

  it("rejects a request that fits the transaction ceiling but exceeds aggregate budget", () => {
    expect(evaluateDelegatedApproval(
      { ...policy, maxTransactionCents: 100_000 },
      { ...candidate, amountCents: 90_001 },
      now
    )).toEqual({ approved: false, code: "aggregate_limit" });
  });

  it("rejects malformed amounts and invalid/expired/revoked policies", () => {
    expect(evaluateDelegatedApproval(policy, { ...candidate, amountCents: 1.2 }, now)).toEqual({
      approved: false,
      code: "amount_invalid",
    });
    expect(evaluateDelegatedApproval({ ...policy, expiresAt: "not-a-date" }, candidate, now)).toEqual({
      approved: false,
      code: "policy_expired",
    });
    expect(evaluateDelegatedApproval({ ...policy, expiresAt: "2026-09-14T15:59:59.000Z" }, candidate, now)).toEqual({
      approved: false,
      code: "policy_expired",
    });
    expect(evaluateDelegatedApproval({ ...policy, revokedAt: "2026-09-14T15:00:00.000Z" }, candidate, now)).toEqual({
      approved: false,
      code: "policy_revoked",
    });
  });
});
