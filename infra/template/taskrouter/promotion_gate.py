#!/usr/bin/env python3
"""Task-router promotion gate: golden labeled set + regression thresholds.

Any consumer that wants to treat the router's proposal as more than a hint
must pass this gate first. It scores the full routing pipeline (`route()`,
heuristics-first with optional model refinement) against `golden.jsonl`
and fails if any threshold regresses:

  - tier accuracy >= the deterministic-heuristic baseline measured in the
    same run (the model path may never make routing worse than free);
  - ZERO payment approval false-negatives (cases marked "payment" must
    come back needs_approval=true — the eval failure mode);
  - overall approval accuracy >= APPROVAL_FLOOR;
  - latency p95 <= P95_BUDGET_MS.

Usage:
    python3 promotion_gate.py [--no-model] [--golden golden.jsonl] [--json out.json]

Exit code 0 = gate passed, 1 = gate failed. Grow golden.jsonl from shadow
logs (decisions.jsonl trace-joins) — never shrink it to make the gate pass.
"""

import argparse
import json
import os
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import taskrouter  # noqa: E402

TIER_MARGIN = 0.0  # pipeline tier accuracy must be >= heuristic baseline
APPROVAL_FLOOR = 0.85
P95_BUDGET_MS = 3000


def load_golden(path):
    with open(path) as fh:
        return [json.loads(line) for line in fh if line.strip()]


def score(cases, use_model):
    latencies = []
    tier_ok = appr_ok = tool_hits = tool_total = 0
    heur_tier_ok = 0
    payment_false_negatives = []
    sources = {}
    rows = []
    for case in cases:
        start = time.monotonic()
        if use_model:
            decision, _ = taskrouter.route(case["text"])
        else:
            heur = taskrouter.heuristic(case["text"])
            decision = {**heur, "prefetch_tools": heur["tools"]}
        latencies.append((time.monotonic() - start) * 1000)
        sources[decision["source"]] = sources.get(decision["source"], 0) + 1
        heur_tier_ok += taskrouter.heuristic(case["text"])["tier"] == case["tier"]
        tier_ok += decision["tier"] == case["tier"]
        appr_ok += decision["needs_approval"] == case["needs_approval"]
        if case.get("payment") and not decision["needs_approval"]:
            payment_false_negatives.append(case["text"])
        for tool in case["tools"]:
            tool_total += 1
            tool_hits += tool in decision["prefetch_tools"]
        rows.append(
            {
                "text": case["text"][:60],
                "want_tier": case["tier"],
                "got_tier": decision["tier"],
                "want_appr": case["needs_approval"],
                "got_appr": decision["needs_approval"],
                "source": decision["source"],
            }
        )
    n = len(cases)
    return {
        "cases": n,
        "tier_accuracy": round(tier_ok / n, 3),
        "heuristic_tier_accuracy": round(heur_tier_ok / n, 3),
        "approval_accuracy": round(appr_ok / n, 3),
        "prefetch_tool_recall": round(tool_hits / tool_total, 3) if tool_total else None,
        "latency_ms_p50": round(statistics.median(latencies)),
        "latency_ms_p95": round(sorted(latencies)[max(0, int(0.95 * n) - 1)]),
        "payment_false_negatives": payment_false_negatives,
        "sources": sources,
        "rows": rows,
    }


def evaluate_gate(result):
    failures = []
    if result["tier_accuracy"] < result["heuristic_tier_accuracy"] - TIER_MARGIN:
        failures.append(
            f"tier accuracy {result['tier_accuracy']} below heuristic baseline "
            f"{result['heuristic_tier_accuracy']}"
        )
    if result["payment_false_negatives"]:
        failures.append(
            f"payment approval false-negatives: {result['payment_false_negatives']}"
        )
    if result["approval_accuracy"] < APPROVAL_FLOOR:
        failures.append(
            f"approval accuracy {result['approval_accuracy']} below floor {APPROVAL_FLOOR}"
        )
    if result["latency_ms_p95"] > P95_BUDGET_MS:
        failures.append(
            f"latency p95 {result['latency_ms_p95']}ms over budget {P95_BUDGET_MS}ms"
        )
    return failures


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--golden",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "golden.jsonl"),
    )
    parser.add_argument("--no-model", action="store_true", help="heuristics only")
    parser.add_argument("--json", help="write full result JSON to this path")
    args = parser.parse_args()

    cases = load_golden(args.golden)
    result = score(cases, use_model=not args.no_model)
    failures = evaluate_gate(result)
    result["gate_passed"] = not failures
    result["gate_failures"] = failures

    if args.json:
        with open(args.json, "w") as fh:
            json.dump(result, fh, indent=2)
    summary = {k: v for k, v in result.items() if k != "rows"}
    print(json.dumps(summary, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
