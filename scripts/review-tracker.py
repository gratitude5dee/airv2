#!/usr/bin/env python3
"""Keep all September review IDs visible without treating implementation as a live score.

Run --sync after source/index changes. Edit implementation_status and evidence in the
JSON ledger as work is verified; --sync preserves those fields. --check verifies the
review inventory, metadata references, and the evidence required for closed work.
No application, infrastructure, or external service state is changed by this script.
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "review.md"
LEDGER = ROOT / "docs/review-findings.json"

ALIASES = {
    "WEB-01": ["LAT-01"], "LAT-03": ["MS-01"],
    "LAT-07": ["BOX-01"], "MS-06": ["LAT-06"],
    "LAT-10": ["MEM-06", "MEM-16"], "WEB-09": ["MEM-06", "MEM-16"],
    "WEB-21": ["BOX-19", "LAT-05"], "BOX-09": ["MEM-03"],
    "BOX-11": ["LAT-05"], "MEM-24": ["CA-22"],
    "CA-06": ["MEM-06", "MEM-16"], "CA-07": ["WEB-02"],
    "CA-10": ["TC-12"], "CA-11": ["BOX-08"], "CA-16": ["TC-01"],
    "CA-24": ["CA-04", "CA-21"], "CA-26": ["LAT-18"],
    "CA-27": ["TC-24"],
}
UMBRELLAS = {
    "CA-03": ["CA-04", "TC-01", "TC-02", "TC-06", "TC-07", "TC-09", "TC-20", "TC-21", "TC-27", "CA-23"],
    "CA-17": ["LAT-02", "LAT-03", "LAT-05", "LAT-09", "LAT-10"],
}

def ids(value: str) -> set[str]:
    return set(value.split())

PHASES = [
    ("0-instrument-and-stabilize", ids("LAT-15 WEB-23 WEB-24 BOX-03 MS-19 MS-24 SOC-16 CA-21 WEB-17 WEB-20 TC-19 TC-26 TC-05 CA-04 CA-24 WZ-01 WZ-03 WZ-05 WZ-18 SOC-01 MEM-05 MEM-30 BOX-08 CA-11 CA-28")),
    ("1-first-response-and-lifecycle", ids("LAT-17 LAT-18 LAT-06 LAT-02 CA-01 LAT-01 WEB-01 WEB-02 WEB-05 WEB-06 WEB-19 MS-01 LAT-03 MS-12 BOX-19 LAT-05 WEB-21 BOX-11 LAT-04 LAT-07 BOX-01 LAT-22 LAT-08 BOX-04 LAT-23 BOX-18 BOX-20 BOX-02 BOX-22 MS-20 MS-21 MS-23 MS-03 MS-16 MS-05 MS-04 MS-02")),
    ("2-core-task-and-memory-loop", ids("CA-08 TC-24 CA-27 WEB-03 TC-21 TC-27 CA-29 MEM-29 TC-06 TC-07 TC-20 TC-01 CA-23 TC-02 TC-22 SOC-17 TC-25 TC-30 TC-08 TC-09 CA-20 CA-22 LAT-19 CA-02 MEM-01 MEM-18 MEM-19 MEM-20 MEM-16 MEM-03 BOX-09 MEM-11 MEM-02 MEM-17 MEM-21 MEM-25 CA-03 CA-17")),
    ("3-cutovers-and-continuity", ids("WZ-16 WZ-19 WZ-02 WZ-17 WZ-20 WZ-21 WZ-12 WZ-22 WZ-08 WZ-04 WZ-06 SOC-02 SOC-03 SOC-04 SOC-05 SOC-18 SOC-20 SOC-21 SOC-19 SOC-23 MEM-06 LAT-10 WEB-09 CA-06 WEB-25 MEM-10 MEM-12 MEM-22 MEM-26 CA-05 TC-12 CA-10 TC-23")),
]

DEPENDENCIES = {
    "CA-08": ["MS-01", "LAT-03", "CA-04"],
    "TC-02": ["CA-04"], "TC-03": ["CA-04"], "WEB-07": ["CA-04"],
    "BOX-02": ["CA-04"], "TC-01": ["CA-04", "TC-20"],
    "TC-06": ["CA-04", "CA-08", "TC-21", "TC-27"],
    "TC-07": ["CA-04", "CA-08", "TC-21", "TC-27"],
    "TC-20": ["CA-04", "TC-21", "TC-27"],
    "CA-23": ["TC-06", "TC-07", "TC-20"], "TC-22": ["TC-07", "TC-02"],
    "TC-09": ["TC-19", "TC-05"], "TC-08": ["TC-06", "TC-07"],
    "TC-25": ["TC-06", "TC-07"], "TC-30": ["TC-19", "TC-05"],
    "LAT-01": ["WEB-23", "WEB-24"], "WEB-02": ["WEB-23", "WEB-24"],
    "LAT-02": ["LAT-15"], "LAT-04": ["LAT-15", "BOX-03"],
    "LAT-05": ["LAT-15", "BOX-03"], "MS-01": ["LAT-15"],
    "MS-12": ["MS-01"], "BOX-01": ["BOX-03"], "BOX-19": ["BOX-03"],
    "BOX-18": ["BOX-03"], "BOX-20": ["BOX-18"],
    "MEM-16": ["MEM-01", "MEM-18", "MEM-19", "MEM-20"],
    "MEM-03": ["TC-19"], "MEM-11": ["MEM-01", "MEM-18", "MEM-19", "MEM-20", "MEM-03"],
    "MEM-02": ["MEM-03", "MEM-11", "TC-19", "TC-05"],
    "MEM-17": ["MEM-03", "MEM-11", "TC-19", "TC-05"],
    "MEM-21": ["MEM-03", "MEM-11", "BOX-03"], "MEM-06": ["MEM-16", "MEM-29"],
    "MEM-29": ["CA-29"], "MEM-10": ["MEM-02", "MEM-17"],
    "WZ-02": ["WZ-01", "WZ-03", "WZ-16", "WZ-17", "WZ-20", "WZ-21", "WZ-12"],
    "WZ-16": ["WZ-01", "WZ-10"], "WZ-19": ["WZ-01"], "WZ-20": ["WZ-01"],
    "SOC-17": ["CA-04", "TC-07", "SOC-01", "SOC-16"],
    "SOC-18": ["SOC-16"], "SOC-21": ["SOC-18", "SOC-20"],
    "SOC-05": ["SOC-02", "SOC-03", "SOC-04", "SOC-19"],
    "SOC-26": ["WZ-10"], "CA-22": ["CA-04", "CA-08"],
    "CA-20": ["CA-08"], "CA-02": ["LAT-19"], "CA-05": ["CA-08", "TC-06"],
}

CO_SHIP = {key: sorted(ids("MEM-01 MEM-18 MEM-19 MEM-20") - {key}) for key in ids("MEM-01 MEM-18 MEM-19 MEM-20")}
EXTERNAL = {
    "CA-18": ["Photon dedicated-line pricing/capacity and paying-user provisioning commitment"],
    "WZ-24": ["Owner of wzrd.tech DNS and existing AgentMail domain inventory; no review default"],
    "WZ-04": ["Provider-confirmed send idempotency semantics and staging replay test"],
    "WZ-12": ["Email tier policy pinned; code behavior remains until then"],
    "SOC-05": ["Approved native API access and quota for each enabled platform; no paid tier inferred"],
    "MS-22": ["Verified Photon shared-line webview/reply behavior or dedicated-line availability"],
}

DEFAULTS = {
    "model-tiers": ids("LAT-18 CA-26 LAT-01 TC-10"),
    "template-ack": ids("LAT-17 LAT-02 CA-01 LAT-18"),
    "explicit-stop": ids("CA-02 LAT-19 CA-15"),
    "disable-taskrouter": ids("BOX-08 CA-11 TC-30"),
    "remove-mitosis-experiment": ids("MEM-30 MEM-05 MEM-15"),
    "current-email-tiers": ids("WZ-12 CA-14 CA-31"),
    "dns-owner-required": ids("WZ-24 WZ-02"),
    "no-personal-key-spend-fallback": ids("WEB-02 CA-07 WEB-20"),
    "dedicated-paying-lines": ids("CA-18 MS-22"),
    "cleanroom-social": ids("SOC-05 SOC-14 SOC-19 SOC-23"),
    "automation-purpose-sessions": ids("CA-22 MEM-24 CA-09"),
    "guests-no-wake": ids("MS-23"),
    "no-localstorage-transcript": ids("WEB-11"),
    "keep-nonsocial-composio": ids("SOC-14"),
    "freeze-surface": ids("CA-19 TC-06 CA-32"),
}

WORKSTREAMS = {"MEM": "memory", "LAT": "imessage", "WEB": "gateway-web", "MS": "miniapps-spectrum", "TC": "task-spine", "WZ": "mail", "SOC": "social", "BOX": "box-fleet", "CA": "cognitive-architecture"}
OVERRIDES = {**{k: "evals" for k in ids("TC-21 TC-27 TC-15 MEM-11 MEM-29 CA-29 WEB-24 SOC-15")}, **{k: "template-steering" for k in ids("TC-19 TC-05 TC-26 TC-13 TC-14 TC-18 TC-30 BOX-08 CA-11 CA-28")}, "CA-18": "product-commercial", "CA-19": "product-freeze"}
STATES = {"not_verified", "in_progress", "implemented", "verified", "external_dependency", "not_applicable"}


def parse_review() -> list[dict]:
    text = SOURCE.read_text()
    start = text.index("## Appendix A. Findings index\n")
    end = text.index("## Appendix B.", start)
    rows = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not re.match(r"\| (MEM|LAT|WEB|MS|TC|WZ|SOC|BOX|CA)-\d+ \|", line):
            continue
        offset = sum(len(part) + 1 for part in text.splitlines()[:line_number - 1])
        if not start <= offset < end:
            continue
        columns = [part.strip().replace("\\|", "|") for part in re.split(r"(?<!\\)\|", line)[1:-1]]
        # A code span in MEM-11 contains unescaped regex alternation pipes.
        finding = "|".join(columns[4:-1])
        key, severity, effort, area = columns[:4]
        phase = next((phase for phase, members in PHASES if key in members), "4-remaining-review-closure")
        canonical = ALIASES.get(key, [key])
        kind = "umbrella" if key in UMBRELLAS else "commercial" if key == "CA-18" else "alias" if key in ALIASES else "engineering"
        rows.append({
            "id": key, "severity": severity, "effort": effort, "area": area,
            "finding": finding, "review_verification": columns[-1],
            "source": {"path": "review.md", "line": line_number},
            "workstream": OVERRIDES.get(key, WORKSTREAMS[key.split("-")[0]]),
            "phase": phase, "kind": kind,
            "canonical_ids": UMBRELLAS.get(key, canonical),
            "depends_on": DEPENDENCIES.get(key, []), "co_ship_with": CO_SHIP.get(key, []),
            "review_defaults": [name for name, members in DEFAULTS.items() if key in members],
            "external_evidence_needed": EXTERNAL.get(key, []),
            "implementation_status": "not_verified", "evidence": [], "notes": "",
        })
    return rows


def check(ledger: dict, source_rows: list[dict]) -> list[str]:
    errors = []
    rows = ledger.get("findings", [])
    by_id = {row["id"]: row for row in rows}
    expected = {row["id"]: row for row in source_rows}
    if len(rows) != 249 or len(by_id) != 249 or set(by_id) != set(expected):
        errors.append("Ledger must contain exactly the 249 unique Appendix A IDs.")
    for key, row in by_id.items():
        for field in ("severity", "effort", "area", "finding", "review_verification", "source"):
            if row.get(field) != expected.get(key, {}).get(field):
                errors.append(f"{key}: source field {field} drifted; run --sync.")
        for field in ("canonical_ids", "depends_on", "co_ship_with"):
            for ref in row.get(field, []):
                if ref not in by_id:
                    errors.append(f"{key}: unknown {field} ID {ref}.")
        status = row.get("implementation_status")
        if status not in STATES:
            errors.append(f"{key}: invalid implementation_status {status!r}.")
        if status in {"implemented", "verified", "not_applicable"} and not row.get("evidence"):
            errors.append(f"{key}: {status} requires evidence; source verification alone is not implementation evidence.")
        if status == "verified" and row.get("kind") in {"alias", "umbrella"}:
            for ref in row["canonical_ids"]:
                if by_id[ref].get("implementation_status") not in {"verified", "not_applicable"}:
                    errors.append(f"{key}: cannot verify while canonical {ref} is open.")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sync", action="store_true", help="Refresh review metadata, preserving implementation evidence.")
    parser.add_argument("--check", action="store_true", help="Validate metadata and evidence (also the default).")
    args = parser.parse_args()
    source_rows = parse_review()
    old = json.loads(LEDGER.read_text()) if LEDGER.exists() else {"findings": []}
    if args.sync:
        old_rows = {row["id"]: row for row in old["findings"]}
        for row in source_rows:
            for field in ("implementation_status", "evidence", "notes"):
                row[field] = old_rows.get(row["id"], {}).get(field, row[field])
        old = {"schema_version": 1, "review": "review.md", "reviewed_commit": "bb82c05", "acceptance_document": "docs/review-implementation-plan.md", "product_acceptance": {"status": "not_measured", "target_percent": 95, "evidence": []}, "findings": source_rows, **({"product_acceptance": old["product_acceptance"]} if "product_acceptance" in old else {})}
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        LEDGER.write_text(json.dumps(old, indent=2, ensure_ascii=False) + "\n")
    errors = check(old, source_rows)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(json.dumps({"rows": len(old["findings"]), "severity": dict(Counter(row["severity"] for row in old["findings"])), "implementation": dict(Counter(row["implementation_status"] for row in old["findings"])), "product_acceptance": old.get("product_acceptance", {}).get("status", "not_measured")}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
