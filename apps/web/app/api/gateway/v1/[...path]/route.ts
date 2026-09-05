/**
 * The OpenAI-compatible inference gateway (goal.md M1 §3).
 *
 * The only holder of model-provider keys. Boxes authenticate with their
 * per-box GATEWAY_TOKEN; the speed tier is resolved server-side to a real
 * model ID; spend caps are enforced with 429; the upstream stream passes
 * through unmodified while usage is metered into agent_runs.
 *
 * A second principal (goal-create-v11 §11.3, CR8): a Functions Worker's
 * runtime token (`art_…`, arriving through the Outbound Worker) resolves to
 * the app's owner. It may only name `fast|balanced|deep`, is metered as
 * `trigger='app'`, `label=<slug>`, and hits the app's own daily cap before
 * the owner's monthly one.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { asRecord } from "@/lib/records";
import { serviceClient } from "@/lib/supabase";
import {
  clampCreateTier,
  costUsd,
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  isCreateModelRequest,
  isReasoningModel,
  isSpeedTier,
  modelForCreateTier,
  modelForSelection,
  parseCreateModel,
  parseLegacyCreateTier,
  providerForFamily,
  reasoningForTier,
  serviceTierForTier,
  type CreateModelRequest,
  type ModelFamily,
  type ModelSelection,
} from "@/lib/entitlements/models";
import { currentPeriodSpend } from "@/lib/entitlements/spend";
import { getProviderKey, PROVIDER_LABELS } from "@/lib/providers/keys";
import {
  budgetExhausted,
  createRunAttributable,
  createRunLabel,
  projectBudget,
  soleAttributableCreateSlug,
} from "@/lib/create/budget";
import {
  appCapReached,
  authenticateRuntimeToken,
  isRuntimeModel,
  recordAppSpend,
  RUNTIME_MODELS,
  type RuntimePrincipal,
} from "@/lib/functions/runtime";
import { recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 1500;

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Router decision facts recorded alongside usage — the admin trace row. */
interface RouteTrace {
  requestedModel: string | null;
  reasoningEffort: string | null;
  startedAtMs: number;
  /** The entitled family, which differs from the served one on a fallback. */
  requestedFamily: ModelFamily;
  /** `create:<slug>` when the completion is a Create turn's; drives the
   * per-project budget (goal-create-v11 §9.1). */
  label?: string | null;
  /** Set for a Functions Worker's call: `trigger='app'`, spend also lands
   * on the app's daily counter (CR8). */
  app?: { id: string } | null;
}

async function meter(
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
  if (trace?.app) await recordAppSpend(supabase, trace.app.id, cost);
}

/** Runtime tokens are prefixed so the two principals never share a lookup. */
function isRuntimeBearer(token: string): boolean {
  return token.startsWith("art_");
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
  let userId: string;
  let app: RuntimePrincipal | null = null;
  if (isRuntimeBearer(token)) {
    app = await authenticateRuntimeToken(supabase, token);
    if (!app) return unauthorized();
    userId = app.userId;
  } else {
    const { data: box } = await supabase
      .from("boxes")
      .select("user_id")
      .eq("gateway_token", token)
      .maybeSingle();
    if (!box) return unauthorized();
    userId = box.user_id as string;
  }

  // Only the metered completion endpoint is proxied (review 2026-08 P1-1);
  // any other upstream path would carry the platform key without metering.
  if (path.join("/") !== "chat/completions") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // The app's own cap comes first (CR8): a runaway Worker stops at its
  // owner-approved dollar figure, never at the owner's whole month.
  if (app && appCapReached(app.functions)) {
    await recordOpsEvent(supabase, "fn_capped", userId, app.slug);
    return NextResponse.json(
      { error: "insufficient_quota", reason: "fn_capped" },
      { status: 429 }
    );
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
  const entitledTier = isSpeedTier(tierValue) ? tierValue : "balanced";
  // A user who never touched the setting gets Ox Alpha, not OpenAI.
  const familyValue = String(entitlement.model_family ?? "");
  const family = isModelFamily(familyValue) ? familyValue : DEFAULT_MODEL_FAMILY;
  const selection: ModelSelection = {
    openrouterModel: (entitlement.openrouter_model as string | null) ?? null,
    veniceModel: (entitlement.venice_model as string | null) ?? null,
  };

  // Personal provider keys (Settings): when saved, the request is served on
  // the user's own token spend and platform metering records zero cost. The
  // app principal never rides them — its daily cap (CR8) only binds when the
  // spend is metered.
  const personalKeys = app
    ? { openrouter: null, venice: null, gmi: null }
    : {
        openrouter: await getProviderKey(supabase, userId, "openrouter").catch(
          () => null
        ),
        venice: await getProviderKey(supabase, userId, "venice").catch(() => null),
        gmi: await getProviderKey(supabase, userId, "gmi").catch(() => null),
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

  // Delegated child runs pin `model: "fast"` (delegation.model in the box
  // config), which must actually land on the fast lane. Only the cheapest
  // tier is honored from the request: box config may downgrade a call below
  // the user's Settings tier, never upgrade it (spend stays entitlement-
  // bounded), and the box's static `model.default: "balanced"` keeps
  // resolving through the entitlement as before.
  // Create turns (goal-create-v11 §9.1) ask for `create-<tier>:<slug>`:
  // clamped to the entitlement the same way, resolved on the Create tier
  // family and always served by OpenAI whatever the owner's chat family is.
  // The slug names the project the call is charged to; it must belong to
  // this owner and have a Create run open (or just closed), so the family is
  // only reachable from inside a Create run and two projects running at once
  // each meter their own calls. The project's budget is checked against its
  // own metered rows before the upstream call.
  // A Functions Worker names a tier and nothing else (§11.3): no Create
  // family, no bare model ID; the tier is clamped to the owner's entitlement.
  if (app && !isRuntimeModel(rawBody["model"])) {
    return NextResponse.json(
      { error: "unknown_model", allowed: [...RUNTIME_MODELS] },
      { status: 400 }
    );
  }
  const appTier =
    app && isRuntimeModel(rawBody["model"])
      ? clampCreateTier(rawBody["model"], entitledTier)
      : null;
  let createModel: CreateModelRequest | null = app
    ? null
    : parseCreateModel(rawBody["model"]);
  if (!app && createModel === null && isCreateModelRequest(rawBody["model"])) {
    const legacyTier = parseLegacyCreateTier(rawBody["model"]);
    if (legacyTier === null) {
      return NextResponse.json(
        { error: "invalid_request", reason: "create_project_required" },
        { status: 400 }
      );
    }
    // Transitional (see parseLegacyCreateTier): a project-less call can
    // only be charged when exactly one of the owner's projects could have
    // made it; with none, or two candidates, it is refused rather than
    // charged to the wrong one.
    const slug = await soleAttributableCreateSlug(supabase, userId);
    if (slug === null) {
      return NextResponse.json(
        { error: "forbidden", reason: "create_run_required" },
        { status: 403 }
      );
    }
    createModel = { tier: legacyTier, slug };
  }
  const createTier = createModel?.tier ?? null;
  const tier =
    appTier !== null
      ? appTier
      : createTier !== null
        ? clampCreateTier(createTier, entitledTier)
        : rawBody["model"] === "fast"
          ? "fast"
          : entitledTier;
  let createLabel: string | null = null;
  if (createModel !== null) {
    const { slug } = createModel;
    if (!(await createRunAttributable(supabase, userId, slug))) {
      return NextResponse.json(
        { error: "forbidden", reason: "create_run_required" },
        { status: 403 }
      );
    }
    createLabel = createRunLabel(slug);
    const meter = await projectBudget(supabase, userId, slug);
    if (meter && budgetExhausted(meter)) {
      return NextResponse.json(
        { error: "insufficient_quota", reason: "create_budget" },
        { status: 429 }
      );
    }
  }

  const requestStartedMs = Date.now();
  const requestedModel =
    typeof rawBody["model"] === "string" ? (rawBody["model"] as string) : null;
  let servedModel = "";
  let servedReasoning: string | null = null;
  let servedOnPersonalKey = false;

  const dispatch = async (
    toFamily: ModelFamily
  ): Promise<Response> => {
    // The tier and family names are the only things that ever appear in a
    // box's config — the real model ID is resolved here and only here.
    const body: Record<string, unknown> = { ...rawBody };
    body["model"] =
      createTier !== null
        ? modelForCreateTier(tier)
        : modelForSelection(toFamily, tier, selection);
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
      servedReasoning =
        typeof body["reasoning_effort"] === "string"
          ? (body["reasoning_effort"] as string)
          : null;
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

    let baseUrl: string;
    let personalKey: string | null;
    let platformKey: string | null;
    let providerLabel: string;
    switch (provider) {
      case "gmi":
        baseUrl = env.gmiInferenceBaseUrl();
        personalKey = personalKeys.gmi;
        platformKey = env.gmiCloudApiKey();
        providerLabel = PROVIDER_LABELS.gmi;
        break;
      case "venice":
        baseUrl = env.veniceBaseUrl();
        personalKey = personalKeys.venice;
        platformKey = env.veniceApiKey();
        providerLabel = PROVIDER_LABELS.venice;
        break;
      case "openrouter":
        baseUrl = env.openRouterBaseUrl();
        personalKey = personalKeys.openrouter;
        platformKey = env.openRouterApiKey();
        providerLabel = PROVIDER_LABELS.openrouter;
        break;
      case "openai":
        baseUrl = env.modelProviderBaseUrl();
        personalKey = null;
        platformKey = env.modelProviderApiKey();
        providerLabel = "OpenAI";
        break;
    }
    const apiKey = personalKey ?? platformKey;
    servedOnPersonalKey = personalKey !== null;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: {
            message:
              `${providerLabel} isn't configured — add a personal ${providerLabel} API key in Settings.`,
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

  // The Create family is OpenAI-only: the owner's chat family never applies.
  let servedFamily: ModelFamily = createTier !== null ? "openai" : family;
  let upstream = await dispatch(servedFamily);

  // Non-OpenAI families can degrade to empty completions (e.g. an endpoint
  // answering tool-bearing calls with `native_finish_reason: "network_error"`
  // and a null message). The box would otherwise retry into the same wall and
  // the user gets silence, so a dead or empty upstream falls back once to the
  // tier-resolved OpenAI model.
  // An unconfigured provider is a user-facing settings problem, not a dead
  // upstream — surface the 503 instead of silently answering with OpenAI.
  if (upstream.headers.get("X-Provider-Unconfigured") === "1") {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const canFallBack = providerForFamily(servedFamily) !== "openai";
  if (
    canFallBack &&
    [429, 500, 502, 503, 504].includes(upstream.status)
  ) {
    console.warn(
      JSON.stringify({
        msg: "gateway upstream retry",
        user_id: userId,
        family,
        model: servedModel,
        status: upstream.status,
      })
    );
    await upstream.body?.cancel().catch(() => undefined);
    if (RETRY_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    upstream = await dispatch(servedFamily);
  }
  if (canFallBack && (!upstream.ok || !upstream.body)) {
    console.warn(
      JSON.stringify({
        msg: "gateway upstream rejected",
        user_id: userId,
        family,
        model: servedModel,
        status: upstream.status,
        detail: (await upstream.clone().text().catch(() => "")).slice(0, 400),
      })
    );
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

  // Streamed non-OpenAI answers get the same empty check: the whole SSE body
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
    const meteredTrace: RouteTrace = {
      requestedModel,
      reasoningEffort: servedReasoning,
      startedAtMs: requestStartedMs,
      requestedFamily: createTier !== null ? "openai" : family,
      label: app ? app.slug : createLabel,
      app: app ? { id: app.appId } : null,
    };
    const stream = meteringTee(upstream.body, (usage) => {
      after(
        meter(
          userId,
          tier,
          meteredFamily,
          usage,
          meteredModel,
          meteredPersonal,
          meteredTrace
        )
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
      meter(userId, tier, servedFamily, usage, servedModel, servedOnPersonalKey, {
        requestedModel,
        reasoningEffort: servedReasoning,
        startedAtMs: requestStartedMs,
        requestedFamily: createTier !== null ? "openai" : family,
        label: app ? app.slug : createLabel,
        app: app ? { id: app.appId } : null,
      })
    );
  }
  return NextResponse.json(json, { status: 200 });
}
