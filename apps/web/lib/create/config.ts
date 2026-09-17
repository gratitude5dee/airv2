/**
 * V12 Create configuration (docs/goal-create-v12.md §14.3). Every accessor is
 * server-side, reads `process.env` at call time, and falls back to the spec's
 * default so a missing variable means "default behaviour", never a failed
 * deploy (the R2/app-origin pattern in lib/env.ts). Nothing here is
 * `NEXT_PUBLIC_`; nothing here is a secret — secrets stay in lib/env.ts.
 */

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw.trim().toLowerCase() === "true";
}

function text(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

export const createConfig = {
  /** §5.2 — at most this many questions, in one message, before the plan. */
  intakeMaxQuestions: (): number => int("CREATE_INTAKE_MAX_QUESTIONS", 3, 0, 5),
  /** §5.1 — revisions before the owner is sent to the Create surface. */
  planMaxRevisions: (): number => int("CREATE_PLAN_MAX_REVISIONS", 5, 1, 20),
  /** §5.1 — days without an owner message before an intake is abandoned. */
  intakeAbandonDays: (): number => int("CREATE_INTAKE_ABANDON_DAYS", 7, 1, 90),
  /** CR17 — a dev release lives this long unless renewed by a new build. */
  devTtlDays: (): number => int("CREATE_DEV_TTL_DAYS", 14, 1, 90),
  /** CR19 — minimum spacing between progress card updates. */
  progressTickMs: (): number => int("CREATE_PROGRESS_TICK_MS", 10_000, 2_000, 120_000),
  /** CR19 — text fallback cadence when card updates fail; 0 disables texts. */
  progressTextMs: (): number => int("CREATE_PROGRESS_TEXT_MS", 30_000, 0, 600_000),
  /** §8.5 — consecutive failed builds before an intake is `failed`. */
  maxFailedBuilds: (): number => int("CREATE_MAX_FAILED_BUILDS", 3, 1, 10),
  /** §8.5 — Builder turns without convergence before an intake is `failed`. */
  maxBuilderTurns: (): number => int("CREATE_MAX_BUILDER_TURNS", 6, 1, 30),
  /** CR22 — QA score a dev release requires. */
  devMinQaScore: (): number => int("CREATE_DEV_MIN_QA", 70, 0, 100),
  /** §9.2 — image model for a generated icon (the creative lane's "Nano Banana"). */
  iconModel: (): string => text("CREATE_ICON_MODEL", "gemini-3.1-flash-image"),
  /** CR20 — the mirror is off until MC0 seeds the repository. */
  mirrorEnabled: (): boolean => flag("CREATE_MIRROR_ENABLED", false),
  mirrorRepo: (): string => text("WZRD_CREATE_REPO", "gratitude5dee/wzrd-create"),
  /** GitHub App installation on the mirror repository; null = lane unconfigured. */
  mirrorInstallationId: (): string | null => {
    const raw = process.env["WZRD_CREATE_INSTALLATION_ID"];
    return raw && raw.trim() ? raw.trim() : null;
  },
  /** §7.1 — reasoning effort sent with Builder turns on GMI GLM slugs. */
  buildEffort: (): string => text("GMI_CREATE_BUILD_EFFORT", "medium"),
  /** §8.1 — public zipball cap for a GitHub URL intake (bytes). */
  publicZipMaxBytes: (): number => int("CREATE_PUBLIC_ZIP_MAX_BYTES", 50 * 1024 * 1024, 1024 * 1024, 200 * 1024 * 1024),
} as const;
