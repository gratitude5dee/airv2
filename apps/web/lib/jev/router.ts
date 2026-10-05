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
import {
  CONTEXT_MIN_NOUL,
  GATE_MIN_PROBABILITY,
  GATE_OPTIONS,
  ROUTE_MIN_PROBABILITY,
  ROUTE_OPTIONS,
  ROUTING_QUESTIONS,
  type GateOption,
  type RouteOption,
} from "./questions";
import { jevAsk } from "./transport";

/** Tight budget: routing adds latency to every turn, so a slow Jev is
 * worse than no Jev. */
const JEV_TIMEOUT_MS = 2_500;
/** Prompt-size guard — routing state is the user's message, trimmed. */
const MAX_STATE_CHARS = 4_000;

export interface TurnRoute {
  /** Skill to open first (installed leaf/family), null below threshold. */
  readonly skill: RouteOption | null;
  /** Second capability for compound turns (installed leaf/family), null
   * when the turn is single-purpose or the pick is `none`. */
  readonly secondary: RouteOption | null;
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
    secondary_capability?: ChoiceAnswer;
    approval_gate?: ChoiceAnswer;
    needs_owner_context?: NoulAnswer;
    compound_request?: NoulAnswer;
  };
  providerMetadata?: {
    typesafe?: { confidence?: Record<string, number> };
  };
}

export async function routeTurn(input: string): Promise<TurnRoute | null> {
  if (!input.trim()) return null;
  const body = await jevAsk<SystemOneResponse>({
    surface: "air-chat",
    state: { message: input },
    questions: ROUTING_QUESTIONS,
    timeoutMs: JEV_TIMEOUT_MS,
    maxFieldChars: MAX_STATE_CHARS,
  });
  return body ? parseRoute(body) : null;
}

export function parseRoute(body: SystemOneResponse): TurnRoute | null {
  const answers = body.answers;
  if (!answers) return null;

  const rawSkill = answers.capability?.choice;
  let skill: RouteOption | null =
    rawSkill != null &&
    rawSkill !== "none" &&
    rawSkill in ROUTE_OPTIONS &&
    (answers.capability?.probabilities?.[rawSkill] ?? 0) >=
      ROUTE_MIN_PROBABILITY
      ? (rawSkill as RouteOption)
      : null;
  const argmaxNonNone = (probs: Record<string, number> | undefined) => {
    // When Jev prefers a real capability over `none` but below the
    // declaration threshold, still declare it — opening a runbook is a
    // cheap read and beats leaving the turn unsteered.
    const best = Object.entries(probs ?? {})
      .filter(([name]) => name !== "none" && name in ROUTE_OPTIONS)
      .sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > ((probs ?? {})["none"] ?? 0)
      ? (best[0] as RouteOption)
      : null;
  };
  if (!skill) {
    skill = argmaxNonNone(answers.capability?.probabilities);
  }

  const rawSecondary = answers.secondary_capability?.choice;
  // A second capability on an unrouted turn is noise — "none" primary means
  // there is no runbook to pair with.
  const secondary: RouteOption | null =
    skill != null &&
    rawSecondary != null &&
    rawSecondary !== "none" &&
    rawSecondary in ROUTE_OPTIONS &&
    rawSecondary !== skill
      ? ((answers.secondary_capability?.probabilities?.[rawSecondary] ?? 0) >=
        ROUTE_MIN_PROBABILITY
          ? (rawSecondary as RouteOption)
          : argmaxNonNone(answers.secondary_capability?.probabilities) ??
            (rawSecondary as RouteOption))
      : skill != null
        ? argmaxNonNone(answers.secondary_capability?.probabilities)
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
    secondary: secondary === skill ? null : secondary,
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

/** The skill whose runbook owns each approval gate's staging flow — it
 * names the exact propose/stage call, so a gate-only route still opens it. */
const GATE_OWNER_SKILL: Partial<Record<GateOption, RouteOption>> = {
  purchase_review: "kernel-payments",
  email_draft: "email-draft-review",
  miniapp_publish: "create-miniapp",
  shop_publish: "storefront-commerce",
  social_post: "social-engage",
  calendar_add: "calendar-native",
  vault_fill: "vault-use",
  crm_update: "crm-people",
};

/** The literal staging step each gate kind requires — the call that files
 * the pending decision, named so the agent runs it instead of summarizing. */
const GATE_STAGING: Record<GateOption, string> = {
  purchase_review: "run `air-kernel purchase propose '{...}' <session>`",
  email_draft: "POST to /api/email/drafts/review",
  miniapp_publish: "run `air-create publish <appname>`",
  shop_publish: "POST to /api/miniapps/commerce",
  social_post: "POST to /api/content/plan",
  calendar_add: "stage the invite so it lands as a pending approval",
  vault_fill: "stage the vault-fill approval the runbook documents",
  crm_update: "stage the crm-write approval the runbook documents",
  none: "",
};

/** The run `instructions` block — Jev's classification rendered as routing
 * guidance for the agent's system instructions. Returns undefined when
 * nothing cleared its threshold (plain turns get no hint). */
export function routingInstructions(
  route: TurnRoute | null
): string | undefined {
  if (
    !route ||
    (!route.skill &&
      !route.secondary &&
      !route.gate &&
      !route.needsContext &&
      !route.compound)
  ) {
    return undefined;
  }
  const lines = [
    "Pre-classified routing for this turn (deterministic — apply it rather than re-deriving):",
  ];
  const requiredSkill =
    route.skill ?? (route.gate ? GATE_OWNER_SKILL[route.gate] : undefined);
  if (requiredSkill) {
    lines.push(
      `- First action: call skill_view("${requiredSkill}") — a cheap read with no side effects. Do it before anything else, including asking the owner for missing details (the runbook names what to ask for — put the ask as a question); unconfigured connectors and missing accounts are the skill's own flow, so replying without opening it is a wrong answer.`
    );
  }
  const secondarySkill =
    route.secondary && route.secondary !== requiredSkill
      ? route.secondary
      : undefined;
  if (secondarySkill) {
    lines.push(
      `- Also required: call skill_view("${secondarySkill}") — the turn's second capability; its runbook applies too.`
    );
  }
  if (route.gate) {
    lines.push(
      `- Approval gate: ${route.gate} — end this turn with that decision pending for the owner: ${GATE_STAGING[route.gate]} per the runbook. Replying with a summary of what you would do instead is a wrong answer.`
    );
  }
  if (route.needsContext) {
    lines.push(
      "- Context: this needs the owner's data — search openviking-memory, contacts, calendar, vault, or inbox before replying; do not guess from history."
    );
  }
  if (route.compound) {
    lines.push(
      "- Shape: compound request — plan the distinct actions, then do them in order."
    );
  }
  return lines.join("\n");
}
