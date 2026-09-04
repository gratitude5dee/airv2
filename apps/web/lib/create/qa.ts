/**
 * V11 §9.6 Preview QA — the control-plane half. The browser runs in the
 * Box (`air-create qa` drives the template's agent-browser against a
 * preview-link URL at 390×360 / 390×760 / 390×844, reduced-motion on and
 * off); what comes back here is a content-free report: counts, ratios,
 * milliseconds, booleans per pass. No DOM text, no URLs, no screenshots —
 * those stay in the Box under `.build/qa/`. The report is scored to one
 * `qa_score` (0–100) and both are stamped on the draft version row, which
 * `GET /api/create/status` returns.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getVersion, type VersionRow } from "./versions";

/** Fixed viewports every pass must cover (§9.6). Width is the iMessage sheet. */
export const QA_VIEWPORTS = [
  { width: 390, height: 360 },
  { width: 390, height: 760 },
  { width: 390, height: 844 },
] as const;

export const QA_THRESHOLDS = {
  /** WCAG AA body text. */
  minContrast: 4.5,
  /** Apple HIG minimum hit target (CSS px). */
  minTouchTargetPx: 44,
  /** Core Web Vitals "good" LCP under mobile throttling. */
  maxLcpMs: 2500,
} as const;

/** Passes short of the full matrix (3 viewports × motion on/off) cap the score. */
export const QA_PASS_MATRIX = QA_VIEWPORTS.length * 2;

function matrixCell(viewport: { width: number; height: number }, reducedMotion: boolean): string {
  return `${viewport.width}x${viewport.height}:${reducedMotion ? 1 : 0}`;
}

/** Every (viewport, reduced-motion) cell a complete run must report. */
export const QA_MATRIX_CELLS: ReadonlySet<string> = new Set(
  QA_VIEWPORTS.flatMap((viewport) => [matrixCell(viewport, false), matrixCell(viewport, true)])
);

const count = z.number().int().min(0).max(1_000_000);

export const QaPassSchema = z
  .object({
    viewport: z.object({
      width: z.number().int().min(200).max(2000),
      height: z.number().int().min(200).max(4000),
    }),
    reduced_motion: z.boolean(),
    console_errors: count,
    page_errors: count,
    csp_reports: count,
    off_origin_requests: count,
    /** Lowest text contrast ratio seen; null when nothing measurable rendered. */
    min_contrast: z.number().min(1).max(21).nullable(),
    contrast_violations: count,
    small_targets: count,
    horizontal_overflow: z.boolean(),
    lcp_ms: z.number().min(0).max(600_000).nullable(),
    /** Screenshot filename under .build/qa/ (basename only). */
    screenshot: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,80}$/)
      .nullable()
      .default(null),
  })
  .strict();

export type QaPass = z.infer<typeof QaPassSchema>;

export const QaReportSchema = z
  .object({
    version: z.string().regex(/^v[0-9]{10,16}$/),
    passes: z.array(QaPassSchema).min(1).max(QA_PASS_MATRIX * 2),
    /** Wall time of the whole run, for the budget meter. */
    duration_ms: z.number().int().min(0).max(3_600_000).optional(),
  })
  .strict();

export type QaReport = z.infer<typeof QaReportSchema>;

export interface QaSummary {
  score: number;
  passes: number;
  /** Rule ids that failed anywhere, worst-first. Content-free by construction. */
  failed: string[];
  min_contrast: number | null;
  max_lcp_ms: number | null;
  off_origin_requests: number;
}

/**
 * Score one report. Starts at 100 and takes fixed penalties per failing
 * dimension, aggregated across passes (a fault on any viewport counts once —
 * the goal is a signal, not a leaderboard). Off-origin traffic is the one
 * hard rule (CR6/§7): any request off the app origin floors the score at 0.
 */
export function scoreReport(report: QaReport): QaSummary {
  const failed = new Set<string>();
  let score = 100;
  let minContrast: number | null = null;
  let maxLcp: number | null = null;
  let offOrigin = 0;
  const penalize = (rule: string, points: number): void => {
    if (failed.has(rule)) return;
    failed.add(rule);
    score -= points;
  };
  for (const pass of report.passes) {
    offOrigin += pass.off_origin_requests;
    if (pass.min_contrast !== null) {
      minContrast = minContrast === null ? pass.min_contrast : Math.min(minContrast, pass.min_contrast);
    }
    if (pass.lcp_ms !== null) {
      maxLcp = maxLcp === null ? pass.lcp_ms : Math.max(maxLcp, pass.lcp_ms);
    }
    if (pass.page_errors > 0) penalize("page-errors", 30);
    if (pass.console_errors > 0) penalize("console-errors", 10);
    if (pass.csp_reports > 0) penalize("csp-violations", 25);
    if (pass.contrast_violations > 0 || (pass.min_contrast !== null && pass.min_contrast < QA_THRESHOLDS.minContrast)) {
      penalize("contrast", 15);
    }
    if (pass.small_targets > 0) penalize("touch-targets", 10);
    if (pass.horizontal_overflow) penalize("horizontal-overflow", 15);
    if (pass.lcp_ms !== null && pass.lcp_ms > QA_THRESHOLDS.maxLcpMs) penalize("lcp", 10);
  }
  if (offOrigin > 0) {
    failed.add("off-origin-requests");
    score = 0;
  }
  // Only the fixed matrix counts as coverage: a pass on some other viewport
  // is scored for faults above but never stands in for a required cell.
  const covered = new Set<string>();
  for (const pass of report.passes) {
    const cell = matrixCell(pass.viewport, pass.reduced_motion);
    if (QA_MATRIX_CELLS.has(cell)) covered.add(cell);
  }
  if (covered.size < QA_MATRIX_CELLS.size) {
    failed.add("incomplete-matrix");
    score = Math.min(score, 60);
  }
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    passes: report.passes.length,
    failed: [...failed],
    min_contrast: minContrast,
    max_lcp_ms: maxLcp,
    off_origin_requests: offOrigin,
  };
}

export class QaError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "QaError";
  }
}

/**
 * Stamp `qa_score` + the content-free summary on the version row. Only draft
 * or live rows of `appId` qualify; a purged version is a 404. Returns the
 * refreshed row.
 */
export async function recordQaScore(
  supabase: SupabaseClient,
  appId: string,
  report: QaReport
): Promise<{ row: VersionRow; summary: QaSummary }> {
  const row = await getVersion(supabase, appId, report.version);
  if (!row) throw new QaError("unknown version", 404);
  const summary = scoreReport(report);
  const { error } = await supabase
    .from("miniapp_versions")
    .update({
      qa_score: summary.score,
      qa_report: { ...summary, viewports: report.passes.length, at: new Date().toISOString() },
    })
    .eq("id", row.id);
  if (error) throw new Error(`qa score write failed: ${error.message}`);
  return { row: { ...row, qa_score: summary.score }, summary };
}
