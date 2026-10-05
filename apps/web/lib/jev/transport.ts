/**
 * Shared Jev (TypeSafe System One) transport — one batched classification
 * call per surface. Two backends, one contract: a direct TYPESAFE_API_KEY
 * hits TypeSafe's /v1/systemone (noul questions, inline per-answer
 * confidence); otherwise the Vercel AI Gateway serves the same Jev model
 * through its /evaluation-model endpoint — noul questions map onto its
 * `boolean` type and confidence lives in providerMetadata.typesafe.
 *
 * Fail-open by contract: a missing key, a timeout, or an odd answer
 * degrades to null, never a failed caller.
 */
import { env } from "../env";
import { requestSignal } from "../http/timeout";
import { JEV_GATEWAY_MODEL, JEV_MODEL } from "./questions";

export interface JevQuestion {
  readonly type: string;
  readonly instructions: string;
  readonly criteria?: Record<string, string>;
}

export type JevQuestions = Record<string, JevQuestion>;

/** A noul/boolean answer — probability the statement is true on either
 * wire shape (TypeSafe `noul`, gateway `probability`). */
export interface JevNoulAnswer {
  type?: string;
  noul?: number;
  probability?: number;
}

export function noul(answer: JevNoulAnswer | undefined): number {
  return answer?.noul ?? answer?.probability ?? 0;
}

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
function gatewayQuestions(questions: JevQuestions): JevQuestions {
  return Object.fromEntries(
    Object.entries(questions).map(([id, q]) => [
      id,
      q.type === "noul" ? { ...q, type: "boolean" } : q,
    ])
  );
}

function buildRequest(
  backend: JevBackend,
  state: Record<string, string>,
  questions: JevQuestions
): { url: string; init: RequestInit } {
  if (backend.kind === "typesafe") {
    return {
      url: backend.url,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backend.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state, model: JEV_MODEL, questions }),
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
        questions: gatewayQuestions(questions),
      }),
    },
  };
}

export interface JevAskOptions {
  /** Surface tag carried in the state block (e.g. "air-chat", "air-mail"). */
  surface: string;
  /** State fields — each value is capped at `maxFieldChars`. */
  state: Record<string, string>;
  questions: JevQuestions;
  /** Per-attempt fetch budget. */
  timeoutMs: number;
  /** Per-field cap; defaults to 4000. */
  maxFieldChars?: number;
}

/**
 * One batched Jev call: every question runs over the same state. Two
 * attempts (the second covers a flaky transport/timeout), then null —
 * callers treat null as "no classification", never as an error.
 */
export async function jevAsk<TResponse>(
  options: JevAskOptions
): Promise<TResponse | null> {
  const backend = pickBackend();
  if (!backend) return null;
  const cap = options.maxFieldChars ?? 4_000;
  const state = Object.fromEntries(
    Object.entries({ surface: options.surface, ...options.state }).map(
      ([key, value]) => [key, value.slice(0, cap)]
    )
  );
  const { url, init } = buildRequest(backend, state, options.questions);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: requestSignal(options.timeoutMs),
      });
      if (!response.ok) continue;
      return (await response.json()) as TResponse;
    } catch {
      // Transport/timeout failure — retry once, then fail open.
    }
  }
  return null;
}
