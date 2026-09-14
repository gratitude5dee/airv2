/**
 * Time-to-first-kindness (TTFK) policy for conversational iMessage turns.
 *
 * The reaction and first bubble are independent of a box wake. Progress
 * bubbles are deliberately cancelled as soon as a real reply begins, so a
 * fast answer never gets padded with performative status chatter.
 */

export const ACK_REACTION = "👀";
export const REACTION_SLA_MS = 1_000;
export const INITIAL_REPLY_SLA_MS = 5_000;
export const PROGRESS_ONE_AT_MS = 10_000;
export const PROGRESS_TWO_AT_MS = 20_000;
export const FINALIZING_AT_MS = 35_000;
const PROGRESS_GENERATION_HEADSTART_MS = 1_500;

export type ProgressStage = "progress-one" | "progress-two" | "finalizing";

/**
 * Evaluate a deliberately small arithmetic grammar without `eval` or a model.
 * This is the zero-network lane for questions such as “what is 9 × 7?”.
 */
export function deterministicArithmeticAnswer(body: string): string | null {
  const expression = body
    .trim()
    .replace(/^(?:what(?:'s| is)|calculate|compute|solve)\s+/i, "")
    .replace(/[?=]+$/g, "")
    .trim()
    .replace(/[×x·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, "");
  if (
    !expression ||
    expression.length > 120 ||
    !/^[\d\s()+\-*/.^]+$/.test(expression)
  ) {
    return null;
  }

  let index = 0;
  const skipWhitespace = (): void => {
    while (/\s/.test(expression[index] ?? "")) index += 1;
  };
  const parsePrimary = (): number => {
    skipWhitespace();
    if (expression[index] === "(") {
      index += 1;
      const value = parseSum();
      skipWhitespace();
      if (expression[index] !== ")") throw new Error("missing parenthesis");
      index += 1;
      return value;
    }
    const match = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error("number expected");
    index += match[0].length;
    return Number(match[0]);
  };
  const parseUnary = (): number => {
    skipWhitespace();
    if (expression[index] === "+") {
      index += 1;
      return parseUnary();
    }
    if (expression[index] === "-") {
      index += 1;
      return -parseUnary();
    }
    return parsePrimary();
  };
  const parsePower = (): number => {
    const left = parseUnary();
    skipWhitespace();
    if (expression[index] !== "^") return left;
    index += 1;
    return left ** parsePower();
  };
  const parseProduct = (): number => {
    let value = parsePower();
    for (;;) {
      skipWhitespace();
      const operator = expression[index];
      if (operator !== "*" && operator !== "/") return value;
      index += 1;
      const right = parsePower();
      value = operator === "*" ? value * right : value / right;
    }
  };
  function parseSum(): number {
    let value = parseProduct();
    for (;;) {
      skipWhitespace();
      const operator = expression[index];
      if (operator !== "+" && operator !== "-") return value;
      index += 1;
      const right = parseProduct();
      value = operator === "+" ? value + right : value - right;
    }
  }

  try {
    const value = parseSum();
    skipWhitespace();
    if (index !== expression.length || !Number.isFinite(value)) return null;
    const rounded = Number(value.toPrecision(15));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  } catch {
    return null;
  }
}

/**
 * Close a pure conversational acknowledgement without waking the user's box.
 * Keep this grammar intentionally narrow: a message that also contains work
 * must continue through the full agent path.
 */
export function deterministicAcknowledgementAnswer(body: string): string | null {
  const text = body.trim();
  if (/^(?:ok(?:ay)?[, ]+)?(?:let me know|keep me posted)[.!]?$/i.test(text)) {
    return "Will do.";
  }
  if (/^(?:thanks|thank you)[.!]?$/i.test(text)) return "You’re welcome.";
  if (/^(?:ok(?:ay)?|got it|sounds good)[.!]?$/i.test(text)) return "Got it.";
  return null;
}

/**
 * A quick completion has no conversation transcript or fresh tool data. These
 * shapes are therefore never safe to consume as a complete answer there.
 */
function needsConversationOrFreshData(text: string): boolean {
  return (
    /^(?:any\s+)?(?:update|updates|status)\b/i.test(text) ||
    /\b(?:today|tomorrow|latest|current|right now)\b/i.test(text) ||
    /\b(?:my|our)\s+(?:calendar|schedule|inbox|email|files?|tasks?|plans?)\b/i.test(text)
  );
}

/** Follow-ups should inspect the existing task, not start a second timer fan-out. */
export function shouldStartProgressTimeline(body: string): boolean {
  const text = body.trim();
  return (
    deterministicAcknowledgementAnswer(text) === null &&
    !/^(?:any\s+)?(?:update|updates|status)\b/i.test(text)
  );
}

/**
 * Tool, media, financial, or research work must not receive a speculative
 * model answer in the first bubble. It gets a deterministic, specific holding
 * line instead. Short, plain-language questions may use the fast GMI lane.
 */
export function isFastInitialQuestion(body: string): boolean {
  const text = body.trim();
  if (!text || text.length > 220) return false;
  if (/^\//.test(text) || /\[attachment:|\[location shared\]/i.test(text)) {
    return false;
  }
  if (needsConversationOrFreshData(text)) return false;
  return !/\b(research|investigate|compare|analy[sz]e|plan|strategy|debug|build|code|deploy|book|buy|pay|send money|transfer|delete|publish|find deals|discount|near me)\b/i.test(
    text
  );
}

/** Stable, task-aware fallback used when a fast completion is unsuitable or late. */
export function initialHoldingReply(body: string): string {
  const text = body.trim();
  if (/^(?:any\s+)?(?:update|updates|status)\b/i.test(text)) {
    return "I’m checking the current task now.";
  }
  if (/\b(?:today|tomorrow|latest|current|right now)\b/i.test(text)) {
    return "I’m checking the latest details now.";
  }
  if (/\[attachment:/i.test(text)) return "I’m looking at that now.";
  if (/\[location shared\]|\bnear me\b/i.test(text)) return "I’m checking that now.";
  if (/^\/(draw|freeze|image|image-editor)\b/i.test(text)) return "Opening that now.";
  if (/^\/(imagine|animate|zap)\b/i.test(text)) return "I’m making that now.";
  if (/\b(deal|discount|price|shop|find)\b/i.test(text)) return "I’m checking the best options now.";
  if (/\b(research|investigate|compare|analy[sz]e|plan|strategy|debug|build|code|deploy)\b/i.test(text)) {
    return "I’m working through that carefully now.";
  }
  const choices = [
    "I’m on it.",
    "Got it — checking now.",
    "I’m working on that now.",
  ];
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return choices[hash % choices.length] ?? choices[0]!;
}

export function progressFallback(stage: ProgressStage): string {
  switch (stage) {
    case "progress-one":
      return "I’m checking the details now.";
    case "progress-two":
      return "I’m still working through it — I’ll send the result shortly.";
    case "finalizing":
      return "I’m finalizing the result now.";
  }
}

export interface ProgressTimeline {
  /** Prevents every remaining update as soon as a real response can stream. */
  stop(): void;
}

export function startProgressTimeline(options: {
  receivedAtMs: number;
  send: (body: string) => Promise<void>;
  /** A fast GMI-generated status. Null means use the deterministic fallback. */
  generate: (stage: ProgressStage) => Promise<string | null>;
  now?: () => number;
  onSent?: (stage: ProgressStage, elapsedMs: number, generated: boolean) => void;
}): ProgressTimeline {
  let active = true;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const now = options.now ?? Date.now;

  const schedule = (stage: ProgressStage, targetMs: number): void => {
    let sent = false;
    let generatedBody: string | undefined;
    const deliver = (body: string, generated: boolean): void => {
      if (!active || sent) return;
      sent = true;
      void options.send(body).then(
        () => options.onSent?.(stage, now() - options.receivedAtMs, generated),
        () => undefined
      );
    };
    const generationAt = Math.max(
      0,
      options.receivedAtMs + targetMs - now() - PROGRESS_GENERATION_HEADSTART_MS
    );
    timers.push(
      setTimeout(() => {
        void options.generate(stage).then(
          (body) => {
            if (active && body?.trim()) generatedBody = body.trim();
          },
          () => undefined
        );
      }, generationAt)
    );
    timers.push(
      setTimeout(
        () =>
          deliver(
            generatedBody ?? progressFallback(stage),
            generatedBody !== undefined
          ),
        Math.max(0, options.receivedAtMs + targetMs - now())
      )
    );
  };

  schedule("progress-one", PROGRESS_ONE_AT_MS);
  schedule("progress-two", PROGRESS_TWO_AT_MS);
  schedule("finalizing", FINALIZING_AT_MS);
  return {
    stop: () => {
      active = false;
      for (const timer of timers) clearTimeout(timer);
    },
  };
}
