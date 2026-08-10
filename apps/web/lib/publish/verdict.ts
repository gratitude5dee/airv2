/**
 * The three verdicts map to three product surfaces, and that mapping is the
 * feature (CM3 task 2): reauth → a reconnect card in "Needs you";
 * fix-content → a revise card carrying the real constraint; retry →
 * invisible exponential backoff with capped attempts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishError, type PublishAdapter, type Verdict } from "./adapter";

export const MAX_RETRY_ATTEMPTS = 5;

export function verdictFor(
  adapter: PublishAdapter,
  error: unknown
): Verdict {
  if (error instanceof PublishError) {
    return adapter.classify(error.status, error.body);
  }
  // Network-level failure reaching Composio/the platform: retry.
  return { kind: "retry", after: 5 * 60 };
}

/** Exponential backoff for retry verdicts, seconds, capped attempts. */
export function retryDelaySeconds(attempt: number, baseAfter: number): number {
  return Math.min(baseAfter * 2 ** attempt, 6 * 60 * 60);
}

/**
 * Raise a "Needs you" decision for a user-actionable verdict. `ref` points
 * at the parked slot/draft; the label carries the actual constraint so the
 * card is actionable, never a dead post.
 */
export async function raiseVerdictDecision(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  verdict: Extract<Verdict, { kind: "reauth" | "fix-content" }>,
  ref: string
): Promise<void> {
  await supabase.from("decisions").insert({
    user_id: userId,
    kind: verdict.kind === "reauth" ? "reconnect" : "revise",
    platform,
    ref,
    label: verdict.message.slice(0, 200),
  });
}
