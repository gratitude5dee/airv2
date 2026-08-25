/**
 * MA9.2 — pure helpers: shape validation for the Onairos SDK handoff, the
 * persona → markdown projection, and the USER.md pointer line. No I/O here;
 * everything is unit-testable without a box or a network.
 *
 * Verified contract (docs.onairos.io/api-reference, 2026-08): the client SDK
 * finishes the consent flow and hands the app `{ token, apiUrl, authorizedData,
 * ... }`. The `apiUrl` is opaque — the backend POSTs to it with the short-lived
 * bearer `token` and receives one of a small set of persona response families
 * (traits/userProfile/DataAnalysis). This matches goal.md §3's anticipated
 * "client-SDK consent → context posted to the control plane" shape.
 */
import { asRecord } from "../records";

export const ONAIROS_MD_PATH = ".hermes/context/onairos.md";
export const ONAIROS_JSON_PATH = ".hermes/context/onairos.json";
/** The stored grant (apiUrl + short-lived token) powering Re-sync. It lives
 * only in the user's own box (0600) — vault-key custody model, never in
 * Postgres or the Vercel env. */
export const ONAIROS_GRANT_PATH = ".hermes/context/.onairos-grant.json";

export const USER_MD_POINTER_LINE =
  "Imported personal context from Onairos lives at ~/.hermes/context/onairos.md (structured data beside it in onairos.json).";

export class OnairosError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "OnairosError";
  }
}

export interface OnairosHandoff {
  /** Short-lived bearer token scoped to the approved request. */
  token: string;
  /** The returned Persona API URL — opaque, followed as-is (docs contract). */
  apiUrl: string;
  /** Data categories the user consented to, when the SDK reported them. */
  authorizedData?: Record<string, boolean> | undefined;
}

/** SSRF guard: the control plane only ever POSTs to Onairos-owned hosts over
 * https. The handoff arrives from a browser, so the URL is untrusted input. */
const ALLOWED_API_HOSTS = /^(?:[a-z0-9-]+\.)*onairos\.(?:uk|io)$/i;

export function validateHandoff(input: unknown): OnairosHandoff {
  const body = input as {
    token?: unknown;
    apiUrl?: unknown;
    authorizedData?: unknown;
  } | null;
  if (
    !body ||
    typeof body.token !== "string" ||
    body.token.length === 0 ||
    typeof body.apiUrl !== "string"
  ) {
    throw new OnairosError("token and apiUrl required");
  }
  let url: URL;
  try {
    url = new URL(body.apiUrl);
  } catch {
    throw new OnairosError("apiUrl is not a valid URL");
  }
  if (url.protocol !== "https:" || !ALLOWED_API_HOSTS.test(url.hostname)) {
    throw new OnairosError("apiUrl must be an https onairos.uk/onairos.io URL");
  }
  const authorizedRecord = asRecord(body.authorizedData);
  const authorizedData = authorizedRecord
    ? Object.fromEntries(
        Object.entries(authorizedRecord)
          .filter(
            (entry): entry is [string, boolean] =>
              typeof entry[1] === "boolean"
          )
      )
    : undefined;
  return { token: body.token, apiUrl: body.apiUrl, authorizedData };
}

interface PersonaTraits {
  positive_traits?: Record<string, unknown>;
  traits_to_improve?: Record<string, unknown>;
  user_summary?: unknown;
  top_traits_explanation?: unknown;
  archetype?: unknown;
  nudges?: unknown;
}

/** Best-effort extraction across the documented response families: top-level
 * `traits`, `userProfile`, or the `DataAnalysis.personality_traits` schema. */
function extractTraits(persona: unknown): PersonaTraits {
  const root = persona as {
    traits?: PersonaTraits;
    userProfile?: PersonaTraits;
    DataAnalysis?: { personality_traits?: PersonaTraits };
  } | null;
  return {
    ...root?.DataAnalysis?.personality_traits,
    ...root?.userProfile,
    ...root?.traits,
  };
}

function traitScore(value: unknown): string {
  if (typeof value === "number") return String(value);
  const detail = value as { score?: unknown } | null;
  return typeof detail?.score === "number" ? String(detail.score) : "";
}

/** Render the persona payload as the agent-readable context file. The agent
 * reads it like any other file; nothing here is injected into prompts by the
 * control plane. */
export function contextMarkdown(persona: unknown, syncedAt: string): string {
  const traits = extractTraits(persona);
  const root = persona as { connectedPlatforms?: unknown } | null;
  const lines: string[] = [
    "# Personal context — imported from Onairos",
    "",
    `Synced: ${syncedAt}`,
    "Source: Onairos persona grant (user-consented). Structured payload in onairos.json.",
    "",
  ];
  if (typeof traits.archetype === "string" && traits.archetype) {
    lines.push(`Archetype: The ${traits.archetype}`, "");
  }
  if (typeof traits.user_summary === "string" && traits.user_summary) {
    lines.push("## About this person", "", traits.user_summary, "");
  }
  const positive = Object.entries(traits.positive_traits ?? {});
  if (positive.length > 0) {
    lines.push("## Strengths");
    for (const [name, value] of positive) {
      const score = traitScore(value);
      lines.push(`- ${name}${score ? ` (${score}/100)` : ""}`);
    }
    lines.push("");
  }
  const improve = Object.entries(traits.traits_to_improve ?? {});
  if (improve.length > 0) {
    lines.push("## Growth areas");
    for (const [name, value] of improve) {
      const score = traitScore(value);
      lines.push(`- ${name}${score ? ` (${score}/100)` : ""}`);
    }
    lines.push("");
  }
  if (
    typeof traits.top_traits_explanation === "string" &&
    traits.top_traits_explanation
  ) {
    lines.push("## Why these traits", "", traits.top_traits_explanation, "");
  }
  if (Array.isArray(root?.connectedPlatforms)) {
    const platforms = root.connectedPlatforms.filter(
      (entry): entry is string => typeof entry === "string"
    );
    if (platforms.length > 0) {
      lines.push(`Connected platforms: ${platforms.join(", ")}`, "");
    }
  }
  return lines.join("\n");
}

/** USER.md persona digest markers — everything between them (inclusive) is
 * owned by the sync and replaced wholesale on every re-sync. */
export const PERSONA_BLOCK_START = "<!-- onairos-persona:start -->";
export const PERSONA_BLOCK_END = "<!-- onairos-persona:end -->";

/** USER.md is budgeted (~500 tokens in Hermes), so the digest keeps only the
 * highest-signal fields; the full projection stays in onairos.md. */
const MAX_DIGEST_TRAITS = 5;
const MAX_DIGEST_GROWTH = 3;
const MAX_SUMMARY_CHARS = 400;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > max / 2 ? space : max)}…`;
}

/** Highest-scored trait names first (unscored traits keep their order, last). */
function rankedTraits(record: Record<string, unknown>, limit: number): string {
  return Object.entries(record)
    .map(([name, value]) => ({ name, score: traitScore(value) }))
    .sort((a, b) => Number(b.score || -1) - Number(a.score || -1))
    .slice(0, limit)
    .map(({ name, score }) => (score ? `${name} (${score})` : name))
    .join(", ");
}

/** Compact persona digest for USER.md: archetype, ranked traits, summary,
 * growth areas, connected platforms — the onairos-hermes-mcp shape. */
export function personaBlock(persona: unknown, syncedAt: string): string {
  const traits = extractTraits(persona);
  const root = persona as { connectedPlatforms?: unknown } | null;
  const lines: string[] = [
    PERSONA_BLOCK_START,
    "## What you know about your owner",
    "Use this automatically whenever you personalize — recommendations, tone,",
    "examples. The owner never needs to name or ask for this context.",
  ];
  if (typeof traits.archetype === "string" && traits.archetype) {
    lines.push(`Archetype: The ${traits.archetype}`);
  }
  if (typeof traits.user_summary === "string" && traits.user_summary) {
    lines.push(truncate(traits.user_summary, MAX_SUMMARY_CHARS));
  }
  const strengths = rankedTraits(
    traits.positive_traits ?? {},
    MAX_DIGEST_TRAITS
  );
  if (strengths) lines.push(`Top traits: ${strengths}`);
  const growth = rankedTraits(traits.traits_to_improve ?? {}, MAX_DIGEST_GROWTH);
  if (growth) lines.push(`Growth areas: ${growth}`);
  if (Array.isArray(root?.connectedPlatforms)) {
    const platforms = root.connectedPlatforms.filter(
      (entry): entry is string => typeof entry === "string"
    );
    if (platforms.length > 0) lines.push(`Built from: ${platforms.join(", ")}`);
  }
  lines.push(
    `Synced ${syncedAt} — full detail in ~/.hermes/context/onairos.md.`,
    PERSONA_BLOCK_END
  );
  return lines.join("\n");
}

const BLOCK_PATTERN = new RegExp(
  `${PERSONA_BLOCK_START}[\\s\\S]*?${PERSONA_BLOCK_END}\\n?`,
  "g"
);

/** Replace (or append) the persona digest in USER.md content. Also retires
 * the legacy standalone pointer line — the block carries the pointer now. */
export function upsertPersonaBlock(user: string, block: string): string {
  const cleaned = removePointerLine(user.replace(BLOCK_PATTERN, "")).replace(
    /\n+$/,
    ""
  );
  return cleaned === "" ? `${block}\n` : `${cleaned}\n\n${block}\n`;
}

/** Remove the persona digest (and legacy pointer line) from USER.md content. */
export function removePersonaBlock(user: string): string {
  return removePointerLine(user.replace(BLOCK_PATTERN, ""));
}

/** Remove the legacy pointer line older syncs appended (the persona block
 * carries the pointer now); disconnect leaves zero Onairos-derived bytes. */
export function removePointerLine(user: string): string {
  return user
    .split("\n")
    .filter((line) => line.trim() !== USER_MD_POINTER_LINE)
    .join("\n");
}
