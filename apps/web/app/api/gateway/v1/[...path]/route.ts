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
  createEffortFor,
  createProviderFor,
  DEFAULT_MODEL_FAMILY,
  gmiReasoningEffort,
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
  type CreateStage,
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
  releaseAppSpend,
  reserveAppSpend,
  RUNTIME_MODELS,
  settleAppSpend,
  type AppHold,
  type RuntimePrincipal,
} from "@/lib/functions/runtime";
import { recordOpsEvent } from "@/lib/security/limits";
import {
  fromResponsesResponse,
  responsesStreamToChat,
  toResponsesRequest,
} from "@/lib/gateway/responses";
import { fetchWithHeaderTimeout } from "@/lib/http/timeout";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 1500;
// User-facing iMessage turns cannot wait several minutes for Astra. Give it
// most of the completion window, then finish the same request on GLM through
// the same GMI key. Every subsequent GMI attempt shares the hard deadline.
const GMI_TURN_BUDGET_MS = 44_000;
const GMI_ASTRA_BUDGET_MS = 30_000;
const GMI_ASTRA_MODEL = "openai/gpt-6-astra";
const GMI_RECOVERY_MODEL = "zai-org/GLM-5.3-Flash";
// The box sees abstract tier IDs whose concrete provider model can change.
// Advertise a conservative common window so Hermes does not misclassify our
// custom gateway as Ollama, probe /api/show, then assume an unsafe 256K.
const GATEWAY_CONTEXT_LENGTH = 128_000;

type Json = Record<string, unknown>;

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error || error instanceof DOMException)) return false;
  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /timed?\s*out|timeout/i.test(error.message)
  );
}

// Task-type routing for the gmi family (goal-gmi-models Phase 2): a turn
// that opens with a short user message carrying no depth cue and no
// money/publish cue is routine work — draft an email, check the calendar,
// quick lookup — and rides the fast lane (GLM-5.3-Flash) instead of the
// entitled tier. The rule only ever downgrades, so spend stays
// entitlement-bounded; it mirrors the deterministic half of the box's
// shadow taskrouter (infra/template/taskrouter) until hermes can consult it
// per-turn upstream. Mid-turn continuations (the last message is a tool
// result, not the opener) keep the request's resolution, and a caller's
// explicit `model:"fast"` is unaffected either way. GMI_ROUTINE_FAST=off
// disables the rule.
const GMI_ROUTINE_MAX_CHARS = 280;
// Depth cues keep the entitled tier — these are the turns Astra is for.
const GMI_DEEP_TURN_RE =
  /\b(research|analy[sz]e|compare|plan(?:ning)?|strategy|debug|investigate|essay|whitepaper|refactor|architect)\b/i;
// Money movement and public publishing never ride the routine lane — the
// approval queue is the real control, but those turns keep the entitled
// model regardless.
const GMI_RISK_TURN_RE =
  /(\$\s?\d|\b(wire|venmo|zelle|paypal|checkout|charge|deposit|renew|reorder|refund|invoice|payment|purchase|transfer|delete|publish|tweet)\b)/i;

/** Text of the request's opening user message, or null for any other shape. */
function openingUserTurnText(body: Json): string | null {
  const messages = body["messages"];
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const last = messages[messages.length - 1];
  if (!last || typeof last !== "object") return null;
  const msg = last as { role?: unknown; content?: unknown };
  if (msg.role !== "user") return null;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    const text = (msg.content as { type?: unknown; text?: unknown }[])
      .map((part) =>
        part && part.type === "text" && typeof part.text === "string"
          ? part.text
          : ""
      )
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

/** True when a gmi request's opening user turn reads as routine work. */
function gmiRoutineTurn(body: Json): boolean {
  if (process.env["GMI_ROUTINE_FAST"] === "off") return false;
  const text = openingUserTurnText(body)?.trim();
  if (!text || text.length > GMI_ROUTINE_MAX_CHARS) return false;
  return !GMI_DEEP_TURN_RE.test(text) && !GMI_RISK_TURN_RE.test(text);
}

/**
 * Once a non-sensitive turn has a tool result, Astra has already made the
 * expensive planning decision. Let GLM interpret the result and choose the
 * next step so multi-tool iMessage turns do not pay Astra latency on every
 * loop. Money movement, checkout, deletion, and publishing remain on the
 * entitled model for the whole conversation.
 */
function gmiFastToolContinuation(body: Json): boolean {
  const messages = body["messages"];
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (!last || typeof last !== "object" || (last as { role?: unknown }).role !== "tool") {
    return false;
  }
  return !messages.some((message) => {
    if (!message || typeof message !== "object") return false;
    const row = message as { role?: unknown; content?: unknown };
    return (
      row.role === "user" &&
      typeof row.content === "string" &&
      GMI_RISK_TURN_RE.test(row.content)
    );
  });
}

/**
 * Temporary fleet-wide provider switch. Unlike changing every entitlement,
 * this preserves each user's saved preference and can be reversed without a
 * database migration. An override deliberately uses the platform provider
 * key so operations can move spend between platform credit pools.
 */
function gatewayModelFamilyOverride(): ModelFamily | null {
  const value = process.env["GATEWAY_MODEL_FAMILY_OVERRIDE"] ?? "";
  return isModelFamily(value) ? value : null;
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
  /** The Create role the turn was made for (`#<stage>`, V12 §7.3); null
   * when absent or not a Create turn. */
  createStage?: CreateStage | null;
  /** Set for a Functions Worker's call: `trigger='app'`, and the hold taken
   * before dispatch settles to the real cost on the app's daily counter
   * (CR8). */
  app?: { id: string; hold: AppHold } | null;
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
    create_stage: trace?.createStage ?? null,
    ...(trace?.label ? { label: trace.label } : {}),
  });
  if (runError) {
    log.error("agent_runs insert failed", {user_id: userId, error: runError.message});
  }
  if (trace && trace.requestedFamily !== family) {
    log.warn("gateway provider fallback", {user_id: userId,
        requested_family: trace.requestedFamily,
        served_family: family,
        served_model: model ?? null,});
  }
  const { error: spendError } = await supabase.rpc("add_spend", {
    p_user_id: userId,
    p_cost_usd: cost,
  });
  if (spendError) {
    log.error("add_spend failed", {user_id: userId, error: spendError.message});
  }
  if (trace?.app) await settleAppSpend(supabase, trace.app.hold, cost);
}

/** Runtime tokens are prefixed so the two principals never share a lookup. */
function isRuntimeBearer(token: string): boolean {
  return token.startsWith("art_");
}

/**
 * Watches the SSE pass-through for the final usage chunk without altering
 * it. `onEnd` fires exactly once when the stream closes: with the usage, or
 * null when no chunk carried one. A usage-less close means a Functions hold
 * is released — but when the stream errored the call did consume provider
 * spend, so `errored` lets the caller settle the reservation instead of
 * releasing it for free.
 */
function meteringTee(
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
      context_length: GATEWAY_CONTEXT_LENGTH,
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
  // owner-approved dollar figure, never at the owner's whole month. This is
  // the cheap deny on the row in hand; admission is the reservation below.
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
      "speed_tier, model_family, openrouter_model, venice_model, gmi_model, monthly_cap_usd, spend_mtd_usd, spend_period_start, suspended_reason"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!entitlement || entitlement.suspended_reason) return unauthorized();
  const familyOverride = gatewayModelFamilyOverride();
  const spend = await currentPeriodSpend(supabase, userId, {
    spend_mtd_usd: entitlement.spend_mtd_usd as number | string,
    spend_period_start: String(entitlement.spend_period_start),
  });
  const monthlyCapReached = spend >= Number(entitlement.monthly_cap_usd);

  const tierValue = String(entitlement.speed_tier);
  const entitledTier = isSpeedTier(tierValue) ? tierValue : "balanced";
  // A user who never touched the setting gets Ox Alpha, not OpenAI.
  const familyValue = String(entitlement.model_family ?? "");
  const family =
    familyOverride ??
    (isModelFamily(familyValue) ? familyValue : DEFAULT_MODEL_FAMILY);
  const selection: ModelSelection = {
    openrouterModel: (entitlement.openrouter_model as string | null) ?? null,
    veniceModel: (entitlement.venice_model as string | null) ?? null,
    gmiModel: (entitlement.gmi_model as string | null) ?? null,
  };

  // Personal provider keys (Settings): when saved, the request is served on
  // the user's own token spend and platform metering records zero cost. The
  // app principal never rides them — its daily cap (CR8) only binds when the
  // spend is metered.
  const personalKeys = app || familyOverride !== null
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
    createModel = { tier: legacyTier, slug, stage: null };
  }
  const createTier = createModel?.tier ?? null;
  const createStage: CreateStage | null = createModel?.stage ?? null;
  // A fleet-wide GMI switch spends prepaid GMI credits, so ordinary chat is
  // not stopped by AIR's platform-paid monthly cap. Explicit Create runs stay
  // OpenAI-only and therefore keep the cap.
  if (
    monthlyCapReached &&
    !(familyOverride === "gmi" && createTier === null)
  ) {
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
  const tier =
    appTier !== null
      ? appTier
      : createTier !== null
        ? clampCreateTier(createTier, entitledTier)
        : rawBody["model"] === "fast"
          ? "fast"
          : family === "gmi" &&
              (gmiRoutineTurn(rawBody) || gmiFastToolContinuation(rawBody))
            ? "fast"
            : entitledTier;
  // V12 §7.1 (CR18): a Create turn is served by the provider of its resolved
  // slug — GMI for the defaults (Astra plans, GLM builds), OpenAI for an
  // operator override naming an OpenAI slug — never by the owner's chat
  // family. The family it is metered under follows the same choice so
  // cost_usd prices by served slug on the GMI branch.
  const createProvider = createTier !== null ? createProviderFor(modelForCreateTier(tier)) : null;
  const createFamily: ModelFamily = createProvider === "gmi" ? "gmi" : "openai";
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
      // §12: the operator counts exhausted Create budgets from this row.
      await recordOpsEvent(supabase, "rate_limited", userId, "create_budget");
      return NextResponse.json(
        { error: "insufficient_quota", reason: "create_budget" },
        { status: 429 }
      );
    }
  }

  // Reserve-then-dispatch (CR8): admission and the hold are one statement,
  // so two calls racing under the cap cannot both pass on a stale read. The
  // hold is handed to meter() (settled to the real cost) or released.
  let hold: AppHold | null = null;
  if (app) {
    const reservation = await reserveAppSpend(supabase, app.functions, tier);
    if (reservation.status === "capped") {
      await recordOpsEvent(supabase, "fn_capped", userId, app.slug);
      return NextResponse.json(
        { error: "insufficient_quota", reason: "fn_capped" },
        { status: 429 }
      );
    }
    if (reservation.status === "unavailable") {
      return NextResponse.json(
        { error: "cap_unavailable", reason: "fn_reserve" },
        { status: 503 }
      );
    }
    hold = reservation.hold;
  }
  const takeHold = (): AppHold | null => {
    const taken = hold;
    hold = null;
    return taken;
  };
  const release = (): void => {
    const taken = takeHold();
    if (taken) after(releaseAppSpend(supabase, taken));
  };
  const appTrace = (taken: AppHold | null): { id: string; hold: AppHold } | null =>
    app && taken ? { id: app.appId, hold: taken } : null;

  const requestStartedMs = Date.now();
  const gmiDeadlineMs = requestStartedMs + GMI_TURN_BUDGET_MS;
  const requestedModel =
    typeof rawBody["model"] === "string" ? (rawBody["model"] as string) : null;
  let servedModel = "";
  let servedReasoning: string | null = null;
  let servedOnPersonalKey = false;
  /** True while the in-flight dispatch is talking to upstream /responses. */
  let servedViaResponses = false;
  /** Set after Astra exhausts its latency budget; later retries stay on GLM. */
  let gmiRecoveryModel: string | null = null;

  const dispatchOnce = async (
    toFamily: ModelFamily,
    preferResponses = true
  ): Promise<Response> => {
    // The tier and family names are the only things that ever appear in a
    // box's config — the real model ID is resolved here and only here.
    const body: Record<string, unknown> = { ...rawBody };
    const provider = createProvider ?? providerForFamily(toFamily);
    body["model"] =
      provider === "gmi" && gmiRecoveryModel
        ? gmiRecoveryModel
        : createTier !== null
          ? modelForCreateTier(tier)
          : modelForSelection(toFamily, tier, selection);
    servedModel = String(body["model"]);
    servedViaResponses = false;
    // service_tier is OpenAI-only, like reasoning_effort.
    const openRouter = provider === "openrouter";
    const serviceTier = provider === "openai" ? serviceTierForTier(tier) : undefined;
    if (serviceTier && body["service_tier"] === undefined) {
      body["service_tier"] = serviceTier;
    }
    const reasoningModel = isReasoningModel(String(body["model"]));
    if (provider === "openai" && reasoningModel && preferResponses) {
      // /responses accepts tools + reasoning.effort together, which
      // /chat/completions does not — every agent turn carries tools, so the
      // OpenAI lane is always served through it. A caller-set
      // reasoning_effort wins over the tier default, as on the chat lane.
      servedReasoning =
        (typeof body["reasoning_effort"] === "string"
          ? (body["reasoning_effort"] as string)
          : reasoningForTier(tier)) ?? null;
      servedViaResponses = true;
    } else {
      // gpt-5.6 on /v1/chat/completions rejects function tools with any
      // reasoning_effort other than "none", so tool-bearing calls on the
      // non-Responses fallback pin it there; plain completions get the
      // configured effort. Non-reasoning models reject the field entirely,
      // so it is only injected for families that accept it.
      if (reasoningModel) {
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
      // OpenAI reasoning models (gpt-5.x/o-series) reject the legacy knobs
      // clients still send: max_tokens must be max_completion_tokens, and
      // only the default sampling params are accepted. The Responses
      // translation renames/strips them itself.
      if (reasoningModel) {
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
      if (provider === "gmi") {
        // GMI's OpenAI-prefixed slugs (astra/luna/terra) normalize max_tokens
        // to max_completion_tokens upstream and reject values under their
        // floor — send the name they actually validate so a small cap does
        // not come back as a 400.
        if (String(body["model"]).startsWith("openai/")) {
          if (body["max_tokens"] !== undefined) {
            if (body["max_completion_tokens"] === undefined) {
              body["max_completion_tokens"] = body["max_tokens"];
            }
            delete body["max_tokens"];
          }
          // …and they 400 on tools + reasoning_effort, caller-set or not —
          // forward it and the request silently lands on the OpenAI
          // fallback instead of the GMI model the owner picked.
          if (Array.isArray(body["tools"]) && body["tools"].length > 0) {
            delete body["reasoning_effort"];
          }
        }
        // A Create turn's effort is the role's (§7.1): build effort for the
        // Builder, low for the Reviewer, none for the Planner. Set first so
        // the fleet GLM default below never overrides it.
        const createEffort =
          createTier !== null ? createEffortFor(tier, String(body["model"])) : undefined;
        if (createEffort && body["reasoning_effort"] === undefined) {
          body["reasoning_effort"] = createEffort;
        }
        // GLM-5.3-Flash's reasoning is mandatory; "low" collapses
        // reasoning_tokens to ~1 (verified live). Only zai-org/* slugs get
        // the field — openai/* + tools + reasoning_effort 400s upstream.
        const gmiEffort = gmiReasoningEffort(String(body["model"]));
        if (gmiEffort && body["reasoning_effort"] === undefined) {
          body["reasoning_effort"] = gmiEffort;
        }
        servedReasoning =
          typeof body["reasoning_effort"] === "string"
            ? (body["reasoning_effort"] as string)
            : null;
      }
      if (streaming) {
        body["stream_options"] = { ...(body["stream_options"] as object), include_usage: true };
      }
    }
    const upstreamPath = servedViaResponses ? "responses" : endpoint;
    const upstreamBody = servedViaResponses
      ? toResponsesRequest(body, servedReasoning ?? undefined)
      : body;

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
    const gmiRemainingMs = Math.max(1, gmiDeadlineMs - Date.now());
    const gmiAttemptMs =
      servedModel === GMI_ASTRA_MODEL
        ? Math.min(GMI_ASTRA_BUDGET_MS, gmiRemainingMs)
        : gmiRemainingMs;
    const request: RequestInit = {
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
      body: JSON.stringify(upstreamBody),
    };
    const url = `${baseUrl}/${upstreamPath}`;
    // For GMI, this is deliberately a headers deadline, not an overall
    // request signal: aborting a healthy SSE body at 44 seconds created the
    // retry loop seen by iMessage users during long web and Create turns.
    return provider === "gmi"
      ? fetchWithHeaderTimeout(url, request, gmiAttemptMs)
      : fetch(url, request);
  };

  const dispatch = async (
    toFamily: ModelFamily,
    preferResponses = true
  ): Promise<Response> => {
    const upstream = await dispatchOnce(toFamily, preferResponses);
    // An upstream that fronts chat/completions but not /responses (an older
    // relay or an incompatible proxy) 4xxs the translated call; retry once
    // through the pinned chat lane rather than failing the turn. This runs
    // on every OpenAI dispatch, including provider-fallback ones.
    if (
      preferResponses &&
      servedViaResponses &&
      !upstream.ok &&
      [400, 404, 405, 422].includes(upstream.status)
    ) {
      log.warn("gateway responses unsupported, using chat/completions", {user_id: userId,
          model: servedModel,
          status: upstream.status,});
      await upstream.body?.cancel().catch(() => undefined);
      return dispatchOnce(toFamily, false);
    }
    return upstream;
  };

  // Every path out of here either meters (the hold settles to the real
  // cost in meter()) or releases the hold: an upstream error, a stream that
  // closed without a usage chunk, or an exception.
  const proxy = async (): Promise<Response> => {
    // A Create turn runs on its slug's provider (§7.1): the owner's chat
    // family never applies.
    let servedFamily: ModelFamily = createTier !== null ? createFamily : family;
    const recoverTimedOutAstra = async (error: unknown): Promise<Response> => {
      if (
        providerForFamily(servedFamily) === "gmi" &&
        servedModel === GMI_ASTRA_MODEL &&
        isTimeoutError(error) &&
        Date.now() < gmiDeadlineMs
      ) {
        log.warn("gateway gmi astra latency fallback", {user_id: userId,
            from_model: GMI_ASTRA_MODEL,
            to_model: GMI_RECOVERY_MODEL,
            elapsed_ms: Date.now() - requestStartedMs,});
        gmiRecoveryModel = GMI_RECOVERY_MODEL;
        return dispatch(servedFamily);
      }
      throw error;
    };

    const recoverRejectedAstra = async (response: Response): Promise<Response> => {
      if (
        providerForFamily(servedFamily) === "gmi" &&
        servedModel === GMI_ASTRA_MODEL &&
        [400, 422].includes(response.status) &&
        Date.now() < gmiDeadlineMs
      ) {
        log.warn("gateway gmi astra compatibility fallback", {user_id: userId,
            from_model: GMI_ASTRA_MODEL,
            to_model: GMI_RECOVERY_MODEL,
            status: response.status,
            elapsed_ms: Date.now() - requestStartedMs,});
        await response.body?.cancel().catch(() => undefined);
        gmiRecoveryModel = GMI_RECOVERY_MODEL;
        return dispatch(servedFamily);
      }
      return response;
    };

    let upstream: Response;
    try {
      upstream = await dispatch(servedFamily);
    } catch (error) {
      upstream = await recoverTimedOutAstra(error);
    }
    // Astra's compatibility layer can accept an initial tool turn but reject
    // a later tool-result continuation with a generic 400. Keep the fleet on
    // the prepaid GMI lane and finish that exact request on GLM instead of
    // handing Hermes a terminal provider error and re-running the whole job.
    upstream = await recoverRejectedAstra(upstream);

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
    const nonOpenAiProvider = providerForFamily(servedFamily) !== "openai";
    // During an operations override, never leak spend back to OpenAI. GMI is
    // still retried once for transient failures, then its error is surfaced.
    // A Create turn on GMI stays on its lane the same way (CR18: neither
    // role flips providers); Astra's latency/compatibility recovery to GLM
    // above still applies to it.
    const canFallBack = nonOpenAiProvider && familyOverride === null && createTier === null;
    if (
      nonOpenAiProvider &&
      [429, 500, 502, 503, 504].includes(upstream.status)
    ) {
      log.warn("gateway upstream retry", {user_id: userId,
          family,
          model: servedModel,
          status: upstream.status,});
      await upstream.body?.cancel().catch(() => undefined);
      if (RETRY_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      upstream = await dispatch(servedFamily);
    }
    if (canFallBack && (!upstream.ok || !upstream.body)) {
      log.warn("gateway upstream rejected", {user_id: userId,
          family,
          model: servedModel,
          status: upstream.status,
          detail: (await upstream.clone().text().catch(() => "")).slice(0, 400),});
      servedFamily = "openai";
      upstream = await dispatch(servedFamily);
    } else if (nonOpenAiProvider && upstream.ok && !streaming) {
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
        if (canFallBack) {
          servedFamily = "openai";
          upstream = await dispatch(servedFamily);
        } else {
          return NextResponse.json(
            {
              error: {
                message: `${servedFamily} returned an empty response`,
                type: "upstream_empty_response",
              },
            },
            { status: 502 }
          );
        }
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
    // replaced by an OpenAI stream when no delta carried user-visible content
    // or a tool call. Reasoning alone is not an answer: accepting it leaves
    // Hermes with an empty final_response and the iMessage turn retries forever.
    if (streaming && servedFamily !== "openai" && nonOpenAiProvider) {
      const carriesAssistantWork = async (response: Response): Promise<boolean> => {
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
      };
      let hasAssistantWork: boolean;
      try {
        hasAssistantWork = await carriesAssistantWork(upstream);
      } catch (error) {
        await upstream.body?.cancel().catch(() => undefined);
        upstream = await recoverTimedOutAstra(error);
        hasAssistantWork = await carriesAssistantWork(upstream);
      }
      if (!hasAssistantWork) {
        log.warn("gateway response missing user-visible work", {user_id: userId,
            family: servedFamily,
            model: servedModel,
            streaming: true,});
        await upstream.body?.cancel().catch(() => undefined);
        if (canFallBack) {
          servedFamily = "openai";
          upstream = await dispatch(servedFamily);
          if (!upstream.ok || !upstream.body) {
            const errorBody = await upstream.text();
            return new NextResponse(errorBody, {
              status: upstream.status,
              headers: { "Content-Type": "application/json" },
            });
          }
        } else {
          // The fleet GMI override cannot spill to OpenAI, but a reasoning-only
          // completion is often a transient output-limit/provider edge. Retry
          // once on GMI before surfacing a controlled error to the box.
          upstream = await dispatch(servedFamily);
          if (!upstream.ok || !upstream.body) {
            const errorBody = await upstream.text();
            return new NextResponse(errorBody, {
              status: upstream.status,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!(await carriesAssistantWork(upstream))) {
            await upstream.body.cancel().catch(() => undefined);
            return NextResponse.json(
              {
                error: {
                  message: `${servedFamily} returned no user-visible response`,
                  type: "upstream_empty_response",
                },
              },
              { status: 502 }
            );
          }
        }
      }
    }

    // A latency recovery dispatch can itself return an upstream error. The
    // earlier status check ran before stream validation, so repeat the guard
    // before handing the body to the metering/translation pipeline.
    if (!upstream.ok || !upstream.body) {
      const errorBody = await upstream.text();
      return new NextResponse(errorBody, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (streaming) {
      const meteredFamily = servedFamily;
      const meteredModel = servedModel;
      const meteredPersonal = servedOnPersonalKey;
      const meteredViaResponses = servedViaResponses;
      const streamHold = takeHold();
      const meteredTrace: RouteTrace = {
        requestedModel,
        reasoningEffort: servedReasoning,
        startedAtMs: requestStartedMs,
        requestedFamily: createTier !== null ? createFamily : family,
        label: app ? app.slug : createLabel,
        createStage,
        app: appTrace(streamHold),
      };
      const clientBody = meteredViaResponses
        ? responsesStreamToChat(upstream.body)
        : upstream.body;
      const stream = meteringTee(clientBody, (usage, errored) => {
        if (usage) {
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
        } else if (streamHold) {
          // A failed stream generated billable provider output but reported
          // no usage — settle at the reserved amount so a retry loop can't
          // burn provider spend through budget it keeps getting refunded.
          after(
            errored
              ? settleAppSpend(supabase, streamHold, streamHold.reservedUsd)
              : releaseAppSpend(supabase, streamHold)
          );
        }
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const upstreamJson = (await upstream.json()) as Json;
    const json = (servedViaResponses
      ? fromResponsesResponse(upstreamJson)
      : upstreamJson) as { usage?: Usage };
    if (json.usage) {
      const usage = json.usage;
      after(
        meter(userId, tier, servedFamily, usage, servedModel, servedOnPersonalKey, {
          requestedModel,
          reasoningEffort: servedReasoning,
          startedAtMs: requestStartedMs,
          requestedFamily: createTier !== null ? createFamily : family,
          label: app ? app.slug : createLabel,
          createStage,
          app: appTrace(takeHold()),
        })
      );
    }
    return NextResponse.json(json, { status: 200 });
  };
  try {
    return await proxy();
  } catch (error) {
    if (isTimeoutError(error)) {
      log.warn("gateway provider deadline exceeded", {user_id: userId,
          family,
          model: servedModel || null,
          elapsed_ms: Date.now() - requestStartedMs,});
      return NextResponse.json(
        {
          error: {
            message: "The model provider exceeded the response deadline.",
            type: "upstream_timeout",
          },
        },
        { status: 504 }
      );
    }
    throw error;
  } finally {
    release();
  }
}
