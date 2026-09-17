/**
 * V12 §5.4 Create surface panes — the pure parts: the request helper the
 * studio and its panes share, the intake / progress / release reply shapes
 * (mirrors of the control plane's route contracts, §14.1) and the copy
 * helpers the panes render (stage words, percent, expiry). Nothing here
 * touches the DOM, so panes.test.ts runs it under node. The control plane
 * never hands the browser plan text, source or prompt (CR21): every shape
 * below is metadata — a stage word, a count, a version, a URL, a timestamp.
 */

/* --------------------------------------------------------------- requests */

export type Reply<T> = Partial<T> & { error?: string; reason?: string };

export async function readJson<T>(res: Response): Promise<Reply<T>> {
  const data = (await res.json().catch(() => null)) as Reply<T> | null;
  if (data) return data;
  return {
    error: res.ok ? "unexpected reply" : `request failed (${res.status})`,
  } as Reply<T>;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<Reply<T>> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<T>(res);
  if (!res.ok) {
    throw new Error(
      data.reason === "create_budget"
        ? "this project's Create budget is spent — raise it in Settings"
        : (data.error ?? `request failed (${res.status})`),
    );
  }
  return data;
}

/** A multipart POST (the icon upload); same error shaping as `postJson`. */
export async function postForm<T>(url: string, form: FormData): Promise<Reply<T>> {
  const res = await fetch(url, { method: "POST", body: form });
  const data = await readJson<T>(res);
  if (!res.ok) {
    throw new Error(
      data.error === "upload_instead"
        ? "two generated icons is the limit; upload one instead"
        : (data.error ?? `upload failed (${res.status})`),
    );
  }
  return data;
}

export const ICON_ROUTE = "/api/create/icon";

/* ----------------------------------------------------------------- intake */

/** Mirrors INTAKE_STAGES in lib/create/intake.ts (§5.1); that module reads
 * process.env and cannot ride in the browser bundle. */
export const INTAKE_STAGES = [
  "asking",
  "planning",
  "plan_sent",
  "revising",
  "confirmed",
  "building",
  "qa",
  "testing",
  "dev_ready",
  "finalizing",
  "decision_sent",
  "production",
  "abandoned",
  "failed",
] as const;
export type IntakeStage = (typeof INTAKE_STAGES)[number];

/** Mirrors INTAKE_TEMPLATES in lib/create/intake.ts (§14.2 item 1). */
export const INTAKE_TEMPLATES = [
  "landing",
  "store",
  "game-2d",
  "game-3d",
  "tool",
  "page",
] as const;
export type IntakeTemplate = (typeof INTAKE_TEMPLATES)[number];

/** `GET /api/create/intake?app=` — intakeStatus() in lib/create/intake.ts. */
export interface IntakeStatus {
  appname: string | null;
  stage: IntakeStage;
  template: IntakeTemplate | null;
  source: "imessage" | "web";
  questions_asked: number;
  revisions: number;
  plan_version: number | null;
  builds: number;
  failed_builds: number;
  timestamps: {
    opened_at: string;
    confirmed_at: string | null;
    dev_ready_at: string | null;
    production_at: string | null;
    last_owner_message_at: string | null;
    updated_at: string;
  };
}

/** `GET /api/create/progress?app=` (§8.2). */
export interface ProgressReply {
  slug: string;
  percent: number;
  stage: IntakeStage;
  detail: string | null;
  updated_at: string;
}

/** `POST /api/create/release` and the `dev` block of the extended status. */
export interface DevRelease {
  version: string | null;
  url: string | null;
  expires_at: string | null;
}

export function isIntakeStage(value: unknown): value is IntakeStage {
  return (
    typeof value === "string" &&
    (INTAKE_STAGES as readonly string[]).includes(value)
  );
}

/** The stages the Progress pane polls through (§8.2: confirmed is included
 * so a pane opened right after "Build this" sees the first build land). */
const PROGRESS_STAGES: ReadonlySet<IntakeStage> = new Set<IntakeStage>([
  "confirmed",
  "building",
  "qa",
  "testing",
]);
export function isProgressStage(stage: IntakeStage | null | undefined): boolean {
  return stage !== null && stage !== undefined && PROGRESS_STAGES.has(stage);
}

/** Stages where the plan exists and the owner can still say yes or ask for changes. */
export function canConfirm(stage: IntakeStage | null | undefined): boolean {
  return stage === "plan_sent" || stage === "revising";
}

/** Stages where the finalize form applies (§9.1). */
export function canFinalize(stage: IntakeStage | null | undefined): boolean {
  return stage === "dev_ready" || stage === "finalizing";
}

/* ------------------------------------------------------------------- copy */

/** The caption's stage word, as lib/create/progress.ts spells it:
 * `dev_ready` → "dev ready", `failed` → "needs you" (§8.5). */
export function stageLabel(stage: IntakeStage | string | null | undefined): string {
  if (!stage) return "no plan yet";
  return stage === "failed" ? "needs you" : stage.replace(/_/g, " ");
}

/** A whole percent inside 0–100; anything unreadable is 0. */
export function clampPercent(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function percentLabel(value: unknown): string {
  return `${clampPercent(value)}%`;
}

/** `<stage> · <percent>%` — the card caption without the app name. */
export function progressCaption(
  stage: IntakeStage | string | null | undefined,
  percent: unknown,
): string {
  return `${stageLabel(stage)} · ${percentLabel(percent)}`;
}

export function planVersionLabel(planVersion: number | null | undefined): string {
  return planVersion ? `plan v${planVersion}` : "no plan yet";
}

export function revisionsLabel(revisions: number | null | undefined): string {
  const n = revisions ?? 0;
  return `${n} revision${n === 1 ? "" : "s"}`;
}

const DAY_MS = 86_400_000;

/** "expires in 14 days" / "expires today" / "expired" / "no dev build". */
export function expiryCopy(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!expiresAt) return "no dev build";
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return "no dev build";
  const left = at - now.getTime();
  if (left <= 0) return "expired";
  const days = Math.floor(left / DAY_MS);
  if (days === 0) return "expires today";
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** The last `n` lines of a build log, oldest first. */
export function logTail(log: readonly string[] | null | undefined, n = 8): string[] {
  if (!log || log.length === 0) return [];
  return log.slice(Math.max(0, log.length - n));
}

/* --------------------------------------------------------------- finalize */

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 160;
/** Icon uploads are resized server-side (§9.2); the browser only refuses the obvious. */
export const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ICON_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Client-side check for the icon file input; null means acceptable. */
export function iconProblem(
  file: { type: string; size: number } | null | undefined,
): string | null {
  if (!file) return null;
  if (!ICON_TYPES.has(file.type)) return "icon must be a PNG, JPEG or WebP";
  if (file.size > ICON_MAX_BYTES) return "icon must be under 2 MB";
  return null;
}

/** Why the finalize form cannot be sent yet; null means it can. */
export function finalizeProblem(input: {
  stage: IntakeStage | null | undefined;
  name: string;
  description: string;
}): string | null {
  if (!canFinalize(input.stage)) return "finalize opens once the dev build is live";
  const name = input.name.trim();
  if (!name) return "name is required";
  if (name.length > NAME_MAX) return `name must be ${NAME_MAX} characters or fewer`;
  if (input.description.trim().length > DESCRIPTION_MAX) {
    return `description must be ${DESCRIPTION_MAX} characters or fewer`;
  }
  return null;
}

/** `POST /api/create/finalize` (§14.1). The icon field stays a client-side
 * check: uploading it posts to `/api/create/icon` from the Box, not here. */
export const FINALIZE_ROUTE = "/api/create/finalize";
export const FINALIZE_AVAILABLE = true;
