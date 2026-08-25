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
import { asRecord } from "@/lib/records";
import { serviceClient } from "@/lib/supabase";
import {
  costUsd,
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  isReasoningModel,
  isSpeedTier,
  modelForSelection,
  providerForFamily,
  reasoningForTier,
  serviceTierForTier,
  type ModelFamily,
  type ModelSelection,
} from "@/lib/entitlements/models";
import { currentPeriodSpend } from "@/lib/entitlements/spend";
import { getProviderKey } from "@/lib/providers/keys";

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
  family: ModelFamily,
  usage: Usage,
  model?: string,
  /** Served on the user's own provider key — their spend, cost 0 here. */
  onPersonalKey = false
): Promise<void> {
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cost = onPersonalKey
    ? 0
    : costUsd(tier, promptTokens, completionTokens, family, model);
  const supabase = serviceClient();
  const { error: runError } = await supabase.from("agent_runs").insert({
    user_id: userId,
    trigger: null,
    ended_at: new Date().toISOString(),
    outcome: "gateway_completion",
    cost_usd: cost,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
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

  // Only the metered completion endpoint is proxied (review 2026-08 P1-1);
  // any other upstream path would carry the platform key without metering.
  if (path.join("/") !== "chat/completions") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: entitlement } = await supabase
    .from("entitlements")
    .select(
      "speed_tier, model_family, openrouter_model, venice_model, monthly_cap_usd, spend_mtd_usd, spend_period_start, suspended_reason"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!entitlement || entitlement.suspended_reason) return unauthorized();
  const spend = await currentPeriodSpend(supabase, userId, {
    spend_mtd_usd: entitlement.spend_mtd_usd as number | string,
    spend_period_start: String(entitlement.spend_period_start),
  });
  if (spend >= Number(entitlement.monthly_cap_usd)) {
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
  // A user who never touched the setting gets Ox Alpha, not OpenAI.
  const familyValue = String(entitlement.model_family ?? "");
  const family = isModelFamily(familyValue) ? familyValue : DEFAULT_MODEL_FAMILY;
  const selection: ModelSelection = {
    openrouterModel: (entitlement.openrouter_model as string | null) ?? null,
    veniceModel: (entitlement.venice_model as string | null) ?? null,
  };

  // Personal provider keys (Settings): when saved, the request is served on
  // the user's own token spend and platform metering records zero cost.
  const personalKeys = {
    openrouter: await getProviderKey(supabase, userId, "openrouter").catch(
      () => null
    ),
    venice: await getProviderKey(supabase, userId, "venice").catch(() => null),
  };

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const rawBody = asRecord(parsedBody);
  if (!rawBody) {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const streaming = rawBody["stream"] === true;
  const endpoint = path.join("/");

  let servedModel = "";
  let servedOnPersonalKey = false;

  const dispatch = async (
    toFamily: ModelFamily
  ): Promise<Response> => {
    // The tier and family names are the only things that ever appear in a
    // box's config — the real model ID is resolved here and only here.
    const body: Record<string, unknown> = { ...rawBody };
    body["model"] = modelForSelection(toFamily, tier, selection);
    servedModel = String(body["model"]);
    // gpt-5.6 on /v1/chat/completions rejects function tools with any
    // reasoning_effort other than "none", so tool-bearing calls (every Hermes
    // agent turn) pin it there; plain completions get the configured effort.
    // Non-reasoning models reject the field entirely, so it is only injected
    // for families that accept it.
    if (isReasoningModel(String(body["model"]))) {
      const hasTools = Array.isArray(body["tools"]) && body["tools"].length > 0;
      const reasoning = hasTools ? "none" : reasoningForTier(tier);
      if (reasoning && body["reasoning_effort"] === undefined) {
        body["reasoning_effort"] = reasoning;
      }
    }
    // service_tier is OpenAI-only, like reasoning_effort above.
    const provider = providerForFamily(toFamily);
    const openRouter = provider === "openrouter";
    const serviceTier = provider === "openai" ? serviceTierForTier(tier) : undefined;
    if (serviceTier && body["service_tier"] === undefined) {
      body["service_tier"] = serviceTier;
    }
    // OpenAI reasoning models (gpt-5.x/o-series) reject the legacy knobs
    // clients still send: max_tokens must be max_completion_tokens, and only
    // the default sampling params are accepted.
    if (isReasoningModel(String(body["model"]))) {
      if (body["max_tokens"] !== undefined) {
        if (body["max_completion_tokens"] === undefined) {
          body["max_completion_tokens"] = body["max_tokens"];
        }
        delete body["max_tokens"];
      }
      if (body["temperature"] !== undefined && body["temperature"] !== 1) {
        delete body["temperature"];
      }
      if (body["top_p"] !== undefined && body["top_p"] !== 1) {
        delete body["top_p"];
      }
    }
    if (streaming) {
      body["stream_options"] = { ...(body["stream_options"] as object), include_usage: true };
    }

    const baseUrl =
      provider === "venice"
        ? env.veniceBaseUrl()
        : openRouter
          ? env.openRouterBaseUrl()
          : env.modelProviderBaseUrl();
    const personalKey =
      provider === "venice"
        ? personalKeys.venice
        : openRouter
          ? personalKeys.openrouter
          : null;
    const platformKey =
      provider === "venice"
        ? env.veniceApiKey()
        : openRouter
          ? env.openRouterApiKey()
          : env.modelProviderApiKey();
    const apiKey = personalKey ?? platformKey;
    servedOnPersonalKey = personalKey !== null;
    if (!apiKey) {
      // Venice has no platform key on this deployment and the user saved
      // none — an explicit 503 beats an opaque upstream 401.
      return new Response(
        JSON.stringify({
          error: {
            message:
              "Venice isn't configured — add a personal Venice API key in Settings.",
            type: "provider_unconfigured",
          },
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "X-Provider-Unconfigured": "1",
          },
        }
      );
    }
    return fetch(`${baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter attribution (ignored by other upstreams).
        ...(openRouter
          ? {
              "HTTP-Referer": env.appOrigin(),
              "X-OpenRouter-Title": "AIR",
            }
          : {}),
      },
      body: JSON.stringify(body),
    });
  };

  let servedFamily = family;
  let upstream = await dispatch(family);

  // OpenRouter families can degrade to empty completions (e.g. a stealth
  // endpoint answering tool-bearing calls with `native_finish_reason:
  // "network_error"` and a null message). The box would otherwise retry into
  // the same wall and the user gets silence, so a dead or empty OpenRouter
  // (or Venice) answer falls back once to the tier-resolved OpenAI model.
  // An unconfigured provider is a user-facing settings problem, not a dead
  // upstream — surface the 503 instead of silently answering with OpenAI.
  if (upstream.headers.get("X-Provider-Unconfigured") === "1") {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const canFallBack = providerForFamily(family) !== "openai";
  if (canFallBack && (!upstream.ok || !upstream.body)) {
    servedFamily = "openai";
    upstream = await dispatch(servedFamily);
  } else if (canFallBack && !streaming) {
    const parsed = (await upstream.clone().json().catch(() => null)) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: unknown[];
          reasoning?: string | null;
        };
      }[];
    } | null;
    const choice = parsed?.choices?.[0];
    const message = choice?.message;
    const empty =
      choice !== undefined &&
      (message == null ||
        (!message.content &&
          !message.reasoning &&
          !(Array.isArray(message.tool_calls) && message.tool_calls.length > 0)));
    if (parsed === null || empty) {
      servedFamily = "openai";
      upstream = await dispatch(servedFamily);
    }
  }

  if (!upstream.ok || !upstream.body) {
    const errorBody = await upstream.text();
    return new NextResponse(errorBody, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Streamed OpenRouter answers get the same empty check: the whole SSE body
  // is buffered (these families answer in one burst) and replayed, or
  // replaced by an OpenAI stream when no delta ever carried content.
  if (streaming && servedFamily !== "openai" && canFallBack) {
    const raw = new Uint8Array(await upstream.clone().arrayBuffer());
    const text = new TextDecoder().decode(raw);
    let sawContent = false;
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
              reasoning?: string | null;
            };
          }[];
        };
        const delta = parsed.choices?.[0]?.delta;
        if (
          delta &&
          (delta.content ||
            delta.reasoning ||
            (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0))
        ) {
          sawContent = true;
          break;
        }
      } catch {
        // non-JSON keepalive; ignore
      }
    }
    if (!sawContent) {
      servedFamily = "openai";
      upstream = await dispatch(servedFamily);
      if (!upstream.ok || !upstream.body) {
        const errorBody = await upstream.text();
        return new NextResponse(errorBody, {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  if (streaming) {
    const meteredFamily = servedFamily;
    const meteredModel = servedModel;
    const meteredPersonal = servedOnPersonalKey;
    const stream = meteringTee(upstream.body, (usage) => {
      after(
        meter(userId, tier, meteredFamily, usage, meteredModel, meteredPersonal)
      );
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
    after(
      meter(userId, tier, servedFamily, usage, servedModel, servedOnPersonalKey)
    );
  }
  return NextResponse.json(json, { status: 200 });
}
