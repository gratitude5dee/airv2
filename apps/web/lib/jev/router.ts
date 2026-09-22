/**
 * Jev turn router — one fast typed classification per chat turn. Jev
 * answers "which capability, which approval gate, what context"; the
 * result is injected as run `instructions` so the Astra+GLM agent opens
 * the right skill and stages the right decision. Jev never executes —
 * the LLM lane still does all the work; this layer only steers routing.
 *
 * Fail-open by contract: a missing key, a timeout, or an odd answer
 * degrades to an un-routed turn, never a failed one.
 */
import { env } from "../env";
import { requestSignal } from "../http/timeout";
import {
  CONTEXT_MIN_NOUL,
  GATE_MIN_PROBABILITY,
  GATE_OPTIONS,
  JEV_GATEWAY_MODEL,
  JEV_MODEL,
  ROUTE_MIN_PROBABILITY,
  ROUTE_OPTIONS,
  ROUTING_QUESTIONS,
  type GateOption,
  type RouteOption,
} from "./questions";

/** Tight budget: routing adds latency to every turn, so a slow Jev is
 * worse than no Jev. */
const JEV_TIMEOUT_MS = 2_500;
/** Prompt-size guard — routing state is the user's message, trimmed. */
const MAX_STATE_CHARS = 4_000;

export interface TurnRoute {
  /** Skill to open first (installed leaf/family), null below threshold. */
  readonly skill: RouteOption | null;
  /** Decision kind the turn should end in, null below threshold. */
  readonly gate: GateOption | null;
  /** Whether the turn needs owner context stores. */
  readonly needsContext: boolean;
  /** Whether the request is compound (multiple distinct actions). */
  readonly compound: boolean;
  /** Jev's confidence in the capability pick — kept for logging. */
  readonly confidence: number;
}

interface ChoiceAnswer {
  /** Wire tag — "choice" on both backends; ignored for parsing. */
  type?: string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

interface NoulAnswer {
  /** Wire tag — "noul" on TypeSafe's API, "boolean" on the gateway. */
  type?: string;
  /** TypeSafe API: probability the statement is true. */
  noul?: number;
  /** AI Gateway `boolean` question: probability the statement is true. */
  probability?: number;
}

export interface SystemOneResponse {
  answers?: {
    capability?: ChoiceAnswer;
    approval_gate?: ChoiceAnswer;
    needs_owner_context?: NoulAnswer;
    compound_request?: NoulAnswer;
  };
  providerMetadata?: {
    typesafe?: { confidence?: Record<string, number> };
  };
}

/** Two transports, one contract. A direct TYPESAFE_API_KEY hits TypeSafe's
 * /v1/systemone (noul questions, inline per-answer confidence). Otherwise the
 * Vercel AI Gateway serves the same Jev model through its evaluation-model
 * endpoint — noul questions map onto its `boolean` type and confidence lives
 * in providerMetadata.typesafe.confidence. */
type JevBackend =
  | { kind: "typesafe"; url: string; key: string }
  | { kind: "gateway"; url: string; key: string };

function pickBackend(): JevBackend | null {
  const typesafeKey = env.typesafeApiKey();
  if (typesafeKey) {
    return {
      kind: "typesafe",
      url: `${env.typesafeApiBase()}/v1/systemone`,
      key: typesafeKey,
    };
  }
  const gatewayKey = env.aiGatewayApiKey();
  if (gatewayKey) {
    return {
      kind: "gateway",
      url: `${env.aiGatewayBase()}/evaluation-model`,
      key: gatewayKey,
    };
  }
  return null;
}

/** The gateway's boolean question is the noul primitive — same instructions,
 * different type tag. Choice questions pass through unchanged. */
function gatewayQuestions(questions: typeof ROUTING_QUESTIONS) {
  return Object.fromEntries(
    Object.entries(questions).map(([id, q]) => [
      id,
      q.type === "noul" ? { ...q, type: "boolean" } : q,
    ])
  );
}

function buildRequest(
  backend: JevBackend,
  input: string
): { url: string; init: RequestInit } {
  const state = { surface: "air-chat", message: input.slice(0, MAX_STATE_CHARS) };
  if (backend.kind === "typesafe") {
    return {
      url: backend.url,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backend.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state,
          model: JEV_MODEL,
          questions: ROUTING_QUESTIONS,
        }),
      },
    };
  }
  return {
    url: backend.url,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${backend.key}`,
        "Content-Type": "application/json",
        "ai-gateway-protocol-version": "0.0.1",
        "ai-evaluation-model-specification-version": "4",
        "ai-model-id": JEV_GATEWAY_MODEL,
      },
      body: JSON.stringify({
        state,
        questions: gatewayQuestions(ROUTING_QUESTIONS),
      }),
    },
  };
}

export async function routeTurn(input: string): Promise<TurnRoute | null> {
  const backend = pickBackend();
  if (!backend || !input.trim()) return null;
  try {
    const { url, init } = buildRequest(backend, input);
    const response = await fetch(url, {
      ...init,
      signal: requestSignal(JEV_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return parseRoute((await response.json()) as SystemOneResponse);
  } catch {
    return null;
  }
}

export function parseRoute(body: SystemOneResponse): TurnRoute | null {
  const answers = body.answers;
  if (!answers) return null;

  const rawSkill = answers.capability?.choice;
  const skill: RouteOption | null =
    rawSkill != null &&
    rawSkill !== "none" &&
    rawSkill in ROUTE_OPTIONS &&
    (answers.capability?.probabilities?.[rawSkill] ?? 0) >=
      ROUTE_MIN_PROBABILITY
      ? (rawSkill as RouteOption)
      : null;

  const rawGate = answers.approval_gate?.choice;
  const gate: GateOption | null =
    rawGate != null &&
    rawGate !== "none" &&
    rawGate in GATE_OPTIONS &&
    (answers.approval_gate?.probabilities?.[rawGate] ?? 0) >=
      GATE_MIN_PROBABILITY
      ? (rawGate as GateOption)
      : null;

  return {
    skill,
    gate,
    needsContext:
      (answers.needs_owner_context?.noul ??
        answers.needs_owner_context?.probability ??
        0) >= CONTEXT_MIN_NOUL,
    compound:
      (answers.compound_request?.noul ??
        answers.compound_request?.probability ??
        0) >= 0.5,
    confidence:
      answers.capability?.confidence ??
      body.providerMetadata?.typesafe?.confidence?.["capability"] ??
      0,
  };
}

/** The run `instructions` block — Jev's classification rendered as routing
 * guidance for the agent's system instructions. Returns undefined when
 * nothing cleared its threshold (plain turns get no hint). */
export function routingInstructions(
  route: TurnRoute | null
): string | undefined {
  if (
    !route ||
    (!route.skill && !route.gate && !route.needsContext && !route.compound)
  ) {
    return undefined;
  }
  const lines = [
    "Pre-classified routing for this turn (deterministic — apply it rather than re-deriving):",
  ];
  if (route.skill) {
    lines.push(
      `- First action: call skill_view("${route.skill}") before any other tool or reply — even if the capability looks unconfigured or the connector seems missing. The skill's own flow covers connection gaps, approval staging, and fallbacks; do not answer from history alone.`
    );
  }
  if (route.gate) {
    lines.push(
      `- Approval gate: ${route.gate} — end this turn with that decision pending for the owner; stage it through the skill's flow and never perform the side effect yourself.`
    );
  }
  if (route.needsContext) {
    lines.push(
      "- Context: this needs the owner's data — search memory, contacts, calendar, vault, or inbox tools before replying; do not guess from history."
    );
  }
  if (route.compound) {
    lines.push(
      "- Shape: compound request — plan the distinct actions, then do them in order."
    );
  }
  return lines.join("\n");
}
