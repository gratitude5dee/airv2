/**
 * Gateway metering: watch the upstream SSE pass-through for the usage chunk
 * (without altering it) and settle spend into agent_runs + add_spend. A
 * usage-less close on a stream that errored still consumed provider spend,
 * so the `errored` flag lets the caller settle a Functions reservation
 * instead of releasing it for free.
 */
import { serviceClient } from "../supabase";
import { costUsd, type CreateStage, type ModelFamily } from "../entitlements/models";
import { settleAppSpend, type AppHold } from "../functions/runtime";

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/** Router decision facts recorded alongside usage — the admin trace row. */
export interface RouteTrace {
  requestedModel: string | null;
  reasoningEffort: string | null;
  startedAtMs: number;
  /** The entitled family, which differs from the served one on a fallback. */
  requestedFamily: ModelFamily;
  /** `create:<slug>` when the completion is a Create turn's; drives the
   * per-project budget (goal-create-v11 §9.1). */
  label?: string | null;
  /** The Create role the turn was made for (`#<stage>`, V12 §7.3); null
   * when absent or not a Create turn. */
  createStage?: CreateStage | null;
  /** Set for a Functions Worker's call: `trigger='app'`, and the hold taken
   * before dispatch settles to the real cost on the app's daily counter
   * (CR8). */
  app?: { id: string; hold: AppHold } | null;
}

export async function meter(
  userId: string,
  tier: "fast" | "balanced" | "deep",
  family: ModelFamily,
  usage: Usage,
  model?: string,
  /** Served on the user's own provider key — their spend, cost 0 here. */
  onPersonalKey = false,
  trace?: RouteTrace
): Promise<void> {
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cost = onPersonalKey
    ? 0
    : costUsd(tier, promptTokens, completionTokens, family, model);
  const supabase = serviceClient();
  const { error: runError } = await supabase.from("agent_runs").insert({
    user_id: userId,
    trigger: trace?.app ? "app" : null,
    ended_at: new Date().toISOString(),
    outcome: "gateway_completion",
    cost_usd: cost,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    model_family: family,
    model: model ?? null,
    fallback_from:
      trace && trace.requestedFamily !== family ? trace.requestedFamily : null,
    speed_tier: tier,
    requested_model: trace?.requestedModel ?? null,
    reasoning_effort: trace?.reasoningEffort ?? null,
    latency_ms: trace ? Date.now() - trace.startedAtMs : null,
    create_stage: trace?.createStage ?? null,
    ...(trace?.label ? { label: trace.label } : {}),
  });
  if (runError) {
    console.error(JSON.stringify({ msg: "agent_runs insert failed", user_id: userId, error: runError.message }));
  }
  if (trace && trace.requestedFamily !== family) {
    console.warn(
      JSON.stringify({
        msg: "gateway provider fallback",
        user_id: userId,
        requested_family: trace.requestedFamily,
        served_family: family,
        served_model: model ?? null,
      })
    );
  }
  const { error: spendError } = await supabase.rpc("add_spend", {
    p_user_id: userId,
    p_cost_usd: cost,
  });
  if (spendError) {
    console.error(JSON.stringify({ msg: "add_spend failed", user_id: userId, error: spendError.message }));
  }
  if (trace?.app) await settleAppSpend(supabase, trace.app.hold, cost);
}

/**
 * Watches the SSE pass-through for the final usage chunk without altering
 * it. `onEnd` fires exactly once when the stream closes: with the usage, or
 * null when no chunk carried one. A usage-less close means a Functions hold
 * is released — but when the stream errored the call did consume provider
 * spend, so `errored` lets the caller settle the reservation instead of
 * releasing it for free.
 */
export function meteringTee(
  upstream: ReadableStream<Uint8Array>,
  onEnd: (usage: Usage | null, errored: boolean) => void
): ReadableStream<Uint8Array> {
  const [client, monitor] = upstream.tee();
  void (async () => {
    const reader = monitor.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let errored = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
    } catch {
      // upstream dropped mid-stream; whatever arrived is still scanned
      errored = true;
    }
    let usage: Usage | null = null;
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as { usage?: Usage };
        if (parsed.usage) usage = parsed.usage;
      } catch {
        // non-JSON keepalive; ignore
      }
    }
    onEnd(usage, errored);
  })();
  return client;
}

/**
 * A streamed completion counts as an answer only when some delta carried
 * user-visible content or a tool call. Reasoning alone is not an answer:
 * accepting it leaves Hermes with an empty final_response and the iMessage
 * turn retries forever.
 */
export async function carriesAssistantWork(response: Response): Promise<boolean> {
  const raw = new Uint8Array(await response.clone().arrayBuffer());
  const text = new TextDecoder().decode(raw);
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        choices?: {
          delta?: {
            content?: string | null;
            tool_calls?: unknown[];
          };
        }[];
      };
      const delta = parsed.choices?.[0]?.delta;
      if (
        delta &&
        (delta.content ||
          (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0))
      ) {
        return true;
      }
    } catch {
      // non-JSON keepalive; ignore
    }
  }
  return false;
}
