/**
 * Shared plumbing for the agent eval suite: case parsing, SSE framing,
 * PostgREST reads, and the redaction pass every persisted artifact goes
 * through. No app imports — the harness runs standalone under `tsx` and
 * talks to the control plane over HTTP only.
 */
import { readFileSync } from "node:fs";

export const DECISION_KINDS = [
  "tier2_contact",
  "email_draft",
  "run_approval",
  "reconnect",
  "revise",
  "ad_write",
  "spend_ceiling",
  "content_plan",
  "spend_divergence",
  "calendar_add",
  "vault_fill",
  "vault_reveal",
  "social_post",
  "purchase_review",
  "crm_update",
  "miniapp_publish",
  "payment_request",
  "shop_publish",
] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

export const CATEGORIES = [
  "calendar",
  "crm",
  "marketing",
  "ads",
  "analytics",
  "tour_events",
  "cross_functional",
  "adversarial",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface EvalCase {
  id: string;
  category: Category;
  message: string;
  expected_skill: string;
  expected_decision_kind: DecisionKind | "none";
  safety_note: string;
}

export interface SseEvent {
  event: string;
  tool?: string;
  /**
   * Hermes ships a short preview with every tool event. For `skill_view` it is
   * the skill being read (`calendar-native`, `calendar-native → SKILL.md`); for
   * `execute_code`/`terminal` it is the code or command. It is the only routing
   * evidence the stream carries, since the tool names themselves are generic.
   */
  preview?: string;
  delta?: string;
  output?: string;
}

export interface ToolEvent {
  tool: string;
  preview: string;
}

/** Previews can be whole scripts; keep enough to see the artifact it touches. */
export const PREVIEW_MAX = 600;

/**
 * The skill a `skill_view` preview names, or null for any other tool. Previews
 * read `calendar-native`, `productivity/notion` (hub bundles nest one level) or
 * `calendar-native → SKILL.md` when a specific file was opened; the leaf name is
 * what Hermes and the installed-skills inventory agree on.
 */
export function skillFromPreview(event: SseEvent): string | null {
  if (event.tool !== "skill_view" || !event.preview) return null;
  const path = event.preview.split("\u2192")[0]?.trim() ?? "";
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/.test(path)) return null;
  return path.split("/").slice(-1)[0] ?? null;
}

export interface DecisionRow {
  kind: string;
  status: string;
  label: string | null;
  platform: string | null;
  created_at: string;
  payload_keys: string[];
}

export interface AgentRunRow {
  hermes_run_id: string | null;
  trigger: string | null;
  outcome: string | null;
  started_at: string;
  ended_at: string | null;
  cost_usd: number | null;
  box_seconds: number | null;
}

export interface CaseResult {
  id: string;
  category: Category;
  message: string;
  expected_skill: string;
  expected_decision_kind: DecisionKind | "none";
  safety_note: string;
  /** ISO timestamp captured just before POST /api/chat — the decisions window floor. */
  window_start: string;
  /** ISO timestamp captured after the settle wait — the window ceiling, so a
   * later case's rows can never be read into this one. */
  window_end: string | null;
  run_id: string | null;
  /** "completed" | "failed" | "timeout" | "start_error" | "stream_error" */
  status: string;
  error: string | null;
  /** Tool names from tool.started, in fire order, duplicates collapsed. */
  tools: string[];
  /** Every tool.started with its preview, in fire order (redacted, clamped). */
  tool_events: ToolEvent[];
  /** Skills the agent actually opened, from `skill_view` previews. */
  skills_viewed: string[];
  /** Concatenated message.delta text, falling back to run.completed output. */
  output: string;
  elapsed_ms: number;
  /** The agent_runs row the control plane opened for this run. */
  run_row: AgentRunRow | null;
  /** Every agent_runs row in the window (chat row plus gateway_completion metering rows). */
  window_runs: AgentRunRow[];
  cost_usd: number;
  box_seconds: number;
  decisions: DecisionRow[];
}

export function loadCases(path: string): EvalCase[] {
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line, i) => {
    const parsed = JSON.parse(line) as Partial<EvalCase>;
    if (!parsed.id || !parsed.category || !parsed.message) {
      throw new Error(`messages.jsonl line ${i + 1}: missing id/category/message`);
    }
    if (!CATEGORIES.includes(parsed.category as Category)) {
      throw new Error(`messages.jsonl line ${i + 1}: bad category ${parsed.category}`);
    }
    const kind = parsed.expected_decision_kind ?? "none";
    if (kind !== "none" && !DECISION_KINDS.includes(kind as DecisionKind)) {
      throw new Error(`messages.jsonl line ${i + 1}: ${kind} is not in decisions_kind_check`);
    }
    return {
      id: parsed.id,
      category: parsed.category as Category,
      message: parsed.message,
      expected_skill: parsed.expected_skill ?? "none",
      expected_decision_kind: kind as DecisionKind | "none",
      safety_note: parsed.safety_note ?? "",
    };
  });
}

/**
 * Redaction for everything we write to disk. The transcript is model output
 * from a live box, so it can echo addresses, phone numbers, and credentials
 * the suite never needs to keep. Applied before persisting, not at score
 * time, so a leaked raw file cannot exist in the first place.
 */
export function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g, "[phone]")
    .replace(/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{12,}/g, "[key]")
    .replace(/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[jwt]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[hex]")
    .replace(
      /((?:bearer|token|api[_-]?key|password|secret)\s*[:=]\s*)\S+/gi,
      "$1[redacted]"
    );
}

/** Split an SSE byte stream into parsed `data:` payloads. */
export function createSseParser(): (chunk: string) => SseEvent[] {
  let buffer = "";
  return (chunk: string): SseEvent[] => {
    buffer += chunk;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    const out: SseEvent[] = [];
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as Partial<SseEvent>;
          if (typeof parsed.event === "string") out.push(parsed as SseEvent);
        } catch {
          // A non-JSON keepalive frame is not an event.
        }
      }
    }
    return out;
  };
}

export interface Supa {
  url: string;
  key: string;
}

export async function supaSelect<T>(
  supa: Supa,
  table: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${supa.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supa.key,
      Authorization: `Bearer ${supa.key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`supabase ${table} read failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env ${name}`);
  return value;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
