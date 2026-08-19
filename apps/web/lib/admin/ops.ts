/**
 * V8 hardening item 4 — rate/limit dashboard math for /api/admin/ops.
 * Thresholds (documented in docs/platform.md §Operations):
 *
 *   - Box starts: 600/hr, 1,500/day platform ceilings; alert at 70%.
 *   - Schedule sweeper: a start consumer inside the same 1,500/day budget —
 *     its share is alarmed at 70% of SCHEDULE_BUDGET_SHARE (one third of
 *     the daily ceiling), so schedule growth pages before it starves
 *     message-driven wakes.
 *   - Social automation: per-user actions/day against automation_rules
 *     daily_cap; alert at 70% of the cap.
 */

export const DAILY_START_CEILING = 1500;
export const ALERT_RATIO = 0.7;

/**
 * The slice of the daily start budget schedule firing may consume before
 * ops gets paged: one third. The V3 sweeper plus V8 keep-awake are the two
 * polling-shaped consumers — the ratio keeps their growth visible long
 * before the ceiling itself is at risk.
 */
export const SCHEDULE_BUDGET_SHARE = 1 / 3;

export interface ScheduleBudget {
  fires_24h: number;
  keepawake_wakes_24h: number;
  daily_ceiling: number;
  budget_share: number;
  share_used: number;
  alert: boolean;
}

/** Schedule-fire consumption of the box-start budget, alarmed at 70% of its share. */
export function scheduleBudget(
  fires24h: number,
  keepawakeWakes24h: number
): ScheduleBudget {
  const budget = DAILY_START_CEILING * SCHEDULE_BUDGET_SHARE;
  const consumed = fires24h + keepawakeWakes24h;
  return {
    fires_24h: fires24h,
    keepawake_wakes_24h: keepawakeWakes24h,
    daily_ceiling: DAILY_START_CEILING,
    budget_share: SCHEDULE_BUDGET_SHARE,
    share_used: budget > 0 ? consumed / budget : 0,
    alert: consumed >= budget * ALERT_RATIO,
  };
}

/** Rejections page ops at ≥20% of upload attempts, once past this floor. */
export const UPLOAD_REJECTION_SPIKE_FLOOR = 5;
export const UPLOAD_REJECTION_SPIKE_RATIO = 0.2;

export interface MiniAppOpsInput {
  store_opens_24h: number;
  launches_24h: number;
  guest_sessions_24h: number;
  publishes_24h: number;
  uploads_24h: number;
  upload_bytes_24h: number;
  upload_rejections_24h: number;
  rate_limited_24h: number;
  gate_settlements_24h: number;
  x402_settlements_24h: number;
  x402_receipts_24h: number;
  x402_revenue_usdc_24h: number;
}

export interface MiniAppOps extends MiniAppOpsInput {
  alerts: string[];
}

/**
 * MA11 mini-app counters. Two alarms: a receipt/settlement mismatch (every
 * x402 gate_settled event writes its receipt first, so the counts must
 * match — drift means a crashed settlement path) and an upload-guard
 * rejection spike (someone probing the media guards).
 */
export function miniAppOps(input: MiniAppOpsInput): MiniAppOps {
  const alerts: string[] = [];
  if (input.x402_receipts_24h !== input.x402_settlements_24h) {
    alerts.push("receipt_settlement_mismatch");
  }
  const attempts = input.uploads_24h + input.upload_rejections_24h;
  if (
    input.upload_rejections_24h >= UPLOAD_REJECTION_SPIKE_FLOOR &&
    attempts > 0 &&
    input.upload_rejections_24h / attempts >= UPLOAD_REJECTION_SPIKE_RATIO
  ) {
    alerts.push("upload_rejection_spike");
  }
  return { ...input, alerts };
}

export interface SocialUsage {
  user_id: string;
  actions_today: number;
  daily_cap: number;
  cap_ratio: number;
  alert: boolean;
}

/** Per-user social actions/day from the automation_rules counters. */
export function socialUsage(
  rules: Array<{ user_id: string; used_today: number; daily_cap: number }>
): SocialUsage[] {
  const byUser = new Map<string, { actions: number; cap: number }>();
  for (const rule of rules) {
    const entry = byUser.get(rule.user_id) ?? { actions: 0, cap: 0 };
    entry.actions += rule.used_today;
    entry.cap += rule.daily_cap;
    byUser.set(rule.user_id, entry);
  }
  return [...byUser.entries()].map(([userId, { actions, cap }]) => ({
    user_id: userId,
    actions_today: actions,
    daily_cap: cap,
    cap_ratio: cap > 0 ? actions / cap : 0,
    alert: cap > 0 && actions >= cap * ALERT_RATIO,
  }));
}
