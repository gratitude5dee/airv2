/**
 * MA9.3 optional W&B Weave mirror — receipt METADATA only, and dormant by
 * default: WANDB_API_KEY is not provisioned, so `weaveEnabled()` is false and
 * this module performs ZERO egress. When a key is configured, exported
 * receipts are mirrored as a run-history batch via the W&B public API.
 * Receipts are already content-free by construction (lib/traces/receipts.ts
 * select lists) and transcripts are never mirrored regardless of the
 * `include` flag.
 */
import { env } from "@/lib/env";
import { toJsonlLine, type TraceReceipt } from "./receipts";

export function weaveEnabled(): boolean {
  return env.wandbApiKey() !== null;
}

/** Best-effort, fire-and-forget: mirroring must never fail or slow the
 * user's export. No-op (zero network calls) when the key is absent. */
export async function mirrorReceipts(
  receipts: TraceReceipt[]
): Promise<void> {
  const apiKey = env.wandbApiKey();
  if (apiKey === null || receipts.length === 0) return;
  try {
    await fetch("https://api.wandb.ai/files/stream", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project: env.wandbProject(),
        files: {
          "wandb-history.jsonl": {
            offset: 0,
            content: receipts.map((row) => toJsonlLine(row)),
          },
        },
      }),
    });
  } catch {
    // metadata mirror only — never surfaces to the user
  }
}
