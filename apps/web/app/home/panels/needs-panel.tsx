"use client";

/**
 * Needs You — the universal approval queue (extracted verbatim from the old
 * page.tsx needs tab in the redesign phase-1 split; now self-contained).
 * Pending/resolved views, grouped-by-kind cards, detail drawer, batch send.
 */
import { useEffect, useState } from "react";
import { Orb } from "@/components/orb/Orb";

export interface Decision {
  id: string;
  kind: string;
  platform: string | null;
  sender: string | null;
  label: string | null;
  status?: string;
  created_at: string;
  resolved_at?: string | null;
  /** social_post: the exact text + target the agent proposes to publish. */
  payload?: ({ text?: string; target?: string } & Record<string, unknown>) | null;
}

interface DecisionDetail {
  decision: Decision;
  /** email_draft: the held draft body, read from AgentMail at view time. */
  draft?: { subject?: string; text?: string; to?: string[] } | null;
}

const DECISION_KIND_LABELS: Record<string, string> = {
  email_draft: "Email draft awaiting send",
  calendar_add: "Calendar invite",
  run_approval: "Agent action awaiting approval",
  ad_write: "Ad spend awaiting approval",
  content_plan: "Content plan proposed",
  reconnect: "Account needs reconnecting",
  revise: "Post needs a revision",
  spend_divergence: "Ad spend diverged from budget",
  spend_ceiling: "Spend ceiling reached",
  social_post: "Social post awaiting approval",
  purchase_review: "Card fill awaiting approval",
  crm_update: "CRM update awaiting approval",
  new_contact: "New contact",
  tier2_contact: "New contact",
};

function decisionKindLabel(kind: string): string {
  return DECISION_KIND_LABELS[kind] ?? "Needs your approval";
}

/**
 * D4: per-kind approve CTA copy. Kinds without an entry still get a generic
 * Approve button (the API resolves any pending decision), except contact
 * notices, which resolve through People (mark known) rather than approve.
 */
const DECISION_APPROVE_CTAS: Record<string, string> = {
  email_draft: "Send",
  content_plan: "Approve plan",
  calendar_add: "Add to calendar",
  reconnect: "Retry",
  revise: "Retry",
  social_post: "Post it",
  purchase_review: "Fill card",
};

const NO_APPROVE_KINDS = new Set(["new_contact", "tier2_contact"]);

function decisionApproveCta(kind: string): string | null {
  if (NO_APPROVE_KINDS.has(kind)) return null;
  return DECISION_APPROVE_CTAS[kind] ?? "Approve";
}

export function NeedsPanel({
  active,
  onPendingCount,
}: {
  active: boolean;
  /** Keeps the global rail badge in sync with this panel's loads. */
  onPendingCount?: (count: number) => void;
}) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<string | null>(null);
  // V8 Needs you: pending/resolved view, detail drawer, batch send.
  const [needsView, setNeedsView] = useState<"pending" | "resolved">("pending");
  const [resolved, setResolved] = useState<Decision[] | null>(null);
  const [detail, setDetail] = useState<DecisionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  async function loadDecisions() {
    const res = await fetch("/api/decisions");
    if (res.ok) {
      const data = (await res.json()) as { decisions?: Decision[] };
      setDecisions(data.decisions ?? []);
      onPendingCount?.((data.decisions ?? []).length);
    }
  }

  useEffect(() => {
    if (active) void loadDecisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function resolveDecision(
    id: string,
    action: "approve" | "dismiss",
    method?: "link"
  ) {
    setDecisionBusy(id);
    setDecisionNote(null);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(method ? { method } : {}) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDecisionNote(data.error ?? "That didn't go through — try again.");
      }
    } finally {
      setDecisionBusy(null);
    }
    setDetail((d) => (d?.decision.id === id ? null : d));
    setResolved(null);
    await loadDecisions();
  }

  // V8: the last 30 days of resolved decisions — receipts stay findable.
  async function loadResolved() {
    const res = await fetch("/api/decisions?status=resolved");
    if (res.ok) {
      const data = (await res.json()) as { decisions?: Decision[] };
      setResolved(data.decisions ?? []);
    } else {
      setResolved([]);
    }
  }

  // V8: decision detail drawer — full payload, plus the held email draft
  // body read from AgentMail at view time.
  async function openDecision(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/decisions/${id}`);
      if (res.ok) {
        setDetail((await res.json()) as DecisionDetail);
      } else {
        setDecisionNote("Couldn't load that decision — try again.");
      }
    } catch {
      setDecisionNote("Couldn't load that decision — try again.");
    } finally {
      setDetailLoading(false);
    }
  }

  // V8: batch-approve pending email drafts (tier-1 senders only — the
  // server re-checks both kind and tier per decision).
  async function batchSendDrafts(ids: string[]) {
    if (ids.length === 0) return;
    setBatchBusy(true);
    setDecisionNote(null);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "approve" }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          approved?: string[];
          skipped?: { id: string; reason: string }[];
        };
        const sent = data.approved?.length ?? 0;
        const skippedRows = data.skipped ?? [];
        const overLimit = skippedRows.filter(
          (s) => s.reason === "batch limit reached"
        ).length;
        const otherSkipped = skippedRows.length - overLimit;
        const parts = [`Sent ${sent} draft${sent === 1 ? "" : "s"}`];
        if (overLimit > 0) {
          parts.push(
            `${overLimit} still pending (batches send 20 at a time — press again for the rest)`
          );
        }
        if (otherSkipped > 0) {
          parts.push(
            `${otherSkipped} skipped (unknown senders or already resolved stay one-at-a-time)`
          );
        }
        setDecisionNote(`${parts.join(" — ")}.`);
      } else {
        setDecisionNote("Batch send didn't go through — try again.");
      }
    } catch {
      setDecisionNote("Batch send didn't go through — try again.");
    } finally {
      setBatchBusy(false);
    }
    setResolved(null);
    await loadDecisions();
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-semibold">Needs you</h3>
        <div className="flex items-center gap-1">
          {(["pending", "resolved"] as const).map((view) => (
            <button
              key={view}
              className={
                "seg !px-3 !py-1 !text-[12px]" +
                (needsView === view ? " pill-active" : "")
              }
              aria-current={needsView === view ? "page" : undefined}
              onClick={() => {
                setNeedsView(view);
                if (view === "resolved" && resolved === null) {
                  void loadResolved();
                }
              }}
            >
              {view === "pending" ? "Pending" : "Last 30 days"}
            </button>
          ))}
        </div>
      </div>
      {decisionNote ? (
        <p className="muted m-0 text-[12px]">{decisionNote}</p>
      ) : null}
      {detailLoading ? (
        <div className="py-1">
          <Orb pill label="Loading details…" />
        </div>
      ) : null}
      {detail ? (
        <div className="panel rise-in !p-3">
          <div className="flex items-start justify-between gap-2">
            <strong className="text-[13px]">
              {decisionKindLabel(detail.decision.kind)}
            </strong>
            <button
              className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>
          <p className="muted m-0 mt-1 text-[12px]">
            {[
              detail.decision.label,
              detail.decision.sender,
              detail.decision.platform,
              new Date(detail.decision.created_at).toLocaleString(),
            ]
              .filter(Boolean)
              .join(" \u00b7 ")}
          </p>
          {detail.draft ? (
            <div className="mt-2 rounded-lg bg-surface-2 p-2">
              {detail.draft.to && detail.draft.to.length > 0 ? (
                <p className="muted m-0 break-all text-[11px]">
                  To: {detail.draft.to.join(", ")}
                </p>
              ) : null}
              {detail.draft.subject ? (
                <p className="m-0 mt-1 text-[13px] font-medium">
                  {detail.draft.subject}
                </p>
              ) : null}
              {detail.draft.text ? (
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13px]">
                  {detail.draft.text}
                </p>
              ) : null}
            </div>
          ) : null}
          {detail.decision.payload &&
          Object.keys(detail.decision.payload).length > 0 ? (
            <div className="mt-2 rounded-lg bg-surface-2 p-2">
              {Object.entries(detail.decision.payload).map(([k, v]) => (
                <p
                  key={k}
                  className="m-0 whitespace-pre-wrap break-all text-[12px]"
                >
                  <span className="muted">{k}: </span>
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </p>
              ))}
            </div>
          ) : null}
          {detail.decision.status === "pending" ? (
            <div className="mt-2 flex gap-2">
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={decisionBusy !== null}
                onClick={() =>
                  void resolveDecision(detail.decision.id, "approve")
                }
              >
                {decisionBusy === detail.decision.id ? "Working\u2026" : "Approve"}
              </button>
              <button
                className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                disabled={decisionBusy !== null}
                onClick={() =>
                  void resolveDecision(detail.decision.id, "dismiss")
                }
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {needsView === "resolved" ? (
        <>
          {(resolved ?? []).map((d) => (
            <div key={d.id} className="panel rise-in !p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong className="text-[13px]">
                    {decisionKindLabel(d.kind)}
                  </strong>
                  <p className="muted m-0 mt-1 text-[12px]">
                    {[
                      d.status === "approved" ? "Approved" : "Dismissed",
                      d.label,
                      d.sender,
                      d.resolved_at
                        ? new Date(d.resolved_at).toLocaleString()
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
                  </p>
                </div>
                <button
                  className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                  onClick={() => void openDecision(d.id)}
                >
                  Details
                </button>
              </div>
            </div>
          ))}
          {resolved !== null && resolved.length === 0 ? (
            <p className="muted text-[13px]">
              Nothing resolved in the last 30 days.
            </p>
          ) : null}
        </>
      ) : (
        (() => {
          // Group pending decisions by kind, with counts (V8).
          const groups = new Map<string, Decision[]>();
          for (const d of decisions ?? []) {
            const list = groups.get(d.kind) ?? [];
            list.push(d);
            groups.set(d.kind, list);
          }
          return (
            <>
              {Array.from(groups.entries()).map(([kind, list]) => (
                <div key={kind} className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="muted m-0 text-[12px] font-medium">
                      {decisionKindLabel(kind)} · {list.length}
                    </p>
                    {kind === "email_draft" && list.length > 1 ? (
                      <button
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        disabled={batchBusy || decisionBusy !== null}
                        title="Sends drafts whose counterparty is a known sender; the rest stay individual."
                        onClick={() => void batchSendDrafts(list.map((d) => d.id))}
                      >
                        {batchBusy ? "Sending\u2026" : `Send all (${list.length})`}
                      </button>
                    ) : null}
                  </div>
                  {list.map((d) => (
                    <div
                      key={d.id}
                      className={
                        "panel rise-in !p-3" +
                        (d.kind === "calendar_add"
                          ? " !shadow-none border border-dashed border-[var(--muted)]"
                          : "")
                      }
                    >
                      <strong className="text-[13px]">
                        {decisionKindLabel(d.kind)}
                      </strong>
                      <p className="muted mb-2 mt-1 text-[12px]">
                        {[d.label, d.sender, d.platform]
                          .filter(Boolean)
                          .join(" \u00b7 ")}
                      </p>
                      {d.kind === "social_post" && d.payload?.text ? (
                        <div className="mb-2 rounded-lg bg-surface-2 p-2">
                          <p className="m-0 whitespace-pre-wrap text-[13px]">
                            {d.payload.text}
                          </p>
                          {d.payload.target ? (
                            <p className="muted m-0 mt-1 break-all text-[11px]">
                              → {d.payload.target}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        {decisionApproveCta(d.kind) ? (
                          <button
                            className="btn !px-3 !py-1.5 !text-[12px]"
                            disabled={decisionBusy !== null}
                            onClick={() => void resolveDecision(d.id, "approve")}
                          >
                            {decisionBusy === d.id
                              ? "Working\u2026"
                              : decisionApproveCta(d.kind)}
                          </button>
                        ) : null}
                        {d.kind === "purchase_review" &&
                        d.payload?.link_supported === true ? (
                          <button
                            className="btn !px-3 !py-1.5 !text-[12px]"
                            disabled={decisionBusy !== null}
                            onClick={() =>
                              void resolveDecision(d.id, "approve", "link")
                            }
                          >
                            Pay with Link
                          </button>
                        ) : null}
                        <button
                          className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                          disabled={decisionBusy !== null}
                          onClick={() => void resolveDecision(d.id, "dismiss")}
                        >
                          Dismiss
                        </button>
                        <button
                          className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                          onClick={() => void openDecision(d.id)}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {decisions !== null && decisions.length === 0 ? (
                <p className="muted text-[13px]">Nothing needs you right now.</p>
              ) : null}
            </>
          );
        })()
      )}
    </div>
  );
}
