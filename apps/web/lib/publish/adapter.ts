/**
 * CM3 (goal-creative.md): the PublishAdapter contract — one cleanroom
 * interface per platform (CC12). The load-bearing idea is `classify`: every
 * platform failure is reduced to exactly three product behaviors —
 * re-authenticate (a reconnect card in "Needs you"), fix the content (a
 * revise card carrying the real constraint), or retry later (invisible
 * backoff, capped attempts). Token custody stays with Composio (goal.md M7):
 * adapters receive an execute context, never a raw credential.
 */

export type Platform =
  | "instagram"
  | "facebook"
  | "x"
  | "youtube"
  | "tiktok";

export type MediaKind = "image" | "video";

export interface DraftMedia {
  /** Short-TTL signed delivery URL minted by CM2 — never a box URL. */
  url: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationSeconds?: number;
  bytes?: number;
}

export type DraftKind = "feed" | "story" | "reel";

export interface Draft {
  caption: string;
  media: DraftMedia[];
  /** Post format where the platform distinguishes (Instagram story/reel). */
  kind?: DraftKind;
  /** Title where the platform requires one (YouTube). */
  title?: string;
  link?: string;
}

/** A pre-flight rejection: names the violated rule so a revise card can
 * carry the actual constraint, not a vendor error. */
export interface Problem {
  code: string;
  message: string;
}

export type Verdict =
  | { kind: "reauth"; message: string }
  | { kind: "fix-content"; message: string }
  | { kind: "retry"; after: number };

export interface PlatformLimits {
  maxCaptionChars: number;
  maxMediaItems: number;
  /** Publishes per account per trailing 24h enforced before the call (CC8). */
  dailyCap: number;
}

/** The only capability an adapter gets: run a Composio tool as this user.
 * The OAuth token never leaves Composio; `connections` records only
 * (user_id, provider, toolkit, external_account_id, status). */
export interface PublishCtx {
  userId: string;
  /** Platform account the slot targets (external_account_id). */
  accountRef: string;
  execute(toolSlug: string, args: Record<string, unknown>): Promise<unknown>;
  /** Resumable step state for long publishes: an Instagram container id
   * survives a worker deadline so the next claim polls the same container
   * instead of creating a second one (CM3 task 4). */
  state: Record<string, string>;
  saveState(): Promise<void>;
}

export interface Published {
  externalId: string;
  permalink?: string;
}

export interface PublishAdapter {
  readonly platform: Platform;
  readonly scopes: readonly string[];
  readonly limits: PlatformLimits;
  /** CC5 — pre-flight, pure. The platform's rules live in specs/ as data. */
  validate(draft: Draft): Problem[];
  publish(ctx: PublishCtx, draft: Draft): Promise<Published>;
  /** CC6 — classify a platform failure into one of three verdicts. */
  classify(status: number, body: string): Verdict;
  metrics?(ctx: PublishCtx, externalId: string): Promise<Metric[]>;
}

export interface Metric {
  name: string;
  value: number;
}

/** Thrown by publish() when the platform rejects; carries enough for
 * classify() to produce a verdict. */
export class PublishError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`publish failed ${status}: ${body.slice(0, 200)}`);
    this.name = "PublishError";
    this.status = status;
    this.body = body;
  }
}

/** Shared classification defaults: auth failures → reauth, throttles and
 * server errors → retry with backoff, everything else 4xx → fix-content
 * with the platform's own reason. Adapters wrap this with platform-specific
 * error-code handling. */
export function classifyDefault(status: number, body: string): Verdict {
  if (status === 401 || status === 403) {
    return { kind: "reauth", message: "The connection needs to be renewed." };
  }
  if (status === 429) {
    return { kind: "retry", after: 15 * 60 };
  }
  if (status >= 500) {
    return { kind: "retry", after: 5 * 60 };
  }
  return {
    kind: "fix-content",
    message:
      sanitizeVerdictMessage(body) ||
      `The platform rejected the post (${status}).`,
  };
}

/** Verdict messages surface to users (revise cards, and any future log or
 * API consumer): redact URLs (platform error bodies can echo our signed
 * delivery URLs) and token-like blobs, keep printable text only, collapse
 * whitespace, and cap the length. */
export function sanitizeVerdictMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]")
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function aspectRatio(media: DraftMedia): number | null {
  if (!media.width || !media.height) return null;
  return media.width / media.height;
}
