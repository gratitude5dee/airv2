/**
 * The OpenAI-compatible inference gateway (goal.md M1 §3).
 *
 * The only holder of model-provider keys. Boxes authenticate with their
 * per-box GATEWAY_TOKEN; the speed tier is resolved server-side to a real
 * model ID; spend caps are enforced with 429; the upstream stream passes
 * through unmodified while usage is metered into agent_runs.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import {
  costUsd,
  isSpeedTier,
  modelForTier,
  reasoningForTier,
} from "@/lib/entitlements/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

async function meter(
  userId: string,
  tier: "fast" | "balanced" | "deep",
  usage: Usage
): Promise<void> {
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cost = costUsd(tier, promptTokens, completionTokens);
  const supabase = serviceClient();
  const { error: runError } = await supabase.from("agent_runs").insert({
    user_id: userId,
    trigger: null,
    ended_at: new Date().toISOString(),
    outcome: "gateway_completion",
    cost_usd: cost,
  });
  if (runError) {
    console.error(JSON.stringify({ msg: "agent_runs insert failed", user_id: userId, error: runError.message }));
  }
  const { error: spendError } = await supabase.rpc("add_spend", {
    p_user_id: userId,
    p_cost_usd: cost,
  });
  if (spendError) {
    console.error(JSON.stringify({ msg: "add_spend failed", user_id: userId, error: spendError.message }));
  }
}

/** Watches the SSE pass-through for the final usage chunk without altering it. */
function meteringTee(
  upstream: ReadableStream<Uint8Array>,
  onUsage: (usage: Usage) => void
): ReadableStream<Uint8Array> {
  const [client, monitor] = upstream.tee();
  void (async () => {
    const reader = monitor.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as { usage?: Usage };
        if (parsed.usage) onUsage(parsed.usage);
      } catch {
        // non-JSON keepalive; ignore
      }
    }
  })();
  return client;
}

/**
 * GET /v1/models — Hermes probes the model catalog at startup. The tier
 * names ARE the model IDs from the box's perspective (C2: no real model ID
 * ever appears in box config).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return unauthorized();
  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return unauthorized();
  if (path.join("/") !== "models") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    object: "list",
    data: (["fast", "balanced", "deep"] as const).map((id) => ({
      id,
      object: "model",
      owned_by: "air",
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse | Response> {
  const { path } = await params;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return unauthorized();

  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return unauthorized();
  const userId = box.user_id as string;

  const { data: entitlement } = await supabase
    .from("entitlements")
    .select("speed_tier, monthly_cap_usd, spend_mtd_usd, suspended_reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (!entitlement || entitlement.suspended_reason) return unauthorized();
  if (Number(entitlement.spend_mtd_usd) >= Number(entitlement.monthly_cap_usd)) {
    return NextResponse.json(
      {
        error: {
          message:
            "Monthly usage limit reached. Ask your human to raise the cap in Billing & Usage.",
          type: "insufficient_quota",
        },
      },
      { status: 429 }
    );
  }

  const tierValue = String(entitlement.speed_tier);
  const tier = isSpeedTier(tierValue) ? tierValue : "balanced";

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  // The tier name is the only thing that ever appears in a box's config —
  // the real model ID is resolved here and only here.
  body.model = modelForTier(tier);
  const reasoning = reasoningForTier(tier);
  if (reasoning && body.reasoning_effort === undefined) {
    body.reasoning_effort = reasoning;
  }
  // OpenAI reasoning models (gpt-5.x/o-series) reject the legacy knobs
  // clients still send: max_tokens must be max_completion_tokens, and only
  // the default sampling params are accepted.
  if (/^(gpt-5|o[0-9])/.test(String(body.model))) {
    if (body.max_tokens !== undefined) {
      if (body.max_completion_tokens === undefined) {
        body.max_completion_tokens = body.max_tokens;
      }
      delete body.max_tokens;
    }
    if (body.temperature !== undefined && body.temperature !== 1) {
      delete body.temperature;
    }
    if (body.top_p !== undefined && body.top_p !== 1) {
      delete body.top_p;
    }
  }
  const streaming = body.stream === true;
  if (streaming) {
    body.stream_options = { ...(body.stream_options as object), include_usage: true };
  }

  const upstream = await fetch(
    `${env.modelProviderBaseUrl()}/${path.join("/")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.modelProviderApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!upstream.ok || !upstream.body) {
    const errorBody = await upstream.text();
    return new NextResponse(errorBody, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (streaming) {
    const stream = meteringTee(upstream.body, (usage) => {
      after(meter(userId, tier, usage));
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  const json = (await upstream.json()) as { usage?: Usage };
  if (json.usage) {
    const usage = json.usage;
    after(meter(userId, tier, usage));
  }
  return NextResponse.json(json, { status: 200 });
}
