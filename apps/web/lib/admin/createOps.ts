/**
 * V12 §12 — the Create funnel math behind `GET /api/admin/create`. Pure
 * functions over metadata rows (stages, timestamps, statuses, rule ids,
 * scores, counts): the funnel, the stage-to-stage medians, builds by status
 * and first hard rule, the QA distribution, the tests ratio, the mirror
 * tally and the template breakdown. No prompt, plan or source text is ever
 * an input here (CR21).
 */
import { INTAKE_STAGES, type IntakeStage } from "../create/intake";
import type { Finding } from "../create/versions";

export interface IntakeMeta {
  stage: string;
  template: string | null;
  opened_at: string | null;
  confirmed_at: string | null;
  dev_ready_at: string | null;
  production_at: string | null;
  mirror_error: string | null;
}

export interface BuildMeta {
  status: string;
  findings: unknown;
}

export interface VersionMeta {
  qa_score: number | null;
  tests_total: number | null;
  tests_passed: number | null;
  mirrored_at: string | null;
}

export type Funnel = Record<IntakeStage, number>;

export interface Medians {
  first_question: number | null;
  plan: number | null;
  confirm_to_dev: number | null;
  dev_to_prod: number | null;
}

export const QA_LOW_SCORE = 70;

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asIntakeMeta(row: Record<string, unknown>): IntakeMeta {
  return {
    stage: String(row["stage"] ?? ""),
    template: str(row["template"]),
    opened_at: str(row["opened_at"]),
    confirmed_at: str(row["confirmed_at"]),
    dev_ready_at: str(row["dev_ready_at"]),
    production_at: str(row["production_at"]),
    mirror_error: str(row["mirror_error"]),
  };
}

export function asBuildMeta(row: Record<string, unknown>): BuildMeta {
  return { status: String(row["status"] ?? ""), findings: row["findings"] };
}

export function asVersionMeta(row: Record<string, unknown>): VersionMeta {
  return {
    qa_score: num(row["qa_score"]),
    tests_total: num(row["tests_total"]),
    tests_passed: num(row["tests_passed"]),
    mirrored_at: str(row["mirrored_at"]),
  };
}

/** Linear-interpolated percentile (0..1) of a sample; null when empty. */
export function percentile(values: readonly number[], p: number): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower]!;
  const high = sorted[upper]!;
  return low + (high - low) * (position - lower);
}

export function median(values: readonly number[]): number | null {
  return percentile(values, 0.5);
}

export function funnelFrom(intakes: Iterable<IntakeMeta>): Funnel {
  const funnel = Object.fromEntries(INTAKE_STAGES.map((stage) => [stage, 0])) as Funnel;
  for (const intake of intakes) {
    if ((INTAKE_STAGES as readonly string[]).includes(intake.stage)) {
      funnel[intake.stage as IntakeStage] += 1;
    }
  }
  return funnel;
}

function secondsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

function roundedMedian(values: number[]): number | null {
  const value = median(values);
  return value === null ? null : Math.round(value);
}

/**
 * Stage-to-stage medians in whole seconds from the intake timestamps:
 * `plan` = opened → confirmed (the plan the owner said yes to),
 * `confirm_to_dev` = confirmed → dev_ready, `dev_to_prod` = dev_ready →
 * production. `first_question` has no timestamp column (§14.2 item 1) and
 * is reported null until one exists.
 */
export function mediansFrom(intakes: Iterable<IntakeMeta>): Medians {
  const plan: number[] = [];
  const confirmToDev: number[] = [];
  const devToProd: number[] = [];
  for (const intake of intakes) {
    const planSeconds = secondsBetween(intake.opened_at, intake.confirmed_at);
    if (planSeconds !== null) plan.push(planSeconds);
    const devSeconds = secondsBetween(intake.confirmed_at, intake.dev_ready_at);
    if (devSeconds !== null) confirmToDev.push(devSeconds);
    const prodSeconds = secondsBetween(intake.dev_ready_at, intake.production_at);
    if (prodSeconds !== null) devToProd.push(prodSeconds);
  }
  return {
    first_question: null,
    plan: roundedMedian(plan),
    confirm_to_dev: roundedMedian(confirmToDev),
    dev_to_prod: roundedMedian(devToProd),
  };
}

/** The rule id of a build's first hard finding (or first finding at all). */
export function firstHardRule(findings: unknown): string | null {
  if (!Array.isArray(findings)) return null;
  const rows = findings.filter(
    (entry): entry is Finding =>
      typeof entry === "object" && entry !== null && typeof (entry as Finding).rule === "string"
  );
  const hardFinding = rows.find((finding) => finding.severity === "hard");
  return hardFinding?.rule ?? rows[0]?.rule ?? null;
}

export function buildsFrom(builds: Iterable<BuildMeta>): {
  total: number;
  failed: number;
  by_rule: Record<string, number>;
} {
  let total = 0;
  let failed = 0;
  const byRule: Record<string, number> = {};
  for (const build of builds) {
    total += 1;
    if (build.status !== "failed") continue;
    failed += 1;
    const rule = firstHardRule(build.findings);
    if (rule) byRule[rule] = (byRule[rule] ?? 0) + 1;
  }
  return { total, failed, by_rule: byRule };
}

export function qaFrom(versions: Iterable<VersionMeta>): {
  p50: number | null;
  p90: number | null;
  below_70: number;
} {
  const scores: number[] = [];
  for (const version of versions) {
    if (version.qa_score !== null) scores.push(version.qa_score);
  }
  const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
  return {
    p50: round(percentile(scores, 0.5)),
    p90: round(percentile(scores, 0.9)),
    below_70: scores.filter((score) => score < QA_LOW_SCORE).length,
  };
}

/** `declared` = versions that ran a tests snapshot; ratio over all counts. */
export function testsFrom(versions: Iterable<VersionMeta>): {
  declared: number;
  passed_ratio: number | null;
} {
  let declared = 0;
  let total = 0;
  let passed = 0;
  for (const version of versions) {
    if (version.tests_total === null) continue;
    declared += 1;
    total += version.tests_total;
    passed += Math.min(version.tests_passed ?? 0, version.tests_total);
  }
  return {
    declared,
    passed_ratio: total > 0 ? Math.round((passed / total) * 1000) / 1000 : null,
  };
}

/** `ok` = versions mirrored in the window; `failed` = intakes carrying a mirror error. */
export function mirrorFrom(
  versions: Iterable<VersionMeta>,
  intakes: Iterable<IntakeMeta>
): { ok: number; failed: number } {
  let ok = 0;
  let failed = 0;
  for (const version of versions) if (version.mirrored_at !== null) ok += 1;
  for (const intake of intakes) if (intake.mirror_error !== null) failed += 1;
  return { ok, failed };
}

export function byTemplateFrom(intakes: Iterable<IntakeMeta>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const intake of intakes) {
    if (intake.template === null) continue;
    counts[intake.template] = (counts[intake.template] ?? 0) + 1;
  }
  return counts;
}
