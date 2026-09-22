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
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

interface NoulAnswer {
  noul?: number;
}

export interface SystemOneResponse {
  answers?: {
    capability?: ChoiceAnswer;
    approval_gate?: ChoiceAnswer;
    needs_owner_context?: NoulAnswer;
    compound_request?: NoulAnswer;
  };
}

export async function routeTurn(input: string): Promise<TurnRoute | null> {
  const apiKey = env.typesafeApiKey();
  if (!apiKey || !input.trim()) return null;
  try {
    const response = await fetch(`${env.typesafeApiBase()}/v1/systemone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: { surface: "air-chat", message: input.slice(0, MAX_STATE_CHARS) },
        model: JEV_MODEL,
        questions: ROUTING_QUESTIONS,
      }),
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
      (answers.needs_owner_context?.noul ?? 0) >= CONTEXT_MIN_NOUL,
    compound: (answers.compound_request?.noul ?? 0) >= 0.5,
    confidence: answers.capability?.confidence ?? 0,
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
      `- Capability: ${route.skill} — open it with skill_view and follow its choreography before doing anything else.`
    );
  }
  if (route.gate) {
    lines.push(
      `- Approval gate: ${route.gate} — end this turn with that decision pending for the owner; stage it through the skill's flow and never perform the side effect yourself.`
    );
  }
  if (route.needsContext) {
    lines.push(
      "- Context: consult the owner's stores first — openviking-memory, crm-people, calendar, vault, or inbox — before replying."
    );
  }
  if (route.compound) {
    lines.push(
      "- Shape: compound request — plan the distinct actions, then do them in order."
    );
  }
  return lines.join("\n");
}
