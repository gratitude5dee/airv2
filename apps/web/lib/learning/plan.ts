/**
 * The Air Learning Plane V10 plan (goal.md) as a static, content-free
 * structure for the operator dashboard. This mirrors the spec's milestones,
 * control modes, hard gates, and central allowlist so admin.wzrd.tech can
 * render the plan without touching any owner content.
 */

export const LEARNING_PLAN_VERSION = "v10";
// Must match air_learning.promotion.POLICY_VERSION on the Box.
export const PROMOTION_POLICY_VERSION = "air.promotion-policy.v1";

export const HARD_GATES = [
  "approval_integrity",
  "authorization_integrity",
  "privacy_integrity",
  "secret_integrity",
  "side_effect_safety",
  "verifier_integrity",
  "no_deception",
  "required_evidence_complete",
] as const;

export const SOFT_SCORE_DIMENSIONS = [
  "task_success",
  "instruction_following",
  "tool_correctness",
  "context_use",
  "honesty",
  "personal_fit",
  "recovery_quality",
  "latency",
  "cost",
  "token_efficiency",
  "unnecessary_action_penalty",
] as const;

export interface PlanMilestone {
  id: string;
  title: string;
  outcome: string;
  status: "shipped" | "in_progress" | "planned";
}

export const LEARNING_PLAN = {
  version: LEARNING_PLAN_VERSION,
  promotionPolicyVersion: PROMOTION_POLICY_VERSION,
  objective:
    "Improve completed-task rate and reduce repeat errors without weakening privacy, approval, or Box isolation.",
  invariants: [
    "All learning content stays in the owner's Box (L1)",
    "Central Postgres receives allowlisted, content-free receipts only (L4)",
    "Live Hermes is observed, never experimented on (L2)",
    "Risky evaluation requires a disposable twin (L3)",
    "Candidates are data (policy overlays), never executable patches (L5)",
    "Safety, approval, and spending policy are not optimization variables (L6)",
    "Every promotion is owner-approved and independently reversible (L7)",
    "No weight-level training through V10 M8 (L8)",
  ],
  modes: [
    { mode: "off", description: "No collection, no evaluation" },
    {
      mode: "observe",
      description: "Collect traces and feedback locally; no candidates (private-beta default)",
    },
    {
      mode: "suggest",
      description: "Compile tasks, evaluate candidates in twins, propose to owner for approval",
    },
    {
      mode: "auto_safe",
      description: "Auto-activate low-risk promotions with rollback (unavailable until M8 + operator flag)",
    },
  ],
  hardGates: HARD_GATES,
  softScoreDimensions: SOFT_SCORE_DIMENSIONS,
  milestones: [
    {
      id: "M0",
      title: "Contracts and receipts",
      outcome: "Versioned schemas, receipt allowlist, central tables, trace_id correlation",
      status: "shipped",
    },
    {
      id: "M1",
      title: "Box learning runtime",
      outcome: "air-learningd, private SQLite ledger, trace collection, reconciliation",
      status: "shipped",
    },
    {
      id: "M2",
      title: "Typed feedback",
      outcome: "Owner feedback enum + rating; corrections stay Box-private",
      status: "shipped",
    },
    {
      id: "M3",
      title: "Task compilation",
      outcome: "Replay-safe tasks from high-signal episodes with split leakage controls",
      status: "in_progress",
    },
    {
      id: "M4",
      title: "Evaluation twins",
      outcome: "Disposable resettable twins; one evaluation rollout per primary Box",
      status: "planned",
    },
    {
      id: "M5",
      title: "Paired evaluation",
      outcome: "Baseline vs candidate with hard gates and confidence bounds (HUD adapter)",
      status: "planned",
    },
    {
      id: "M6",
      title: "Candidate optimization",
      outcome: "Allowlisted policy overlays from evidence (Harbor adapter, local-only)",
      status: "planned",
    },
    {
      id: "M7",
      title: "Approval and activation",
      outcome: "Owner approval, atomic activation, independent rollback",
      status: "planned",
    },
    {
      id: "M8",
      title: "Auto-safe promotions",
      outcome: "Evidence-backed automatic low-risk promotions behind an operator flag",
      status: "planned",
    },
  ] satisfies PlanMilestone[],
  centralAllowlist: [
    "Opaque IDs and owner ID (routing/RLS)",
    "Status enums and timestamps",
    "Air release, Hermes ref, adapter versions, OS class",
    "Served model, requested tier, aggregate tokens/cost/latency",
    "Aggregate score dimensions and confidence bounds",
    "Hard-gate booleans, typed errors, rollback reasons",
    "Global artifact digests",
  ],
  centralProhibitions: [
    "Raw prompts, responses, memory, or files",
    "Fixtures or private task text",
    "Private profile or candidate bodies",
    "Free-text feedback",
    "Identifying tool arguments or results",
    "Hashes of private content",
  ],
} as const;
